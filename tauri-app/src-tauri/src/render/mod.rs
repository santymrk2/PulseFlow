//! FreeShow Native Render Engine (WGPU)
//!
//! Este módulo implementa la renderización en GPU nativa sin Webview,
//! utilizando WGPU para macOS (Metal), Windows (DirectX 12/Vulkan) y Linux.
//!
//! Fase 1: Ventana nativa y Swapchain WGPU a 60 fps con VSync en fondo negro puro.
//! Fase 2: Motor de texto y tipografías en GPU (glyphon + cosmic-text) con contornos y sombras.

pub mod text;
pub mod types;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, window::WindowBuilder};
use crate::error::{AppError, AppResult};
pub use types::{TextBlock, SelectSlidePayload, SceneGraph};

/// Etiqueta única para la ventana de salida nativa WGPU.
pub const NATIVE_OUTPUT_LABEL: &str = "native-output";

/// Hilo de renderizado dedicado y su controlador de parada.
pub struct RenderThread {
    running: Arc<AtomicBool>,
    thread_handle: Option<JoinHandle<()>>,
}

impl RenderThread {
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

/// Estado global del motor de renderizado GPU de FreeShow.
pub struct RenderState {
    pub active_render: Mutex<Option<RenderThread>>,
    pub scene_text: Arc<RwLock<Vec<TextBlock>>>,
}

impl RenderState {
    pub fn new() -> Self {
        Self {
            active_render: Mutex::new(None),
            scene_text: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl Default for RenderState {
    fn default() -> Self {
        Self::new()
    }
}

/// Inicia la ventana nativa sin Webview y el bucle de renderizado WGPU a 60 fps.
pub fn start_native_output(
    app: &AppHandle,
    display_index: Option<usize>,
    fullscreen_opt: Option<bool>,
) -> AppResult<bool> {
    // Si ya existe la ventana y el render loop activo, traerla al frente
    if let Some(window) = app.get_window(NATIVE_OUTPUT_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(window.is_fullscreen().unwrap_or(false));
    }

    let monitors = app.available_monitors().unwrap_or_default();
    let display = display_index.unwrap_or_else(|| if monitors.len() > 1 { 1 } else { 0 });
    let target_monitor = monitors.get(display).or_else(|| monitors.first());
    let fullscreen = fullscreen_opt.unwrap_or(monitors.len() > 1);

    // Crear la ventana nativa de Tauri pura (SIN Webview)
    let window = WindowBuilder::new(app, NATIVE_OUTPUT_LABEL)
        .title("FreeShow — Native Output (GPU Engine)")
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .build()
        .map_err(|e| AppError::new(format!("Error al crear ventana nativa: {e}")))?;

    // Posicionamiento en el monitor secundario o seleccionado
    if let Some(monitor) = target_monitor {
        let position = monitor.position();
        let size = monitor.size();

        if fullscreen {
            let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
            let _ = window.set_fullscreen(true);
        } else {
            let width = ((size.width as f64) * 0.62).max(640.0) as u32;
            let height = ((size.height as f64) * 0.62).max(360.0) as u32;
            let x = position.x + (size.width.saturating_sub(width) / 2) as i32;
            let y = position.y + (size.height.saturating_sub(height) / 2) as i32;
            let _ = window.set_size(PhysicalSize::new(width, height));
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }

    let window_arc = Arc::new(window);

    // 1. Inicializar WGPU Instance
    let instance = wgpu::Instance::default();

    // 2. Crear Surface enlazado al handle nativo de la ventana
    let surface = instance
        .create_surface(Arc::clone(&window_arc))
        .map_err(|e| AppError::new(format!("Error creando WGPU Surface: {e}")))?;

    // 3. Seleccionar Adapter (GPU de alto rendimiento)
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: Some(&surface),
        force_fallback_adapter: false,
        ..Default::default()
    }))
    .map_err(|e| AppError::new(format!("No se encontró adaptador GPU compatible: {e}")))?;

    // 4. Solicitar Device y Queue
    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("FreeShow Render Device"),
            ..Default::default()
        },
    ))
    .map_err(|e| AppError::new(format!("Error inicializando dispositivo WGPU: {e}")))?;

    // 5. Configurar el Swapchain (Surface) con VSync activo (Fifo)
    let initial_size = window_arc.inner_size().unwrap_or(PhysicalSize::new(1920, 1080));
    let width = initial_size.width.max(1);
    let height = initial_size.height.max(1);

    let mut config = surface
        .get_default_config(&adapter, width, height)
        .ok_or_else(|| AppError::new("La superficie no es compatible con el adaptador GPU"))?;
    config.present_mode = wgpu::PresentMode::Fifo; // 60 fps con sincronización vertical (VSync)
    config.width = width;
    config.height = height;

    surface.configure(&device, &config);

    let _ = window_arc.show();
    let _ = window_arc.set_focus();

    // Obtener referencia al estado de texto compartido
    let scene_text = if let Some(render_state) = app.try_state::<RenderState>() {
        Arc::clone(&render_state.scene_text)
    } else {
        Arc::new(RwLock::new(Vec::new()))
    };

    // 6. Iniciar bucle de renderizado en hilo dedicado a 60 fps / VSync
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);
    let render_window = Arc::clone(&window_arc);

    let thread_handle = thread::Builder::new()
        .name("FreeShow-RenderLoop".into())
        .spawn(move || {
            // Inicializar el motor tipográfico WGPU (glyphon + cosmic-text)
            let mut text_engine = text::TextEngine::new(&device, &queue, config.format);

            while running_clone.load(Ordering::Relaxed) {
                // Verificar si cambió el tamaño de la ventana
                if let Ok(current_size) = render_window.inner_size() {
                    if current_size.width > 0
                        && current_size.height > 0
                        && (current_size.width != config.width || current_size.height != config.height)
                    {
                        config.width = current_size.width;
                        config.height = current_size.height;
                        surface.configure(&device, &config);
                    }
                }

                // Render Pass: Limpieza a negro puro y renderizado tipográfico por GPU
                match surface.get_current_texture() {
                    wgpu::CurrentSurfaceTexture::Success(frame)
                    | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => {
                        let view = frame
                            .texture
                            .create_view(&wgpu::TextureViewDescriptor::default());

                        let mut encoder = device.create_command_encoder(
                            &wgpu::CommandEncoderDescriptor {
                                label: Some("FreeShow Frame Clear Encoder"),
                            },
                        );

                        {
                            let mut render_pass =
                                encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                                    label: Some("FreeShow Base Render Pass"),
                                    color_attachments: &[Some(
                                        wgpu::RenderPassColorAttachment {
                                            view: &view,
                                            resolve_target: None,
                                            ops: wgpu::Operations {
                                                load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                                                store: wgpu::StoreOp::Store,
                                            },
                                            depth_slice: None,
                                        },
                                    )],
                                    depth_stencil_attachment: None,
                                    timestamp_writes: None,
                                    occlusion_query_set: None,
                                    multiview_mask: None,
                                });

                            // Obtener bloques de texto actuales y renderizarlos en la GPU
                            let current_blocks = scene_text.read().unwrap().clone();
                            if !current_blocks.is_empty() {
                                let _ = text_engine.render(
                                    &device,
                                    &queue,
                                    &mut render_pass,
                                    config.width,
                                    config.height,
                                    &current_blocks,
                                );
                            }
                        }

                        queue.submit([encoder.finish()]);
                        queue.present(frame);
                    }
                    wgpu::CurrentSurfaceTexture::Timeout => {
                        thread::sleep(Duration::from_millis(1));
                    }
                    wgpu::CurrentSurfaceTexture::Occluded => {
                        thread::sleep(Duration::from_millis(16));
                    }
                    wgpu::CurrentSurfaceTexture::Outdated => {
                        if let Ok(new_size) = render_window.inner_size() {
                            if new_size.width > 0 && new_size.height > 0 {
                                config.width = new_size.width;
                                config.height = new_size.height;
                                surface.configure(&device, &config);
                            }
                        }
                    }
                    wgpu::CurrentSurfaceTexture::Lost => {
                        surface.configure(&device, &config);
                    }
                    wgpu::CurrentSurfaceTexture::Validation => {
                        eprintln!("[FreeShow WGPU Engine] Error de validación en swapchain");
                        thread::sleep(Duration::from_millis(16));
                    }
                }
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando hilo de render: {e}")))?;

    // Guardar el hilo en el estado global para poder gestionarlo
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut active = render_state.active_render.lock().unwrap();
        if let Some(mut old_thread) = active.take() {
            old_thread.stop();
        }
        *active = Some(RenderThread {
            running,
            thread_handle: Some(thread_handle),
        });
    }

    Ok(fullscreen)
}

