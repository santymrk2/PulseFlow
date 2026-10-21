//! Decodificador nativo de macOS: AVFoundation (`AVAssetReader`) con VideoToolbox por debajo.
//!
//! Entrega los frames como `CVPixelBuffer` NV12 respaldados por IOSurface y los importa a wgpu
//! sin copiarlos (`metal_import`). Abre `.mp4`, `.mov` y `.m4v`; lo demás cae a ffmpeg.

use super::metal_import::{import_pixel_buffer, MetalTextureCache};
use super::{DecodedFrame, FramePixels, FrameSink, VideoDecoder};
use crate::error::{AppError, AppResult};
use crate::render::gpu;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::AnyObject;
use objc2_av_foundation::{AVAssetReader, AVAssetReaderStatus, AVAssetReaderTrackOutput, AVMediaTypeVideo, AVURLAsset};
use objc2_core_foundation::CFString;
use objc2_core_video::{kCVPixelBufferIOSurfacePropertiesKey, kCVPixelBufferMetalCompatibilityKey, kCVPixelBufferPixelFormatTypeKey, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange};
use objc2_foundation::{NSDictionary, NSNumber, NSString, NSURL};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Cuánto puede atrasarse un frame antes de que se reajuste el reloj de reproducción.
const MAX_LATENESS: Duration = Duration::from_millis(200);
/// Duración supuesta de un frame cuando el stream no permite estimarla (≈ 30 fps).
const FALLBACK_FRAME_DURATION: Duration = Duration::from_millis(33);
/// Reaperturas seguidas fallidas antes de rendirse.
const MAX_REOPEN_FAILURES: u32 = 3;

