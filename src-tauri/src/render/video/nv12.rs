//! Fotograma de video en NV12 (planos Y y CbCr) listo para dibujarse.
//!
//! El decodificador (nativo o ffmpeg) entrega los dos planos como texturas de wgpu;
//! `Nv12Pipeline` (F18.2) los convierte a RGB en el shader. Es el formato en el que
//! decodifican VideoToolbox y Media Foundation, así que no hay conversión en la CPU.

use std::any::Any;

/// Matriz de color con la que se pasa de YCbCr a RGB.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum YuvMatrix {
    Bt601,
    Bt709,
    Bt2020,
}

/// Dos texturas (Y: `R8Unorm`, CbCr: `Rg8Unorm` a mitad de resolución) + cómo interpretarlas.
pub struct Nv12Frame {
    pub y: wgpu::Texture,
    pub uv: wgpu::Texture,
    pub y_view: wgpu::TextureView,
    pub uv_view: wgpu::TextureView,
    pub width: u32,
    pub height: u32,
    pub matrix: YuvMatrix,
    /// `true` si el rango es completo (0–255); `false` es el rango de video (16–235).
    pub full_range: bool,
    /// Retiene lo que respalda las texturas (p. ej. el `CVPixelBuffer`) mientras el frame viva.
    _keepalive: Option<Box<dyn Any + Send + Sync>>,
}

impl Nv12Frame {
    pub fn new(y: wgpu::Texture, uv: wgpu::Texture, matrix: YuvMatrix, full_range: bool, keepalive: Option<Box<dyn Any + Send + Sync>>) -> Self {
        let y_view = y.create_view(&wgpu::TextureViewDescriptor::default());
        let uv_view = uv.create_view(&wgpu::TextureViewDescriptor::default());
        Self { width: y.width(), height: y.height(), y, uv, y_view, uv_view, matrix, full_range, _keepalive: keepalive }
    }
}
