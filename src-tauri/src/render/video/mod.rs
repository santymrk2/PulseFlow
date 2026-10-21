//! Decodificación de video para fondos en bucle (Motion Backgrounds).
//!
//! Un `VideoDecoder` entrega `DecodedFrame` a un `FrameSink` (el hub de pantallas) con el PTS de
//! cada frame. Backends, en orden de preferencia (`start`):
//! 1. Nativo (F18.4/F18.6): VideoToolbox/AVFoundation o Media Foundation dejan el frame en memoria de
//!    GPU y la textura de wgpu apunta a esa misma memoria (sin pasar por la CPU).
//! 2. ffmpeg (`ffmpeg.rs`): decodifica por hardware cuando puede y entrega NV12 por un pipe; la
//!    conversión a RGB la hace el shader. Es la red de seguridad de todo lo que el nativo no abre.
//!
//! Ciclo de vida (F8.1): `stop()` termina el decodificador y une su hilo.

mod ffmpeg;
#[cfg(target_os = "macos")]
pub mod metal_import;
#[cfg(target_os = "macos")]
pub(crate) mod avf;
pub mod nv12;

use crate::error::AppResult;
use nv12::{Nv12Frame, YuvMatrix};
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;

/// Píxeles de un frame decodificado.
pub enum FramePixels<'a> {
    /// Planos NV12 en memoria de la CPU (camino ffmpeg): hay que subirlos.
    Nv12Cpu { width: u32, height: u32, y: &'a [u8], uv: &'a [u8], matrix: YuvMatrix, full_range: bool },
    /// Texturas que ya respaldan memoria de GPU (camino nativo): no hay nada que subir.
    Native(Nv12Frame),
}

/// Un frame y su instante dentro del video. El PTS sigue creciendo al dar la vuelta del loop.
pub struct DecodedFrame<'a> {
    pub pts: Duration,
    pub pixels: FramePixels<'a>,
}

/// Quien recibe los frames (se llama desde el hilo del decodificador).
pub trait FrameSink: Send + Sync {
    fn push(&self, frame: DecodedFrame<'_>);
}

/// Un decodificador en marcha.
pub trait VideoDecoder: Send {
    /// Lo detiene y espera a su hilo.
    fn stop(&mut self);
}

/// `true` para los contenedores que abre el decodificador nativo del sistema.
pub fn prefers_native(path: &str) -> bool {
    let lower = path.to_lowercase();
    [".mp4", ".mov", ".m4v"].iter().any(|ext| lower.ends_with(ext))
}

/// Inicia el decodificador de `path`: nativo si el contenedor lo permite y, si falla o no existe,
/// ffmpeg (hardware primero, software si el hardware muere a mitad de camino).
pub fn start(app: &AppHandle, path: &str, sink: Arc<dyn FrameSink>) -> AppResult<Box<dyn VideoDecoder>> {
    if prefers_native(path) {
        match start_native(app, path, Arc::clone(&sink)) {
            Ok(decoder) => return Ok(decoder),
            Err(err) => eprintln!("[VideoEngine] decodificador nativo no disponible para {path}, uso ffmpeg: {err}"),
        }
    }
    Ok(Box::new(ffmpeg::FfmpegDecoder::start(app, path, sink)?))
}

/// Decodificador nativo de la plataforma: AVFoundation en macOS (F18.4).
#[cfg(target_os = "macos")]
fn start_native(_app: &AppHandle, path: &str, sink: Arc<dyn FrameSink>) -> AppResult<Box<dyn VideoDecoder>> {
    Ok(Box::new(avf::start(path, sink)?))
}

/// Windows (Media Foundation) llega en F18.6; hasta entonces todo va por ffmpeg.
#[cfg(not(target_os = "macos"))]
fn start_native(_app: &AppHandle, _path: &str, _sink: Arc<dyn FrameSink>) -> AppResult<Box<dyn VideoDecoder>> {
    Err(crate::error::AppError::new("sin decodificador nativo en esta plataforma"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backend_selection_by_extension() {
        assert!(prefers_native("/v/fondo.mp4"));
        assert!(prefers_native("/v/FONDO.MOV"));
        assert!(prefers_native("C:\\v\\fondo.m4v"));
        assert!(!prefers_native("/v/fondo.webm"));
        assert!(!prefers_native("/v/fondo.mkv"));
        assert!(!prefers_native("/v/fondo.avi"));
        assert!(!prefers_native("/v/sin-extension"));
    }
}
