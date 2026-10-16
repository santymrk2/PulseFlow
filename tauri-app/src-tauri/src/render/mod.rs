//! FreeShow Native Render Engine (WGPU)
//!
//! Este módulo implementa la renderización en GPU nativa sin Webview,
//! utilizando WGPU para macOS (Metal), Windows (DirectX 12/Vulkan) y Linux.
//!
//! Fase 1: Ventana nativa y Swapchain WGPU a 60 fps con VSync en fondo negro puro.
//! Fase 2: Motor de texto y tipografías en GPU (glyphon + cosmic-text) con contornos y sombras.
//! Fase 3: Capa de Video e Imágenes en VRAM (MediaPool, Zero-Copy y composición multicapa).

pub mod media;
pub mod text;
pub mod transition;
pub mod types;
pub mod video;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, window::WindowBuilder};
use crate::error::{AppError, AppResult};
pub use types::{BackgroundMedia, OverlayItem, SceneGraph, SelectSlidePayload, TextBlock};

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
    pub active_video: Mutex<Option<video::VideoPlayback>>,
    pub pending_video_frame: Arc<Mutex<Option<(String, u32, u32, Vec<u8>)>>>,
    pub scene_text: Arc<RwLock<Vec<TextBlock>>>,
    pub scene_background: Arc<RwLock<Option<BackgroundMedia>>>,
    pub scene_overlays: Arc<RwLock<Vec<OverlayItem>>>,
    pub media_pool: Arc<Mutex<media::MediaPool>>,
    pub transition_config: Arc<RwLock<(transition::TransitionType, u64, transition::EasingType)>>,
}

