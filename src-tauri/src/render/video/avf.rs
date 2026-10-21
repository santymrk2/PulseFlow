//! Decodificador nativo de macOS: AVFoundation (`AVAssetReader`) con VideoToolbox por debajo.
//!
//! Entrega los frames como `CVPixelBuffer` NV12 respaldados por IOSurface y los importa a wgpu
//! sin copiarlos (`metal_import`). Abre `.mp4`, `.mov` y `.m4v`; lo demás cae a ffmpeg.

use super::metal_import::{import_pixel_buffer, MetalTextureCache};
use super::pacing::Pacer;
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
use std::time::Duration;

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
    let (mut cache, mut source, mut gpu) = match setup() {
        Ok(parts) => parts,
        Err(message) => {
            let _ = ready.send(Err(message));
            return;
        }
    };
    let _ = ready.send(Ok(()));

    // Línea de tiempo continua: `offset` suma la duración de las vueltas anteriores del loop.
    let mut offset = Duration::ZERO;
    let mut pacer = Pacer::new();
    let (mut last_total, mut frame_duration) = (Duration::ZERO, FALLBACK_FRAME_DURATION);
    let (mut frames, mut failures) = (0u64, 0u32);

    while running.load(Ordering::Relaxed) {
        // F23.3: si el driver perdió el dispositivo, las texturas importadas quedan
        // huérfanas: la caché de CoreVideo está atada al `MTLDevice`, así que se
        // rehace con el contexto nuevo.
        if let Ok(current) = crate::render::gpu::shared() {
            if !Arc::ptr_eq(&current, &gpu) {
                match MetalTextureCache::new(&current) {
                    Ok(fresh) => {
                        log::warn!("[VideoEngine] el dispositivo se perdió: se rehacen las texturas de {path}");
                        gpu = current;
                        cache = fresh;
                    }
                    Err(err) => log::warn!("[VideoEngine] no se pudo rehacer la caché de texturas de {path}: {err}"),
                }
            }
        }

        // Con el dispositivo perdido no se importan texturas: las que habría que
        // importar pertenecen a un dispositivo muerto.
        if gpu.is_lost() {
            thread::sleep(Duration::from_millis(50));
            continue;
        }

        let produced = autoreleasepool(|_| {
            // SAFETY: `output` pertenece a `source`, vivo durante esta iteración.
            let sample = unsafe { source.output.copyNextSampleBuffer() }?;
            // SAFETY: `sample` es válido; el `CVPixelBuffer` devuelto se retiene mientras se importa.
            let pts = to_duration(unsafe { sample.presentation_time_stamp() });
            let pixel_buffer = unsafe { sample.image_buffer() }?;

            let total = offset + pts;
            // esperar al instante del frame (si se pidió detener, se descarta)
            if !pacer.wait(total, running) {
                return Some(());
            }

            match import_pixel_buffer(&gpu, &cache, &pixel_buffer) {
                Ok(frame) => sink.push(DecodedFrame { pts: total, pixels: FramePixels::Native(frame) }),
                Err(err) => log::warn!("[VideoEngine] frame nativo descartado en {path}: {err}"),
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
            log::warn!("[VideoEngine] el lector nativo terminó con estado {status:?} en {path} ({failures}/{MAX_REOPEN_FAILURES})");
            if failures >= MAX_REOPEN_FAILURES {
                break;
            }
            thread::sleep(Duration::from_millis(250));
        }
        match Source::open(path) {
            Ok(next) => source = next,
            Err(err) => {
                log::warn!("[VideoEngine] no se pudo reabrir {path}: {err}");
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

    /// Guarda el primer frame nativo que llega.
    #[derive(Default)]
    struct First(Mutex<Option<super::super::nv12::Nv12Frame>>);

    impl FrameSink for First {
        fn push(&self, frame: DecodedFrame<'_>) {
            if let FramePixels::Native(native) = frame.pixels {
                self.0.lock().expect("lock").get_or_insert(native);
            }
        }
    }

    #[test]
    fn native_frame_renders_red() {
        use crate::render::test_util::{assert_near, render_center};

        let sink = Arc::new(First::default());
        let mut decoder = start(FIXTURE, sink.clone()).expect("abrir el fixture");
        let started = Instant::now();
        while sink.0.lock().expect("lock").is_none() && started.elapsed() < Duration::from_secs(5) {
            std::thread::sleep(Duration::from_millis(10));
        }
        decoder.stop();

        let frame = sink.0.lock().expect("lock").take().expect("llegó un frame nativo");
        assert!(!frame.is_cpu_backed(), "las texturas respaldan memoria del decodificador");
        assert_near(render_center(&frame), [255, 0, 0], "rojo decodificado por AVFoundation");
    }

    /// Primer frame nativo de `path`.
    fn first_native_frame(path: &str) -> super::super::nv12::Nv12Frame {
        let sink = Arc::new(First::default());
        let mut decoder = start(path, sink.clone()).expect("abrir el video");
        let started = Instant::now();
        while sink.0.lock().expect("lock").is_none() && started.elapsed() < Duration::from_secs(5) {
            std::thread::sleep(Duration::from_millis(10));
        }
        decoder.stop();
        let frame = sink.0.lock().expect("lock").take();
        frame.expect("llegó un frame nativo")
    }

    #[test]
    fn native_frame_uses_the_matrix_declared_by_the_file() {
        use super::super::nv12::YuvMatrix;

        // etiquetado BT.709 aunque sólo mide 64 px (la convención por alto diría BT.601)
        let tagged = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/video/solid_red_64_bt709.mp4");
        assert_eq!(first_native_frame(tagged).matrix, YuvMatrix::Bt709);
    }

    #[test]
    fn a_file_without_a_declared_matrix_falls_back_to_the_height_convention() {
        use super::super::nv12::YuvMatrix;

        assert_eq!(first_native_frame(FIXTURE).matrix, YuvMatrix::Bt601, "64 px y sin etiqueta: SD");
    }

    /// HEVC de 10 bits: se pide NV12 de 8 bits a AVFoundation, que convierte; el video se ve igual.
    #[test]
    fn a_10_bit_hevc_file_is_decoded_natively_and_renders_red() {
        use crate::render::test_util::{assert_near, render_center};

        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/video/solid_red_64_hevc10.mp4");
        let frame = first_native_frame(path);
        assert!(!frame.is_cpu_backed());
        assert_near(render_center(&frame), [255, 0, 0], "rojo de un HEVC 10 bits");
    }

    /// CPU (usuario + sistema) consumido por este proceso hasta ahora.
    fn process_cpu() -> Duration {
        // SAFETY: `getrusage` escribe en una estructura propia y válida.
        let usage = unsafe {
            let mut usage: libc::rusage = std::mem::zeroed();
            assert_eq!(libc::getrusage(libc::RUSAGE_SELF, &mut usage), 0);
            usage
        };
        let tv = |t: libc::timeval| Duration::new(t.tv_sec as u64, t.tv_usec as u32 * 1000);
        tv(usage.ru_utime) + tv(usage.ru_stime)
    }

    /// Medición manual (F18.5): `PULSEFLOW_BENCH_VIDEO=/ruta/4k.mp4 cargo test --lib bench_native -- --ignored --nocapture`.
    /// Decodifica e importa a wgpu durante 10 s a tiempo real y reporta el CPU del proceso.
    #[test]
    #[ignore = "medición manual: necesita PULSEFLOW_BENCH_VIDEO"]
    fn bench_native_playback() {
        let path = std::env::var("PULSEFLOW_BENCH_VIDEO").expect("definir PULSEFLOW_BENCH_VIDEO con un video largo");
        let sink = Arc::new(Collect::default());

        let (cpu_before, wall_before) = (process_cpu(), Instant::now());
        let mut decoder = start(&path, sink.clone()).expect("abrir el video");
        std::thread::sleep(Duration::from_secs(10));
        decoder.stop();
        let (cpu, wall) = (process_cpu() - cpu_before, wall_before.elapsed());

        let frames = sink.0.lock().expect("lock").len();
        log::info!("nativo: {frames} frames en {wall:.2?} de reloj; CPU {cpu:.2?} ({:.0} % de un núcleo)", cpu.as_secs_f64() / wall.as_secs_f64() * 100.0);
    }
}

