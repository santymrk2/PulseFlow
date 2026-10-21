//! Contexto GPU único del engine: una sola `Instance`/`Adapter`/`Device`/`Queue`
//! para todas las pantallas (F17).
//!
//! Las superficies de cada ventana se crean desde `GpuContext::instance`, de modo
//! que todas las salidas dibujan con el mismo `Device` y pueden compartir texturas
//! (imágenes, fotogramas de video) sin duplicar VRAM.
//!
//! Backend fijo por plataforma: Metal en macOS, DirectX 12 en Windows (el interop
//! de video nativo de F18 lo exige).
//!
//! **Pérdida del dispositivo**: en Windows (DirectX 12) y al suspender la pantalla,
//! el driver puede perder el `Device`. Cuando eso pasa, el contexto se reabre
//! (`reopen`) sobre la misma `Instance` y el mismo `Adapter` — así las superficies
//! siguen siendo válidas y sólo hay que reconfigurarlas y rehacer los pipelines.
//! El contexto vivo se guarda en un `ArcSwapOption`: se puede reemplazar de forma
//! atómica y sin locks para los hilos de render.

use crate::error::{AppError, AppResult};
use super::sync::MutexExt;
use arc_swap::ArcSwapOption;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Cuántos `Device` se abrieron para el contexto compartido (sólo tests: debe quedar en 1).
/// Los dispositivos de reapertura tras una pérdida no cuentan: es lo esperado.
#[cfg(test)]
pub(crate) static DEVICES_CREATED: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

pub struct GpuContext {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    /// El driver perdió el dispositivo: hay que reabrirlo.
    lost: Arc<AtomicBool>,
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

        Self::with_device(instance, adapter)
    }

    /// Abre el dispositivo (y su cola) sobre la instance y el adaptador dados.
    fn with_device(instance: wgpu::Instance, adapter: wgpu::Adapter) -> AppResult<Arc<Self>> {
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("PulseFlow Shared Device"),
            // NV12 como textura de wgpu (planos por vista): lo usa el video nativo de Windows (F18.6)
            required_features: adapter.features() & wgpu::Features::TEXTURE_FORMAT_NV12,
            ..Default::default()
        }))
        .map_err(|e| AppError::new(format!("Error inicializando el dispositivo WGPU: {e}")))?;

        // El driver avisa cuando pierde el dispositivo: desde ese momento el contexto
        // está muerto y hay que reabrirlo (y rehacer pipelines, texturas y superficies).
        let lost = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&lost);
        device.set_device_lost_callback(move |reason, message| {
            log::warn!("[gpu] el driver perdió el dispositivo ({reason:?}): {message}");
            flag.store(true, Ordering::SeqCst);
        });

        Ok(Arc::new(Self { instance, adapter, device, queue, lost }))
    }

    /// Reabre el dispositivo sobre la misma `Instance` y el mismo `Adapter`.
    ///
    /// Las superficies no dependen del dispositivo (dependen de la instance), así que
    /// siguen siendo válidas: el llamante sólo tiene que reconfigurarlas y rehacer
    /// los pipelines y las texturas, que sí eran del dispositivo perdido.
    pub fn reopen(&self) -> AppResult<Arc<Self>> {
        Self::with_device(self.instance.clone(), self.adapter.clone())
    }

    /// `true` si el driver perdió el dispositivo: el contexto ya no sirve para dibujar.
    pub fn is_lost(&self) -> bool {
        self.lost.load(Ordering::SeqCst)
    }

    /// `true` si el adaptador puede presentar en `surface`.
    pub fn supports_surface(&self, surface: &wgpu::Surface) -> bool {
        !surface.get_capabilities(&self.adapter).formats.is_empty()
    }

    /// Marca el contexto como perdido (sólo tests: simula la pérdida del driver).
    #[cfg(test)]
    pub(crate) fn mark_lost(&self) {
        self.lost.store(true, Ordering::SeqCst);
    }
}

fn platform_backends() -> wgpu::Backends {
    if cfg!(target_os = "macos") {
        wgpu::Backends::METAL
    } else {
        wgpu::Backends::DX12
    }
}

/// Contexto GPU vivo del proceso. Se puede reemplazar (pérdida del dispositivo) sin
/// locks: los hilos de render cargan el contexto actual con una lectura atómica.
static SHARED: ArcSwapOption<GpuContext> = ArcSwapOption::const_empty();
/// Serializa la creación para que dos hilos no abran dos `Device`.
static INIT: Mutex<()> = Mutex::new(());

/// Contexto GPU del proceso. Siempre el mismo, salvo que el driver pierda el
/// dispositivo: en ese caso se reabre y se devuelve el nuevo.
pub fn shared() -> AppResult<Arc<GpuContext>> {
    if let Some(ctx) = SHARED.load_full() {
        if !ctx.is_lost() {
            return Ok(ctx);
        }
        log::warn!("[gpu] el dispositivo se perdió: se reabre el contexto");
    }
    recreate_gpu_context()
}

/// Reabre el contexto GPU (tras una pérdida del dispositivo) y lo deja como el vivo.
///
/// Sólo un hilo crea el dispositivo nuevo (los demás esperan el lock y usan el que
/// quedó), así que dos pantallas que detectan la pérdida a la vez no abren dos
/// dispositivos.
pub fn recreate_gpu_context() -> AppResult<Arc<GpuContext>> {
    let _guard = INIT.lock_safe();
    // Otro hilo puede haberlo reabierto mientras se esperaba el lock.
    if let Some(ctx) = SHARED.load_full()
        && !ctx.is_lost()
    {
        return Ok(ctx);
    }

    let reopened = match SHARED.load_full() {
        // Se reaprovecha la instance y el adaptador: las superficies siguen valiendo.
        Some(old) => old.reopen()?,
        None => {
            #[cfg(test)]
            DEVICES_CREATED.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            GpuContext::new()?
        }
    };

    SHARED.store(Some(Arc::clone(&reopened)));
    Ok(reopened)
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

    #[test]
    fn a_lost_device_is_detected_and_can_be_reopened() {
        // Contexto propio (no el compartido): no toca el estado global del proceso.
        let context = GpuContext::new().expect("GPU disponible");
        assert!(!context.is_lost(), "un contexto recién abierto está sano");

        context.mark_lost();
        assert!(context.is_lost(), "la pérdida del driver tiene que verse");

        // Al reabrirlo se abre un dispositivo nuevo sobre la misma instance y el
        // mismo adaptador: las superficies siguen siendo válidas.
        let reopened = context.reopen().expect("reabrir el dispositivo");
        assert!(!reopened.is_lost());
        assert!(!Arc::ptr_eq(&context, &reopened), "el dispositivo debería ser otro");
        assert_eq!(reopened.adapter.get_info().name, context.adapter.get_info().name);
    }
}
