//! Contexto GPU único del engine: una sola `Instance`/`Adapter`/`Device`/`Queue`
//! para todas las pantallas (F17).
//!
//! Las superficies de cada ventana se crean desde `GpuContext::instance`, de modo
//! que todas las salidas dibujan con el mismo `Device` y pueden compartir texturas
//! (imágenes, fotogramas de video) sin duplicar VRAM.
//!
//! Backend fijo por plataforma: Metal en macOS, DirectX 12 en Windows (el interop
//! de video nativo de F18 lo exige).

use crate::error::{AppError, AppResult};
use super::sync::MutexExt;
use std::sync::{Arc, Mutex, OnceLock};

/// Cuántos `Device` se abrieron en el proceso (sólo tests: debe quedar en 1).
#[cfg(test)]
pub(crate) static DEVICES_CREATED: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

pub struct GpuContext {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
}

impl GpuContext {
    /// Crea un contexto nuevo. Sin superficie compatible: cada ventana valida la
    /// suya con `supports_surface`. Fuera de tests, usar `shared()`.
    pub fn new() -> AppResult<Arc<Self>> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: platform_backends(),
            ..wgpu::InstanceDescriptor::new_without_display_handle()
        });
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
            ..Default::default()
        }))
        .map_err(|e| AppError::new(format!("No se encontró una GPU compatible: {e}")))?;

        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("PulseFlow Shared Device"),
            // NV12 como textura de wgpu (planos por vista): lo usa el video nativo de Windows (F18.6)
            required_features: adapter.features() & wgpu::Features::TEXTURE_FORMAT_NV12,
            ..Default::default()
        }))
        .map_err(|e| AppError::new(format!("Error inicializando el dispositivo WGPU: {e}")))?;

        #[cfg(test)]
        DEVICES_CREATED.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        Ok(Arc::new(Self { instance, adapter, device, queue }))
    }

    /// `true` si el adaptador puede presentar en `surface`.
    pub fn supports_surface(&self, surface: &wgpu::Surface) -> bool {
        !surface.get_capabilities(&self.adapter).formats.is_empty()
    }
}

fn platform_backends() -> wgpu::Backends {
    if cfg!(target_os = "macos") {
        wgpu::Backends::METAL
    } else {
        wgpu::Backends::DX12
    }
}

static SHARED: OnceLock<Arc<GpuContext>> = OnceLock::new();
/// Serializa la primera creación para que dos hilos no abran dos `Device`.
static INIT: Mutex<()> = Mutex::new(());

/// Contexto GPU del proceso: siempre la misma `Arc`.
pub fn shared() -> AppResult<Arc<GpuContext>> {
    if let Some(ctx) = SHARED.get() {
        return Ok(Arc::clone(ctx));
    }
    let _guard = INIT.lock_safe();
    if let Some(ctx) = SHARED.get() {
        return Ok(Arc::clone(ctx));
    }
    let ctx = GpuContext::new()?;
    Ok(Arc::clone(SHARED.get_or_init(|| ctx)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_context_is_singleton() {
        let a = shared().expect("GPU disponible");
        let b = shared().expect("GPU disponible");
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn context_creates_offscreen_texture() {
        let gpu = shared().expect("GPU disponible");
        let texture = gpu.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("test"),
            size: wgpu::Extent3d { width: 4, height: 4, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        assert_eq!(texture.width(), 4);
    }

    #[test]
    fn concurrent_screens_open_a_single_device() {
        let handles: Vec<_> = (0..8)
            .map(|_| std::thread::spawn(|| shared().expect("GPU disponible")))
            .collect();
        let contexts: Vec<_> = handles.into_iter().map(|h| h.join().expect("hilo")).collect();
        assert!(contexts.windows(2).all(|w| Arc::ptr_eq(&w[0], &w[1])));
        assert_eq!(DEVICES_CREATED.load(std::sync::atomic::Ordering::SeqCst), 1);
    }
}
