//! Salida NDI y Broadcast directa desde el Framebuffer de la GPU.
//!
//! En lugar de capturar la pantalla por software (lento y pesado en CPU),
//! este módulo copia el render target resultante de la GPU (`copy_texture_to_buffer`)
//! a un staging buffer mapeable para streaming NDI en tiempo real sin tirones.

use super::sync::MutexExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use wgpu::{
    Buffer, BufferDescriptor, BufferUsages, CommandEncoder, Device, Extent3d, Origin3d,
    TexelCopyBufferInfo, TexelCopyBufferLayout, TexelCopyTextureInfo, Texture, TextureAspect,
};

/// Capturador de Framebuffer en VRAM para NDI y streaming de red.
pub struct GpuFramebufferCapture {
    pub staging_buffer: Buffer,
    pub width: u32,
    pub height: u32,
    pub is_active: Arc<AtomicBool>,
    pub latest_frame: Arc<Mutex<Option<Vec<u8>>>>,
}

impl GpuFramebufferCapture {
    pub fn new(device: &Device, width: u32, height: u32) -> Self {
        // En WGPU los bytes por fila deben alinearse a COPY_BYTES_PER_ROW_ALIGNMENT (256 bytes)
        let unpadded_bytes_per_row = width * 4;
        let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let padded_bytes_per_row = ((unpadded_bytes_per_row + align - 1) / align) * align;
        let buffer_size = (padded_bytes_per_row * height) as u64;

        let staging_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("NDI Framebuffer Staging Buffer"),
            size: buffer_size,
            usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        Self {
            staging_buffer,
            width,
            height,
            is_active: Arc::new(AtomicBool::new(false)),
            latest_frame: Arc::new(Mutex::new(None)),
        }
    }

    /// Registra la copia de la textura resultante al staging buffer en el CommandEncoder de la GPU.
    pub fn record_copy(&self, encoder: &mut CommandEncoder, source_texture: &Texture) {
        if !self.is_active.load(Ordering::Relaxed) {
            return;
        }

        let unpadded = self.width * 4;
        let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let padded = ((unpadded + align - 1) / align) * align;

        encoder.copy_texture_to_buffer(
            TexelCopyTextureInfo {
                texture: source_texture,
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            TexelCopyBufferInfo {
                buffer: &self.staging_buffer,
                layout: TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded),
                    rows_per_image: Some(self.height),
                },
            },
            Extent3d {
                width: self.width,
                height: self.height,
                depth_or_array_layers: 1,
            },
        );
    }

    /// Inicia la captura para NDI.
    pub fn start(&self) {
        self.is_active.store(true, Ordering::SeqCst);
    }

    /// Detiene la captura para NDI.
    pub fn stop(&self) {
        self.is_active.store(false, Ordering::SeqCst);
        let mut frame = self.latest_frame.lock_safe();
        *frame = None;
    }
}

// ---------------------------------------------------------------------------
// Ciclo de vida del feed (comandos START/STOP/IS_NDI_NATIVE_FEED)
// ---------------------------------------------------------------------------

/// Inicia (o reutiliza) la captura directa del Framebuffer de la GPU para NDI.
pub fn start_feed(
    app: &tauri::AppHandle,
    width_opt: Option<u32>,
    height_opt: Option<u32>,
) -> crate::error::AppResult<()> {
    let state = super::screens::manager(app)?;
    let mut capture_guard = state.ndi_capture.lock_safe();
    if let Some(ref capture) = *capture_guard {
        capture.start();
        return Ok(());
    }

    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: None,
        force_fallback_adapter: false,
        ..Default::default()
    }))
    .map_err(|e| crate::error::AppError::new(format!("GPU no disponible para NDI: {e}")))?;

    let (device, _) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("PulseFlow NDI Capture Device"),
        ..Default::default()
    }))
    .map_err(|e| crate::error::AppError::new(format!("Device no disponible para NDI: {e}")))?;

    let w = width_opt.unwrap_or(1920);
    let h = height_opt.unwrap_or(1080);
    let capture = GpuFramebufferCapture::new(&device, w, h);
    capture.start();
    *capture_guard = Some(capture);
    Ok(())
}

/// Detiene la captura de Framebuffer de la GPU para NDI.
pub fn stop_feed(app: &tauri::AppHandle) -> crate::error::AppResult<()> {
    let state = super::screens::manager(app)?;
    let mut capture_guard = state.ndi_capture.lock_safe();
    if let Some(ref mut capture) = *capture_guard {
        capture.stop();
    }
    *capture_guard = None;
    Ok(())
}

/// Verifica si la captura directa de Framebuffer para NDI está activa.
pub fn is_feed_active(app: &tauri::AppHandle) -> bool {
    super::screens::manager(app)
        .map(|state| {
            state
                .ndi_capture
                .lock_safe()
                .as_ref()
                .map(|c| c.is_active.load(Ordering::Relaxed))
                .unwrap_or(false)
        })
        .unwrap_or(false)
}