pub struct AvfDecoder {
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl VideoDecoder for AvfDecoder {
    fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

/// Abre `path` con AVFoundation. Falla (y el llamador cae a ffmpeg) si no es un video legible.
pub fn start(path: &str, sink: Arc<dyn FrameSink>) -> AppResult<AvfDecoder> {
    let running = Arc::new(AtomicBool::new(true));
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    let (running_thread, path_thread) = (Arc::clone(&running), path.to_string());

    // Los objetos de AVFoundation no son `Send`: se crean y viven dentro del hilo del decodificador.
    let thread = thread::Builder::new()
        .name(format!("PulseFlow-AVF-{path}"))
        .spawn(move || decode_loop(&path_thread, sink.as_ref(), &running_thread, &ready_tx))
        .map_err(|e| AppError::new(format!("Error iniciando el decodificador nativo: {e}")))?;

    let mut decoder = AvfDecoder { running, thread: Some(thread) };
    match ready_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(decoder),
        Ok(Err(message)) => {
            decoder.stop();
            Err(AppError::new(message))
        }
        Err(_) => {
            decoder.stop();
            Err(AppError::new(format!("AVFoundation no respondió al abrir {path}")))
        }
    }
}

/// Un `AVAssetReader` con la salida de video ya conectada.
struct Source {
    reader: Retained<AVAssetReader>,
    output: Retained<AVAssetReaderTrackOutput>,
}

impl Source {
    fn open(path: &str) -> Result<Self, String> {
        // SAFETY: llamadas a AVFoundation con objetos propios y vivos; sin aliasing ni hilos compartidos.
        unsafe {
            let url = NSURL::fileURLWithPath(&NSString::from_str(path));
            let asset = AVURLAsset::URLAssetWithURL_options(&url, None);
            let media_type = AVMediaTypeVideo.ok_or("AVMediaTypeVideo no disponible")?;
            #[allow(deprecated)] // la variante asíncrona exige un runloop; acá se necesita bloquear
            let track = asset.tracksWithMediaType(media_type).firstObject().ok_or_else(|| format!("{path} no tiene pista de video legible"))?;

            let output = AVAssetReaderTrackOutput::assetReaderTrackOutputWithTrack_outputSettings(&track, Some(&pixel_settings()));
            let reader = AVAssetReader::assetReaderWithAsset_error(&asset).map_err(|e| e.localizedDescription().to_string())?;
            if !reader.canAddOutput(&output) {
                return Err("AVAssetReader no acepta la salida de video".to_string());
            }
            reader.addOutput(&output);
            if !reader.startReading() {
                let reason = reader.error().map(|e| e.localizedDescription().to_string()).unwrap_or_default();
                return Err(format!("AVAssetReader no pudo empezar a leer: {reason}"));
            }
            Ok(Self { reader, output })
        }
    }
}

/// NV12 de rango de video, compatible con Metal y respaldado por IOSurface.
fn pixel_settings() -> Retained<NSDictionary<NSString, AnyObject>> {
    // SAFETY: las claves de CoreVideo son `CFString` inmortales; `CFString` y `NSString` son toll-free bridged.
    let key = |k: &'static CFString| unsafe { &*(k as *const CFString as *const NSString) };
    let format = NSNumber::new_u32(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange);
    let metal = NSNumber::new_bool(true);
    let io_surface = NSDictionary::<NSString, AnyObject>::new();
    // SAFETY: las claves son de CoreVideo (inmortales) y los valores viven durante la llamada.
    unsafe {
        NSDictionary::from_slices(
            &[key(kCVPixelBufferPixelFormatTypeKey), key(kCVPixelBufferMetalCompatibilityKey), key(kCVPixelBufferIOSurfacePropertiesKey)],
            &[&*format as &AnyObject, &*metal as &AnyObject, &*io_surface as &AnyObject],
        )
    }
}

fn to_duration(time: objc2_core_media::CMTime) -> Duration {
    if time.timescale <= 0 || time.value < 0 {
        return Duration::ZERO;
    }
    Duration::from_secs_f64(time.value as f64 / f64::from(time.timescale))
}

fn decode_loop(path: &str, sink: &dyn FrameSink, running: &AtomicBool, ready: &mpsc::Sender<Result<(), String>>) {
    let setup = || -> Result<(MetalTextureCache, Source, Arc<crate::render::gpu::GpuContext>), String> {
        let gpu = gpu::shared().map_err(|e| e.to_string())?;
        let cache = MetalTextureCache::new(&gpu).map_err(|e| e.to_string())?;
        Ok((cache, Source::open(path)?, gpu))
    };
    let (cache, mut source, gpu) = match setup() {
        Ok(parts) => parts,
        Err(message) => {
            let _ = ready.send(Err(message));
            return;
        }
    };
    let _ = ready.send(Ok(()));

    // Línea de tiempo continua: `offset` suma la duración de las vueltas anteriores del loop.
    let mut offset = Duration::ZERO;
    let mut base: Option<Duration> = None;
    let mut clock_start = Instant::now();
    let (mut last_total, mut frame_duration) = (Duration::ZERO, FALLBACK_FRAME_DURATION);
    let (mut frames, mut failures) = (0u64, 0u32);

    while running.load(Ordering::Relaxed) {
        let produced = autoreleasepool(|_| {
            // SAFETY: `output` pertenece a `source`, vivo durante esta iteración.
            let sample = unsafe { source.output.copyNextSampleBuffer() }?;
            // SAFETY: `sample` es válido; el `CVPixelBuffer` devuelto se retiene mientras se importa.
            let pts = to_duration(unsafe { sample.presentation_time_stamp() });
            let pixel_buffer = unsafe { sample.image_buffer() }?;

            let total = offset + pts;
            let base_time = *base.get_or_insert(total);
            let target = clock_start + total.saturating_sub(base_time);

            // esperar al instante del frame, atendiendo el stop
            while running.load(Ordering::Relaxed) && Instant::now() < target {
                thread::sleep(target.saturating_duration_since(Instant::now()).min(Duration::from_millis(10)));
            }
            if !running.load(Ordering::Relaxed) {
                return Some(());
            }
            // muy atrasado (p. ej. tras una pausa): se reajusta el reloj en vez de acelerar para alcanzarlo
            let late = Instant::now().saturating_duration_since(target);
            if late > MAX_LATENESS {
                clock_start += late;
            }

            match import_pixel_buffer(&gpu, &cache, &pixel_buffer) {
                Ok(frame) => sink.push(DecodedFrame { pts: total, pixels: FramePixels::Native(frame) }),
                Err(err) => eprintln!("[VideoEngine] frame nativo descartado en {path}: {err}"),
            }
            if total > last_total {
                frame_duration = total - last_total;
            }
            last_total = total;
            frames += 1;
            if frames % 120 == 0 {
                cache.flush();
            }
            Some(())
        });

        if produced.is_some() {
            failures = 0;
            continue;
        }

        // sin más frames: fin del archivo (dar la vuelta) o error del lector
        // SAFETY: `reader` pertenece a `source`.
        let status = unsafe { source.reader.status() };
        if status == AVAssetReaderStatus::Completed {
            offset = last_total + frame_duration;
        } else if !running.load(Ordering::Relaxed) {
            break;
        } else {
            failures += 1;
            eprintln!("[VideoEngine] el lector nativo terminó con estado {status:?} en {path} ({failures}/{MAX_REOPEN_FAILURES})");
            if failures >= MAX_REOPEN_FAILURES {
                break;
            }
            thread::sleep(Duration::from_millis(250));
        }
        match Source::open(path) {
            Ok(next) => source = next,
            Err(err) => {
                eprintln!("[VideoEngine] no se pudo reabrir {path}: {err}");
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::{DecodedFrame, FramePixels};
    use super::*;
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/video/solid_red_64.mp4");

    /// Guarda (pts, ancho, alto, es_nativo) de cada frame y los descarta.
    #[derive(Default)]
    struct Collect(Mutex<Vec<(Duration, u32, u32, bool)>>);

    impl FrameSink for Collect {
        fn push(&self, frame: DecodedFrame<'_>) {
            let (w, h, native) = match &frame.pixels {
                FramePixels::Native(f) => (f.width, f.height, true),
                FramePixels::Nv12Cpu { width, height, .. } => (*width, *height, false),
            };
            self.0.lock().expect("lock").push((frame.pts, w, h, native));
        }
    }

    impl Collect {
        fn wait_for(&self, timeout: Duration, done: impl Fn(&[(Duration, u32, u32, bool)]) -> bool) -> Vec<(Duration, u32, u32, bool)> {
            let start = Instant::now();
            while start.elapsed() < timeout {
                let frames = self.0.lock().expect("lock").clone();
                if done(&frames) {
                    return frames;
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            self.0.lock().expect("lock").clone()
        }
    }

    #[test]
    fn avf_decodes_fixture_frames() {
        let sink = Arc::new(Collect::default());
        let mut decoder = start(FIXTURE, sink.clone()).expect("abrir el fixture");

        let frames = sink.wait_for(Duration::from_secs(5), |f| f.len() >= 10);
        decoder.stop();

        assert!(frames.len() >= 10, "llegaron {} frames", frames.len());
        assert!(frames.iter().all(|f| f.1 == 64 && f.2 == 64 && f.3), "64x64 y nativos");
        assert!(frames.windows(2).all(|w| w[1].0 > w[0].0), "PTS creciente");
    }

    #[test]
    fn avf_loops_after_eof() {
        // el fixture dura 1 s: si hay frames con PTS > 1,2 s, se dio la vuelta y el PTS siguió creciendo
        let sink = Arc::new(Collect::default());
        let mut decoder = start(FIXTURE, sink.clone()).expect("abrir el fixture");

        let frames = sink.wait_for(Duration::from_secs(6), |f| f.last().is_some_and(|l| l.0 > Duration::from_millis(1200)));
        decoder.stop();

        assert!(frames.last().is_some_and(|l| l.0 > Duration::from_millis(1200)), "último PTS: {:?}", frames.last());
        assert!(frames.windows(2).all(|w| w[1].0 > w[0].0), "el PTS no retrocede al dar la vuelta");
    }

    #[test]
    fn avf_rejects_corrupt_file() {
        let path = std::env::temp_dir().join("pulseflow-corrupt.mp4");
        std::fs::write(&path, b"esto no es un mp4").expect("archivo de prueba");
        assert!(start(path.to_str().expect("ruta"), Arc::new(Collect::default())).is_err());
    }

    #[test]
    fn avf_rejects_a_missing_file() {
        assert!(start("/no/existe.mp4", Arc::new(Collect::default())).is_err());
    }

    #[test]
    fn avf_stop_joins_the_thread_quickly() {
        let sink = Arc::new(Collect::default());
        let mut decoder = start(FIXTURE, sink.clone()).expect("abrir el fixture");
        sink.wait_for(Duration::from_secs(3), |f| !f.is_empty());

        let started = Instant::now();
        decoder.stop();
        assert!(started.elapsed() < Duration::from_millis(500), "stop tardó {:?}", started.elapsed());
    }
}