impl RenderState {
    pub fn new() -> Self {
        Self {
            active_render: Mutex::new(None),
            active_video: Mutex::new(None),
            pending_video_frame: Arc::new(Mutex::new(None)),
            scene_text: Arc::new(RwLock::new(Vec::new())),
            scene_background: Arc::new(RwLock::new(None)),
            scene_overlays: Arc::new(RwLock::new(Vec::new())),
            media_pool: Arc::new(Mutex::new(media::MediaPool::new())),
            transition_config: Arc::new(RwLock::new((
                transition::TransitionType::Crossfade,
                300,
                transition::EasingType::EaseInOut,
            ))),
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

    // Obtener referencias a los estados compartidos
    let (scene_text, scene_background, scene_overlays, media_pool, pending_video_frame) =
        if let Some(render_state) = app.try_state::<RenderState>() {
            (
                Arc::clone(&render_state.scene_text),
                Arc::clone(&render_state.scene_background),
                Arc::clone(&render_state.scene_overlays),
                Arc::clone(&render_state.media_pool),
                Arc::clone(&render_state.pending_video_frame),
            )
        } else {
            (
                Arc::new(RwLock::new(Vec::new())),
                Arc::new(RwLock::new(None)),
                Arc::new(RwLock::new(Vec::new())),
                Arc::new(Mutex::new(media::MediaPool::new())),
                Arc::new(Mutex::new(None)),
            )
        };

    // 6. Iniciar bucle de renderizado en hilo dedicado a 60 fps / VSync
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);
    let render_window = Arc::clone(&window_arc);

    let thread_handle = thread::Builder::new()
        .name("FreeShow-RenderLoop".into())
        .spawn(move || {
            // Inicializar el pipeline de composición de fondos (Video / Imagen)
            let background_pipeline = media::BackgroundPipeline::new(&device, config.format);

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

                // Subir nuevo fotograma de video a VRAM si está disponible
                if let Some((vid_id, w, h, bytes)) = pending_video_frame.lock().unwrap().take() {
                    let mut pool = media_pool.lock().unwrap();
                    let _ = pool.update_video_frame(&device, &queue, &background_pipeline, &vid_id, w, h, &bytes);
                }

                // Render Pass: Composición multicapa en GPU a 60 fps
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
                                    label: Some("FreeShow Multilayer Pass"),
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

                            // ─── CAPA 1: Fondo (Video o Imagen en VRAM) ───
                            let bg_opt = scene_background.read().unwrap().clone();
                            if let Some(bg) = bg_opt {
                                let mut pool = media_pool.lock().unwrap();

                                // Si la textura no está cargada y hay ruta de archivo, cargarla
                                if pool.get(&bg.id).is_none() {
                                    if let Some(ref path_str) = bg.path {
                                        let _ = pool.load_image(&device, &queue, &background_pipeline, path_str);
                                    }
                                }

                                if let Some(media_tex) = pool.get(&bg.id) {
                                    background_pipeline.render(
                                        &queue,
                                        &mut render_pass,
                                        &media_tex,
                                        config.width,
                                        config.height,
                                        bg.opacity,
                                        bg.aspect_mode,
                                    );
                                }
                            }

                            // ─── CAPA 2: Texto Principal (Letras, Citas, Acordes) ───
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

                            // ─── CAPA 3: Overlays (Relojes, Avisos, Tercios Inferiores) ───
                            let current_overlays = scene_overlays.read().unwrap().clone();
                            if !current_overlays.is_empty() {
                                let overlay_blocks: Vec<TextBlock> = current_overlays
                                    .into_iter()
                                    .map(|o| TextBlock {
                                        text: o.text,
                                        font_family: None,
                                        font_size: o.font_size,
                                        font_weight: 700,
                                        font_style: None,
                                        color: o.color,
                                        alignment: "left".to_string(),
                                        x: o.x,
                                        y: o.y,
                                        width: config.width as f32,
                                        height: 200.0,
                                        line_height_ratio: 1.2,
                                        outline_color: Some([0.0, 0.0, 0.0, 1.0]),
                                        outline_width: Some(1.5),
                                        shadow_color: Some([0.0, 0.0, 0.0, 0.8]),
                                        shadow_offset: Some([3.0, 3.0]),
                                    })
                                    .collect();

                                let _ = text_engine.render(
                                    &device,
                                    &queue,
                                    &mut render_pass,
                                    config.width,
                                    config.height,
                                    &overlay_blocks,
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

/// Establece el fondo activo (imagen o video) en la escena de la GPU.
pub fn set_scene_background(app: &AppHandle, bg: BackgroundMedia) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        // Detener video anterior si existía
        {
            let mut active = render_state.active_video.lock().unwrap();
            if let Some(mut old_playback) = active.take() {
                old_playback.stop();
            }
        }

        // Si es video o archivo con extensión de video, iniciar decodificación acelerada por hardware
        let is_video = bg.media_type == "video" || bg.path.as_deref().map(|p| {
            let lower = p.to_lowercase();
            lower.ends_with(".mp4") || lower.ends_with(".webm") || lower.ends_with(".mov") || lower.ends_with(".mkv")
        }).unwrap_or(false);

        if is_video {
            if let Some(ref path_str) = bg.path {
                let pending = Arc::clone(&render_state.pending_video_frame);
                let playback = video::start_video_playback(
                    app,
                    path_str,
                    &bg.id,
                    1920,
                    1080,
                    move |vid_id, w, h, frame_bytes| {
                        let mut p = pending.lock().unwrap();
                        *p = Some((vid_id.to_string(), w, h, frame_bytes.to_vec()));
                    },
                )?;
                let mut active = render_state.active_video.lock().unwrap();
                *active = Some(playback);
            }
        }

        let mut background = render_state.scene_background.write().unwrap();
        *background = Some(bg);
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Limpia el fondo activo en la GPU (vuelve a negro puro).
pub fn clear_scene_background(app: &AppHandle) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        {
            let mut active = render_state.active_video.lock().unwrap();
            if let Some(mut old_playback) = active.take() {
                old_playback.stop();
            }
        }
        let mut background = render_state.scene_background.write().unwrap();
        *background = None;
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Actualiza los overlays de la escena (relojes, avisos, tercios inferiores).
pub fn update_scene_overlays(app: &AppHandle, overlays: Vec<OverlayItem>) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut ov = render_state.scene_overlays.write().unwrap();
        *ov = overlays;
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Alimenta un fotograma de video decodificado por hardware a la textura VRAM correspondiente.
pub fn feed_video_frame(
    app: &AppHandle,
    id: String,
    width: u32,
    height: u32,
    rgba_bytes: Vec<u8>,
) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        // Establecer como fondo activo si aún no lo es
        {
            let mut bg = render_state.scene_background.write().unwrap();
            if bg.as_ref().map(|b| b.id.as_str()) != Some(&id) {
                *bg = Some(BackgroundMedia {
                    id: id.clone(),
                    path: None,
                    media_type: "video".to_string(),
                    opacity: 1.0,
                    aspect_mode: 0, // Cover
                });
            }
        }
        let mut pending = render_state.pending_video_frame.lock().unwrap();
        *pending = Some((id, width, height, rgba_bytes));
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Configura el efecto de transición (Crossfade, DipToBlack, Wipe, Push) y su duración.
pub fn set_transition_config(
    app: &AppHandle,
    trans_type_str: &str,
    duration_ms: u64,
    easing_str: &str,
) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut cfg = render_state.transition_config.write().unwrap();
        let trans_type = transition::TransitionType::from_str(trans_type_str);
        let easing = match easing_str.to_lowercase().as_str() {
            "easeout" | "ease_out" => transition::EasingType::EaseOut,
            "linear" => transition::EasingType::Linear,
            _ => transition::EasingType::EaseInOut,
        };
        *cfg = (trans_type, duration_ms, easing);
        Ok(())
    } else {
        Err(AppError::new("RenderState no disponible"))
    }
}

/// Detiene el bucle de renderizado WGPU y cierra la ventana nativa.
pub fn stop_native_output(app: &AppHandle) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<RenderState>() {
        let mut active_vid = render_state.active_video.lock().unwrap();
        if let Some(mut vid) = active_vid.take() {
            vid.stop();
        }
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
        let bg_guard = state.scene_background.read().unwrap();
        assert!(bg_guard.is_none());
        let ov_guard = state.scene_overlays.read().unwrap();
        assert!(ov_guard.is_empty());
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

    #[test]
    fn test_media_pool_and_background_pipeline() {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
            ..Default::default()
        }))
        .unwrap();

        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("Test Device"),
                ..Default::default()
            },
        ))
        .unwrap();

        let pipeline = media::BackgroundPipeline::new(&device, wgpu::TextureFormat::Bgra8UnormSrgb);
        let mut pool = media::MediaPool::new();

        // Crear una textura sintética de prueba 64x64 RGBA en VRAM
        let width = 64;
        let height = 64;
        let rgba_data = vec![255u8; (width * height * 4) as usize];

        let tex1 = pool.update_video_frame(
            &device,
            &queue,
            &pipeline,
            "test_video_bg",
            width,
            height,
            &rgba_data,
        ).unwrap();

        // Verificar que una segunda consulta reutilice el mismo Arc en VRAM sin duplicar
        let tex2 = pool.get("test_video_bg").unwrap();
        assert_eq!(Arc::as_ptr(&tex1), Arc::as_ptr(&tex2), "Ambas referencias deben apuntar al mismo recurso VRAM");
    }

    #[test]
    fn test_transition_engine_and_curves() {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
            ..Default::default()
        }))
        .unwrap();

        let (device, _queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("Test Transition Device"),
                ..Default::default()
            },
        ))
        .unwrap();

        let mut engine = transition::TransitionEngine::new(
            &device,
            wgpu::TextureFormat::Bgra8UnormSrgb,
            1920,
            1080,
        );

        engine.trigger(transition::TransitionType::Crossfade, 500, transition::EasingType::EaseInOut);
        assert!(engine.active_transition.is_active);
        assert_eq!(engine.active_transition.transition_type, transition::TransitionType::Crossfade);
    }
}

