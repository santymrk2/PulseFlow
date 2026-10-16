//! Motor de Stage Display (Retorno de escenario) en GPU.
//!
//! Renderiza una vista independiente de alto contraste a 60 fps en monitor secundario:
//! - Fondo negro puro (sin distracciones).
//! - Diapositiva actual en amarillo de alto contraste.
//! - Diapositiva siguiente en gris claro (anticipación para músicos y cantantes).
//! - Reloj o temporizador en tiempo real.
//! - Alertas o mensajes pastorales en la parte inferior.

use super::sync::{MutexExt, RwLockExt};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, window::WindowBuilder};
use crate::error::{AppError, AppResult};
use crate::render::text::TextEngine;
use crate::render::types::{StageData, TextBlock};

/// Etiqueta única para la ventana de salida de Stage nativa.
pub const NATIVE_STAGE_LABEL: &str = "native-stage";

/// Hilo de renderizado del Stage Display.
pub struct StageRenderThread {
    running: Arc<AtomicBool>,
    thread_handle: Option<JoinHandle<()>>,
}

impl StageRenderThread {
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

/// Inicia la ventana de Stage Display nativa en el monitor asignado.
pub fn start_native_stage(
    app: &AppHandle,
    display_index: Option<usize>,
    fullscreen_opt: Option<bool>,
    stage_data: Arc<RwLock<StageData>>,
) -> AppResult<bool> {
    if let Some(window) = app.get_window(NATIVE_STAGE_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(window.is_fullscreen().unwrap_or(false));
    }

    let monitors = app.available_monitors().unwrap_or_default();
    let display = display_index.unwrap_or(0);
    let target_monitor = monitors.get(display).or_else(|| monitors.first());
    let fullscreen = fullscreen_opt.unwrap_or(false);

    // Crear la ventana nativa de Tauri (SIN Webview)
    let window = WindowBuilder::new(app, NATIVE_STAGE_LABEL)
        .title("PulseFlow — Stage Display (GPU Engine)")
        .decorations(true)
        .resizable(true)
        .visible(false)
        .build()
        .map_err(|e| AppError::new(format!("Error creando ventana de Stage: {e}")))?;

    if let Some(monitor) = target_monitor {
        let position = monitor.position();
        let size = monitor.size();

        if fullscreen {
            let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
            let _ = window.set_fullscreen(true);
        } else {
            let width = ((size.width as f64) * 0.55).max(720.0) as u32;
            let height = ((size.height as f64) * 0.65).max(480.0) as u32;
            let x = position.x + (size.width.saturating_sub(width) / 2) as i32;
            let y = position.y + (size.height.saturating_sub(height) / 2) as i32;
            let _ = window.set_size(PhysicalSize::new(width, height));
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }

    let window_arc = Arc::new(window);

    // 1. Instancia WGPU y Surface
    let instance = wgpu::Instance::default();
    let surface = instance
        .create_surface(Arc::clone(&window_arc))
        .map_err(|e| AppError::new(format!("Error creando WGPU Surface para Stage: {e}")))?;

    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: Some(&surface),
        force_fallback_adapter: false,
        ..Default::default()
    }))
    .map_err(|e| AppError::new(format!("No se encontró GPU para Stage Display: {e}")))?;

    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("PulseFlow Stage Device"),
            ..Default::default()
        },
    ))
    .map_err(|e| AppError::new(format!("Error inicializando dispositivo WGPU para Stage: {e}")))?;

    // 2. Configurar Swapchain a 60 fps
    let initial_size = window_arc.inner_size().unwrap_or(PhysicalSize::new(1280, 720));
    let width = initial_size.width.max(1);
    let height = initial_size.height.max(1);

    let mut config = surface
        .get_default_config(&adapter, width, height)
        .ok_or_else(|| AppError::new("Superficie de Stage incompatible"))?;
    config.present_mode = wgpu::PresentMode::Fifo; // 60 fps VSync
    config.width = width;
    config.height = height;

    surface.configure(&device, &config);

    let _ = window_arc.show();
    let _ = window_arc.set_focus();

    // 3. Iniciar bucle de renderizado de Stage en hilo dedicado
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);
    let render_window = Arc::clone(&window_arc);

    let thread_handle = thread::Builder::new()
        .name("PulseFlow-StageLoop".into())
        .spawn(move || {
            let mut text_engine = TextEngine::new(&device, &queue, config.format);

            while running_clone.load(Ordering::Relaxed) {
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

                match surface.get_current_texture() {
                    wgpu::CurrentSurfaceTexture::Success(frame)
                    | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => {
                        let view = frame
                            .texture
                            .create_view(&wgpu::TextureViewDescriptor::default());

                        let mut encoder = device.create_command_encoder(
                            &wgpu::CommandEncoderDescriptor {
                                label: Some("PulseFlow Stage Encoder"),
                            },
                        );

                        {
                            let mut render_pass =
                                encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                                    label: Some("PulseFlow Stage Render Pass"),
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

                            // Construir layout de alto contraste para músicos y predicadores
                            let data = stage_data.read_safe().clone();
                            let w = config.width as f32;
                            let h = config.height as f32;

                            let mut stage_blocks = Vec::new();

                            // 1. Reloj / Timer en la esquina superior derecha
                            let clock_text = data.clock.unwrap_or_else(|| {
                                chrono::Local::now().format("%H:%M:%S").to_string()
                            });
                            stage_blocks.push(TextBlock {
                                text: clock_text,
                                font_family: None,
                                font_size: (h * 0.06).clamp(24.0, 48.0),
                                font_weight: 700,
                                font_style: None,
                                color: [0.3, 0.9, 0.3, 1.0], // Verde brillante
                                alignment: "right".to_string(),
                                x: 40.0,
                                y: 30.0,
                                width: w - 80.0,
                                height: 60.0,
                                line_height_ratio: 1.2,
                                outline_color: None,
                                outline_width: None,
                                shadow_color: None,
                                shadow_offset: None,
                                ..Default::default()
                            });

                            // 2. Diapositiva Actual (Amarillo brillante, grande)
                            if !data.current_slide.is_empty() {
                                stage_blocks.push(TextBlock {
                                    text: data.current_slide,
                                    font_family: None,
                                    font_size: (h * 0.08).clamp(32.0, 72.0),
                                    font_weight: 700,
                                    font_style: None,
                                    color: [1.0, 0.92, 0.23, 1.0], // Amarillo vibrante
                                    alignment: "left".to_string(),
                                    x: 50.0,
                                    y: h * 0.16,
                                    width: w - 100.0,
                                    height: h * 0.40,
                                    line_height_ratio: 1.25,
                                    outline_color: None,
                                    outline_width: None,
                                    shadow_color: None,
                                    shadow_offset: None,
                                    ..Default::default()
                                });
                            }

                            // 3. Siguiente Diapositiva (Gris claro para anticipación)
                            if let Some(ref next) = data.next_slide {
                                if !next.is_empty() {
                                    stage_blocks.push(TextBlock {
                                        text: format!("SIGUIENTE: {}", next),
                                        font_family: None,
                                        font_size: (h * 0.05).clamp(20.0, 40.0),
                                        font_weight: 600,
                                        font_style: None,
                                        color: [0.7, 0.7, 0.7, 1.0], // Gris claro
                                        alignment: "left".to_string(),
                                        x: 50.0,
                                        y: h * 0.62,
                                        width: w - 100.0,
                                        height: h * 0.25,
                                        line_height_ratio: 1.2,
                                        outline_color: None,
                                        outline_width: None,
                                        shadow_color: None,
                                        shadow_offset: None,
                                        ..Default::default()
                                    });
                                }
                            }

                            // 4. Mensaje / Alerta Pastoral (Rojo/Naranja)
                            if let Some(ref msg) = data.message {
                                if !msg.is_empty() {
                                    stage_blocks.push(TextBlock {
                                        text: msg.clone(),
                                        font_family: None,
                                        font_size: (h * 0.05).clamp(20.0, 36.0),
                                        font_weight: 700,
                                        font_style: None,
                                        color: [1.0, 0.3, 0.2, 1.0], // Rojo anaranjado
                                        alignment: "center".to_string(),
                                        x: 50.0,
                                        y: h * 0.90,
                                        width: w - 100.0,
                                        height: 50.0,
                                        line_height_ratio: 1.2,
                                        outline_color: None,
                                        outline_width: None,
                                        shadow_color: None,
                                        shadow_offset: None,
                                        ..Default::default()
                                    });
                                }
                            }

                            let _ = text_engine.render(
                                &device,
                                &queue,
                                &mut render_pass,
                                config.width,
                                config.height,
                                &stage_blocks,
                            );
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
                        thread::sleep(Duration::from_millis(16));
                    }
                }
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando render loop de Stage: {e}")))?;

    // Guardar en el estado de Tauri
    if let Some(render_state) = app.try_state::<crate::render::RenderState>() {
        let mut active = render_state.active_stage.lock_safe();
        if let Some(mut old_thread) = active.take() {
            old_thread.stop();
        }
        *active = Some(StageRenderThread {
            running,
            thread_handle: Some(thread_handle),
        });
    }

    Ok(fullscreen)
}

/// Detiene el bucle de Stage y cierra la ventana nativa.
pub fn stop_native_stage(app: &AppHandle) -> AppResult<()> {
    if let Some(render_state) = app.try_state::<crate::render::RenderState>() {
        let mut active = render_state.active_stage.lock_safe();
        if let Some(mut thread) = active.take() {
            thread.stop();
        }
    }

    if let Some(window) = app.get_window(NATIVE_STAGE_LABEL) {
        let _ = window.close();
    }

    Ok(())
}

/// Verifica si la ventana de Stage está abierta.
pub fn is_native_stage_open(app: &AppHandle) -> bool {
    app.get_window(NATIVE_STAGE_LABEL).is_some()
}
