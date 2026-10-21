//! Decodificador nativo de Windows: Media Foundation (`IMFSourceReader`) con decodificación por
//! hardware (D3D11VA) y salida NV12 en texturas D3D11 (F18.6). Los frames pasan a wgpu por
//! `d3d_import` sin tocar la CPU. Abre `.mp4`, `.mov` y `.m4v`; lo demás cae a ffmpeg.
//!
//! **Sin verificar en Windows**: se compila contra `x86_64-pc-windows-msvc`, pero no se pudo ejecutar.

use super::d3d_import::D3dInterop;
use super::pacing::Pacer;
use super::{DecodedFrame, FramePixels, FrameSink, VideoDecoder};
use crate::error::{AppError, AppResult};
use crate::render::gpu;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use windows::core::{Interface, GUID, PCWSTR};
use windows::Win32::Graphics::Direct3D11::ID3D11Texture2D;
use windows::Win32::Media::MediaFoundation::{
    IMFAttributes, IMFDXGIBuffer, IMFSourceReader, MFCreateAttributes, MFCreateMediaType, MFCreateSourceReaderFromURL, MFMediaType_Video, MFShutdown, MFStartup, MFVideoFormat_NV12, MFSTARTUP_FULL, MF_MT_FRAME_SIZE,
    MF_MT_MAJOR_TYPE, MF_MT_SUBTYPE, MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_SOURCE_READERF_ENDOFSTREAM, MF_SOURCE_READER_D3D_MANAGER, MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING,
    MF_SOURCE_READER_FIRST_VIDEO_STREAM, MF_VERSION,
};
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

/// Duración supuesta de un frame cuando no se puede estimar (≈ 30 fps).
const FALLBACK_FRAME_DURATION: Duration = Duration::from_millis(33);
const FIRST_VIDEO_STREAM: u32 = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;

pub struct MfDecoder {
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl VideoDecoder for MfDecoder {
    fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

/// Abre `path` con Media Foundation. Falla (y el llamador cae a ffmpeg) si no es un video legible.
pub fn start(path: &str, sink: Arc<dyn FrameSink>) -> AppResult<MfDecoder> {
    let running = Arc::new(AtomicBool::new(true));
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    let (running_thread, path_thread) = (Arc::clone(&running), path.to_string());

    // COM y Media Foundation se inicializan y viven dentro del hilo del decodificador.
    let thread = thread::Builder::new()
        .name(format!("PulseFlow-MF-{path}"))
        .spawn(move || decode_loop(&path_thread, sink.as_ref(), &running_thread, &ready_tx))
        .map_err(|e| AppError::new(format!("Error iniciando el decodificador nativo: {e}")))?;

    let mut decoder = MfDecoder { running, thread: Some(thread) };
    match ready_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(decoder),
        Ok(Err(message)) => {
            decoder.stop();
            Err(AppError::new(message))
        }
        Err(_) => {
            decoder.stop();
            Err(AppError::new(format!("Media Foundation no respondió al abrir {path}")))
        }
    }
}

/// Inicializa COM + Media Foundation y los cierra al salir del hilo.
struct Runtime;

impl Runtime {
    fn new() -> Result<Self, String> {
        // SAFETY: se llama una vez por hilo; `Drop` hace el cierre simétrico.
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED).ok().map_err(|e| e.to_string())?;
            if let Err(e) = MFStartup(MF_VERSION, MFSTARTUP_FULL) {
                CoUninitialize();
                return Err(e.to_string());
            }
        }
        Ok(Self)
    }
}

impl Drop for Runtime {
    fn drop(&mut self) {
        // SAFETY: simétrico con `new`.
        unsafe {
            let _ = MFShutdown();
            CoUninitialize();
        }
    }
}

struct Source {
    reader: IMFSourceReader,
    width: u32,
    height: u32,
}

impl Source {
    fn open(path: &str, interop: &D3dInterop) -> Result<Self, String> {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        // SAFETY: llamadas COM con objetos propios; `wide` termina en cero y vive durante la llamada.
        unsafe {
            let mut attributes: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attributes, 3).map_err(|e| e.to_string())?;
            let attributes = attributes.ok_or("MFCreateAttributes no devolvió atributos")?;
            attributes.SetUnknown(&MF_SOURCE_READER_D3D_MANAGER, interop.manager()).map_err(|e| e.to_string())?;
            attributes.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1).map_err(|e| e.to_string())?;
            attributes.SetUINT32(&MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, 1).map_err(|e| e.to_string())?;

            let reader = MFCreateSourceReaderFromURL(PCWSTR(wide.as_ptr()), &attributes).map_err(|e| format!("{path} no se pudo abrir: {e}"))?;