/// Actualiza los bloques de texto de la escena en el motor GPU en menos de 1 milisegundo.
pub fn update_scene_text(app: &AppHandle, blocks: Vec<TextBlock>) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut text = render_state.scene_text.write().unwrap();
        *text = blocks;
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Limpia todos los bloques de texto proyectados en el motor GPU.
pub fn clear_scene_text(app: &AppHandle) -> AppResult<()> {
    update_scene_text(app, Vec::new())
}

/// Detiene el bucle de renderizado WGPU y cierra la ventana nativa.
pub fn stop_native_output(app: &AppHandle) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut active = render_state.active_render.lock().unwrap();
        if let Some(mut thread) = active.take() {
            thread.stop();
        }
    }

    if let Some(window) = app.get_window(NATIVE_OUTPUT_LABEL) {
        let _ = window.close();
    }

    Ok(())
}

/// Verifica si la ventana nativa de salida está abierta y activa.
pub fn is_native_output_open(app: &AppHandle) -> bool {
    app.get_window(NATIVE_OUTPUT_LABEL).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_state_initialization() {
        let state = RenderState::new();
        let guard = state.active_render.lock().unwrap();
        assert!(guard.is_none());
        let text_guard = state.scene_text.read().unwrap();
        assert!(text_guard.is_empty());
    }

    #[test]
    fn test_wgpu_instance_and_adapter() {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
            ..Default::default()
        }));
        assert!(adapter.is_ok(), "Debe existir al menos un adaptador GPU disponible");
        let adapter = adapter.unwrap();
        let info = adapter.get_info();
        println!("GPU detectada para FreeShow: {} ({:?})", info.name, info.backend);
        assert!(!info.name.is_empty());
    }

    #[test]
    fn test_font_atlas_and_text_block() {
        let atlas = text::FontAtlas::new();
        assert!(atlas.font_system.db().len() > 0, "Debe cargar fuentes del sistema");

        let block = TextBlock {
            text: "Dios es amor y gracia eterna".to_string(),
            font_family: Some("Inter".to_string()),
            font_size: 64.0,
            font_weight: 700,
            font_style: None,
            color: [1.0, 1.0, 1.0, 1.0],
            alignment: "center".to_string(),
            x: 100.0,
            y: 200.0,
            width: 1720.0,
            height: 800.0,
            line_height_ratio: 1.3,
            outline_color: Some([0.0, 0.0, 0.0, 1.0]),
            outline_width: Some(2.0),
            shadow_color: Some([0.0, 0.0, 0.0, 0.7]),
            shadow_offset: Some([4.0, 4.0]),
        };

        assert_eq!(block.font_size, 64.0);
        assert_eq!(block.outline_width, Some(2.0));
    }
}