            let wanted = MFCreateMediaType().map_err(|e| e.to_string())?;
            wanted.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video).map_err(|e| e.to_string())?;
            wanted.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_NV12).map_err(|e| e.to_string())?;
            reader.SetCurrentMediaType(FIRST_VIDEO_STREAM, None, &wanted).map_err(|e| format!("{path} no tiene salida NV12: {e}"))?;

            let actual = reader.GetCurrentMediaType(FIRST_VIDEO_STREAM).map_err(|e| e.to_string())?;
            let packed = actual.GetUINT64(&MF_MT_FRAME_SIZE).map_err(|e| e.to_string())?;
            Ok(Self { reader, width: (packed >> 32) as u32, height: (packed & 0xFFFF_FFFF) as u32 })
        }
    }

    /// Vuelve al principio para dar la vuelta del loop.
    fn rewind(&self) -> Result<(), String> {
        // SAFETY: `reader` es un objeto COM vivo; la posición se pasa como PROPVARIANT de 100 ns.
        unsafe { self.reader.SetCurrentPosition(&GUID::zeroed(), &PROPVARIANT::from(0i64)).map_err(|e| e.to_string()) }
    }
}

/// `100 ns` de Media Foundation → `Duration`.
fn to_duration(hundred_ns: i64) -> Duration {
    Duration::from_nanos(u64::try_from(hundred_ns).unwrap_or(0).saturating_mul(100))
}

fn decode_loop(path: &str, sink: &dyn FrameSink, running: &AtomicBool, ready: &mpsc::Sender<Result<(), String>>) {
    let setup = || -> Result<(Runtime, Arc<crate::render::gpu::GpuContext>, D3dInterop), String> {
        let runtime = Runtime::new()?;
        let gpu = gpu::shared().map_err(|e| e.to_string())?;
        let interop = D3dInterop::new(&gpu).map_err(|e| e.to_string())?;
        Ok((runtime, gpu, interop))
    };
    let (_runtime, gpu, mut interop) = match setup() {
        Ok(parts) => parts,
        Err(message) => {
            let _ = ready.send(Err(message));
            return;
        }
    };
    let source = match Source::open(path, &interop) {
        Ok(source) => source,
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

    while running.load(Ordering::Relaxed) {
        let mut flags = 0u32;
        let mut timestamp = 0i64;
        let mut sample = None;
        // SAFETY: los punteros de salida son locales y válidos durante la llamada.
        let read = unsafe { source.reader.ReadSample(FIRST_VIDEO_STREAM, 0, None, Some(&mut flags), Some(&mut timestamp), Some(&mut sample)) };
        if let Err(e) = read {
            eprintln!("[VideoEngine] error de lectura nativo en {path}: {e}");
            break;
        }

        if flags & (MF_SOURCE_READERF_ENDOFSTREAM.0 as u32) != 0 {
            // fin del archivo: dar la vuelta con el PTS acumulado
            offset = last_total + frame_duration;
            if let Err(e) = source.rewind() {
                eprintln!("[VideoEngine] no se pudo reiniciar {path}: {e}");
                break;
            }
            continue;
        }
        let Some(sample) = sample else { continue }; // hueco en el stream: sigue leyendo

        let total = offset + to_duration(timestamp);
        if !pacer.wait(total, running) {
            break;
        }

        // SAFETY: el buffer del frame es un `IMFDXGIBuffer` cuando el decodificador usa D3D11.
        let published = unsafe {
            sample
                .GetBufferByIndex(0)
                .and_then(|buffer| buffer.cast::<IMFDXGIBuffer>())
                .and_then(|dxgi| {
                    let mut raw: *mut std::ffi::c_void = std::ptr::null_mut();
                    dxgi.GetResource(&ID3D11Texture2D::IID, &mut raw)?;
                    // SAFETY: `GetResource` entrega una referencia +1 que `from_raw` toma.
                    let texture = ID3D11Texture2D::from_raw(raw);
                    Ok((texture, dxgi.GetSubresourceIndex()?))
                })
        };
        let frame = match published {
            Ok((texture, subresource)) => interop.publish(&gpu, &texture, subresource, source.width, source.height),
            Err(e) => Err(AppError::new(format!("el frame no es una textura D3D11: {e}"))),
        };
        match frame {
            Ok(frame) => sink.push(DecodedFrame { pts: total, pixels: FramePixels::Native(frame) }),
            Err(err) => eprintln!("[VideoEngine] frame nativo descartado en {path}: {err}"),
        }

        if total > last_total {
            frame_duration = total - last_total;
        }
        last_total = total;
    }
}
