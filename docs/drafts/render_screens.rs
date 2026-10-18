// BORRADOR SIN COMPILAR NI PROBAR — referencia para la tarea F2 de docs/ROADMAP.md.
// No está incluido en el crate. Copiar/adaptar a src-tauri/src/render/ y verificar con cargo check.

//! Pantallas de salida del engine nativo (estilo ProPresenter: *Audience* y *Stage*).
//!
//! Cada salida configurada en el frontend (`outputs` de Svelte) es una **pantalla**
//! con su propia ventana nativa sin webview, su propio bucle WGPU y su propia
//! escena. El frontend decide qué ve cada pantalla (Looks / estilos) y manda la
//! escena ya resuelta con `RENDER_SCENE`; aquí sólo se dibuja.
//!
//! - **Audiencia**: fondo (imagen/video) + bloques de texto de la slide.
//! - **Stage**: vista de alto contraste con slide actual, siguiente, reloj y mensaje.
//!
//! La ventana se ubica en el monitor que contiene los `bounds` de la salida. Si ese
//! monitor es el de la ventana de control, se abre en modo ventana (para no tapar
//! la UI); en cualquier otro monitor cubre la pantalla completa.

use super::media::{BackgroundPipeline, MediaPool};
use super::sync::{MutexExt, RwLockExt};
use super::text::TextEngine;
use super::types::{BackgroundMedia, StageData, TextBlock};
use super::video::{self, VideoPlayback};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::window::{Monitor, Window, WindowBuilder};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WindowEvent};

/// Prefijo de las etiquetas de ventana de las pantallas.
const SCREEN_LABEL_PREFIX: &str = "screen-";
/// Prefijo de las ventanas temporales de "Identificar pantallas".
const IDENTIFY_LABEL_PREFIX: &str = "identify-";
/// Etiqueta de la ventana de control (webview principal).
const MAIN_WINDOW_LABEL: &str = "main";

/// Tipo de pantalla.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScreenKind {
    Audience,
    Stage,
}

/// Rectángulo en píxeles físicos (mismo sistema que `GET_DISPLAYS`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct ScreenRect {
    #[serde(default)]
    pub x: i32,
    #[serde(default)]
    pub y: i32,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
}

impl ScreenRect {
    fn center(&self) -> (i64, i64) {
        (
            self.x as i64 + self.width as i64 / 2,
            self.y as i64 + self.height as i64 / 2,
        )
    }

    fn of_monitor(monitor: &Monitor) -> Self {
        let position = monitor.position();
        let size = monitor.size();
        Self {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        }
    }

    fn contains(&self, (px, py): (i64, i64)) -> bool {
        px >= self.x as i64
            && py >= self.y as i64
            && px < self.x as i64 + self.width as i64
            && py < self.y as i64 + self.height as i64
    }
}

/// Configuración de una pantalla, tal como llega del frontend (`Output` de Svelte).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScreenConfig {
    pub id: String,
    pub name: String,
    pub bounds: Option<ScreenRect>,
    /// Índice del monitor elegido en "Elegir pantalla" (string en el frontend).
    pub screen: Option<serde_json::Value>,
    /// Id del layout de stage: si existe, la pantalla es de tipo Stage.
    pub stage_output: Option<serde_json::Value>,
    pub always_on_top: Option<bool>,
    pub enabled: Option<bool>,
    pub invisible: Option<bool>,
}

impl ScreenConfig {
    pub fn kind(&self) -> ScreenKind {
        let is_stage = match &self.stage_output {
            Some(serde_json::Value::String(s)) => !s.is_empty(),
            Some(serde_json::Value::Bool(b)) => *b,
            _ => false,
        };
        if is_stage { ScreenKind::Stage } else { ScreenKind::Audience }
    }

    fn screen_index(&self) -> Option<usize> {
        match &self.screen {
            Some(serde_json::Value::String(s)) => s.parse().ok(),
            Some(serde_json::Value::Number(n)) => n.as_u64().map(|n| n as usize),
            _ => None,
        }
    }
}

/// Fotograma de video pendiente de subir a VRAM: (id, ancho, alto, RGBA).
pub type VideoFrame = (String, u32, u32, Vec<u8>);

/// Contenido actual de una pantalla.
#[derive(Debug, Clone, Default)]
pub struct ScreenScene {
    pub text: Vec<TextBlock>,
    pub background: Option<BackgroundMedia>,
    pub stage: StageData,
    /// Número grande centrado ("Identificar pantallas").
    pub identify: Option<String>,
}

/// Pantalla abierta: ventana + hilo de render + video de fondo.
struct ScreenHandle {
    kind: ScreenKind,
    label: String,
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    video_frame: Arc<Mutex<Option<VideoFrame>>>,
    video: Option<(String, VideoPlayback)>,
}

impl ScreenHandle {
    fn stop(&mut self) {
        if let Some((_, mut playback)) = self.video.take() {
            playback.stop();
        }
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

/// Estado de todas las pantallas del engine.
#[derive(Default)]
pub struct ScreenManager {
    /// Escena por id de salida. Se conserva aunque la pantalla esté cerrada, para
    /// que al abrirla muestre de inmediato el contenido actual.
    scenes: Mutex<HashMap<String, Arc<RwLock<ScreenScene>>>>,
    screens: Mutex<HashMap<String, ScreenHandle>>,
}

impl ScreenManager {
    pub fn new() -> Self {
        Self::default()
    }

    fn scene(&self, id: &str) -> Arc<RwLock<ScreenScene>> {
        let mut scenes = self.scenes.lock_safe();
        Arc::clone(scenes.entry(id.to_string()).or_default())
    }

    pub fn is_open(&self, id: &str) -> bool {
        self.screens.lock_safe().contains_key(id)
    }

    pub fn open_ids(&self) -> Vec<String> {
        self.screens.lock_safe().keys().cloned().collect()
    }
}

fn manager(app: &AppHandle) -> AppResult<tauri::State<'_, ScreenManager>> {
    app.try_state::<ScreenManager>()
        .ok_or_else(|| AppError::new("ScreenManager no disponible"))
}

fn screen_label(id: &str) -> String {
    let safe: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    format!("{SCREEN_LABEL_PREFIX}{safe}")
}

// ---------------------------------------------------------------------------
// Monitores
// ---------------------------------------------------------------------------

/// Monitor de la salida: el que contiene el centro de sus `bounds`, si no el
/// elegido por índice, si no el secundario (o el único).
fn target_monitor(monitors: &[Monitor], config: &ScreenConfig) -> Option<Monitor> {
    if let Some(bounds) = config.bounds.filter(|b| b.width > 0 && b.height > 0) {
        let center = bounds.center();
        if let Some(m) = monitors.iter().find(|m| ScreenRect::of_monitor(m).contains(center)) {
            return Some(m.clone());
        }
    }
    if let Some(m) = config.screen_index().and_then(|i| monitors.get(i)) {
        return Some(m.clone());
    }
    monitors.get(1).or_else(|| monitors.first()).cloned()
}

fn main_monitor(app: &AppHandle) -> Option<Monitor> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .and_then(|w| w.current_monitor().ok().flatten())
}

fn same_monitor(a: &Monitor, b: &Monitor) -> bool {
    ScreenRect::of_monitor(a) == ScreenRect::of_monitor(b)
}

/// Coloca la ventana: pantalla completa en un monitor externo, o ventana
/// redimensionable si el monitor es el de la ventana de control.
fn place_window(app: &AppHandle, window: &Window, config: &ScreenConfig, kind: ScreenKind) {
    let monitors = app.available_monitors().unwrap_or_default();
    let Some(monitor) = target_monitor(&monitors, config) else { return };
    let monitor_rect = ScreenRect::of_monitor(&monitor);

    let on_control_monitor = main_monitor(app).map(|m| same_monitor(&m, &monitor)).unwrap_or(false);
    let bounds = config.bounds.filter(|b| b.width > 0 && b.height > 0);
    let covers_monitor = bounds.map(|b| b.width >= monitor_rect.width && b.height >= monitor_rect.height).unwrap_or(true);

    let _ = window.set_simple_fullscreen(false);

    if on_control_monitor && covers_monitor {
        // Mismo monitor que la UI de control: ventana flotante 16:9 para no taparla.
        let scale = if kind == ScreenKind::Stage { 0.4 } else { 0.45 };
        let width = ((monitor_rect.width as f64) * scale).max(480.0) as u32;
        let height = (width as f64 * 9.0 / 16.0) as u32;
        let offset = if kind == ScreenKind::Stage { 40 } else { 0 };
        let x = monitor_rect.x + monitor_rect.width.saturating_sub(width + 40) as i32 - offset;
        let y = monitor_rect.y + monitor_rect.height.saturating_sub(height + 80) as i32 - offset;
        let _ = window.set_decorations(true);
        let _ = window.set_size(PhysicalSize::new(width, height));
        let _ = window.set_position(PhysicalPosition::new(x, y));
        return;
    }

    let _ = window.set_decorations(false);
    match bounds {
        // Bounds personalizados (más chicos que el monitor): respetarlos tal cual.
        Some(b) if !covers_monitor => {
            let _ = window.set_size(PhysicalSize::new(b.width, b.height));
            let _ = window.set_position(PhysicalPosition::new(b.x, b.y));
        }
        _ => {
            let _ = window.set_position(PhysicalPosition::new(monitor_rect.x, monitor_rect.y));
            let _ = window.set_size(PhysicalSize::new(monitor_rect.width, monitor_rect.height));
            let _ = window.set_simple_fullscreen(true);
        }
    }
}

// ---------------------------------------------------------------------------
// Abrir / cerrar pantallas
// ---------------------------------------------------------------------------

/// Abre (o reubica, si ya está abierta) la pantalla de una salida.
pub fn open_screen(app: &AppHandle, config: &ScreenConfig) -> AppResult<()> {
    let state = manager(app)?;
    let kind = config.kind();

    // Ya abierta con el mismo tipo: sólo reubicar.
    {
        let screens = state.screens.lock_safe();
        if let Some(handle) = screens.get(&config.id) {
            if handle.kind == kind {
                if let Some(window) = app.get_window(&handle.label) {
                    place_window(app, &window, config, kind);
                    let _ = window.set_always_on_top(config.always_on_top.unwrap_or(true));
                    let _ = window.show();
                }
                return Ok(());
            }
        }
    }
    // Cambió de tipo (audiencia <-> stage): cerrar y volver a abrir.
    close_screen(app, &config.id)?;

    let label = screen_label(&config.id);
    let title = match kind {
        ScreenKind::Audience => format!("PulseFlow — {}", if config.name.is_empty() { "Audiencia" } else { &config.name }),
        ScreenKind::Stage => format!("PulseFlow — Stage: {}", if config.name.is_empty() { "Stage" } else { &config.name }),
    };

    // La ventana se crea visible: en Linux/GTK el handle nativo no existe hasta
    // que la ventana se realiza, y WGPU lo necesita para crear la superficie.
    let window = WindowBuilder::new(app, &label)
        .title(title)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .shadow(false)
        .always_on_top(config.always_on_top.unwrap_or(true))
        .visible(true)
        .build()
        .map_err(|e| AppError::new(format!("Error al crear la ventana de salida: {e}")))?;

    place_window(app, &window, config, kind);

    let window = Arc::new(window);
    let scene = state.scene(&config.id);
    let video_frame: Arc<Mutex<Option<VideoFrame>>> = Arc::new(Mutex::new(None));
    let running = Arc::new(AtomicBool::new(true));

    let thread = match spawn_render_loop(Arc::clone(&window), kind, Arc::clone(&scene), Arc::clone(&video_frame), Arc::clone(&running)) {
        Ok(thread) => thread,
        Err(err) => {
            let _ = window.destroy();
            return Err(err);
        }
    };

    // Si el usuario cierra la ventana desde el sistema, liberar la pantalla.
    {
        let app_handle = app.clone();
        let id = config.id.clone();
        window.on_window_event(move |event| {
            if matches!(event, WindowEvent::Destroyed) {
                let handle = manager(&app_handle).ok().and_then(|s| s.screens.lock_safe().remove(&id));
                if let Some(mut handle) = handle {
                    handle.stop();
                    emit_output_state(&app_handle, &[(id.clone(), false)]);
                }
            }
        });
    }

    let mut handle = ScreenHandle {
        kind,
        label,
        running,
        thread: Some(thread),
        video_frame,
        video: None,
    };

    // Arrancar el video de fondo si la escena actual ya tiene uno.
    let background = scene.read_safe().background.clone();
    if kind == ScreenKind::Audience {
        sync_video(app, &mut handle, background.as_ref());
    }

    state.screens.lock_safe().insert(config.id.clone(), handle);
    Ok(())
}

/// Cierra la pantalla de una salida (si está abierta).
pub fn close_screen(app: &AppHandle, id: &str) -> AppResult<()> {
    let state = manager(app)?;
    let handle = state.screens.lock_safe().remove(id);
    if let Some(mut handle) = handle {
        handle.stop();
        if let Some(window) = app.get_window(&handle.label) {
            let _ = window.destroy();
        }
    }
    Ok(())
}

/// Cierra todas las pantallas.
pub fn close_all_screens(app: &AppHandle) -> AppResult<Vec<String>> {
    let ids = manager(app)?.open_ids();
    for id in &ids {
        close_screen(app, id)?;
    }
    Ok(ids)
}

/// Notifica al frontend el estado de las salidas (`OUTPUT` → `OUTPUT_STATE`).
pub fn emit_output_state(app: &AppHandle, states: &[(String, bool)]) {
    let data: Vec<_> = states.iter().map(|(id, active)| json!({ "id": id, "active": active })).collect();
    let _ = app.emit("OUTPUT", json!({ "channel": "OUTPUT_STATE", "data": data }));
}

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

/// Reemplaza la escena de audiencia de una salida.
pub fn set_audience_scene(app: &AppHandle, id: &str, text: Vec<TextBlock>, background: Option<BackgroundMedia>) -> AppResult<()> {
    let state = manager(app)?;
    let scene = state.scene(id);
    {
        let mut scene = scene.write_safe();
        scene.text = text;
        // Mismo medio: sólo actualizar opacidad/ajuste sin tocar el video.
        scene.background = background.clone();
    }

    let mut screens = state.screens.lock_safe();
    if let Some(handle) = screens.get_mut(id) {
        sync_video(app, handle, background.as_ref());
    }
    Ok(())
}

/// Reemplaza los datos de una pantalla de stage.
pub fn set_stage_scene(app: &AppHandle, id: &str, data: StageData) -> AppResult<()> {
    let scene = manager(app)?.scene(id);
    scene.write_safe().stage = data;
    Ok(())
}

/// Arranca, mantiene o detiene el video de fondo de una pantalla según el fondo actual.
fn sync_video(app: &AppHandle, handle: &mut ScreenHandle, background: Option<&BackgroundMedia>) {
    let wanted = background.filter(|bg| is_video(bg)).and_then(|bg| bg.path.clone().map(|p| (bg.id.clone(), p)));

    let current = handle.video.as_ref().map(|(id, _)| id.clone());
    if current == wanted.as_ref().map(|(id, _)| id.clone()) {
        return;
    }

    if let Some((_, mut playback)) = handle.video.take() {
        playback.stop();
    }

    if let Some((id, path)) = wanted {
        let slot = Arc::clone(&handle.video_frame);
        let result = video::start_video_playback(app, &path, &id, 1920, 1080, move |vid_id, w, h, bytes| {
            *slot.lock_safe() = Some((vid_id.to_string(), w, h, bytes.to_vec()));
        });
        match result {
            Ok(playback) => handle.video = Some((id, playback)),
            Err(err) => eprintln!("[screens] no se pudo reproducir el video {path}: {err}"),
        }
    }
}

fn is_video(bg: &BackgroundMedia) -> bool {
    if bg.media_type == "video" {
        return true;
    }
    let lower = bg.path.as_deref().unwrap_or("").to_lowercase();
    [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"].iter().any(|ext| lower.ends_with(ext))
}

// ---------------------------------------------------------------------------
// Identificar pantallas
// ---------------------------------------------------------------------------

/// Muestra un número grande en cada monitor durante unos segundos.
pub fn identify_screens(app: &AppHandle) -> AppResult<()> {
    let monitors = app.available_monitors().map_err(|e| AppError::new(e.to_string()))?;

    for (index, monitor) in monitors.iter().enumerate() {
        let label = format!("{IDENTIFY_LABEL_PREFIX}{index}");
        if app.get_window(&label).is_some() {
            continue;
        }

        let rect = ScreenRect::of_monitor(monitor);
        let width = (rect.width / 4).max(240);
        let height = (rect.height / 4).max(160);

        let window = WindowBuilder::new(app, &label)
            .title("PulseFlow — Identificar")
            .decorations(false)
            .resizable(false)
            .skip_taskbar(true)
            .always_on_top(true)
            .focused(false)
            .visible(true)
            .build()
            .map_err(|e| AppError::new(format!("Error al crear la ventana de identificación: {e}")))?;
        let _ = window.set_size(PhysicalSize::new(width, height));
        let _ = window.set_position(PhysicalPosition::new(
            rect.x + (rect.width.saturating_sub(width) / 2) as i32,
            rect.y + (rect.height.saturating_sub(height) / 2) as i32,
        ));

        let window = Arc::new(window);
        let scene = Arc::new(RwLock::new(ScreenScene {
            identify: Some((index + 1).to_string()),
            ..Default::default()
        }));
        let running = Arc::new(AtomicBool::new(true));
        let thread = spawn_render_loop(Arc::clone(&window), ScreenKind::Audience, scene, Arc::new(Mutex::new(None)), Arc::clone(&running))?;

        thread::spawn(move || {
            thread::sleep(Duration::from_secs(3));
            running.store(false, Ordering::SeqCst);
            let _ = thread.join();
            let _ = window.destroy();
        });
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Bucle de render
// ---------------------------------------------------------------------------

fn spawn_render_loop(
    window: Arc<Window>,
    kind: ScreenKind,
    scene: Arc<RwLock<ScreenScene>>,
    video_frame: Arc<Mutex<Option<VideoFrame>>>,
    running: Arc<AtomicBool>,
) -> AppResult<JoinHandle<()>> {
    let instance = wgpu::Instance::default();
    let surface = instance
        .create_surface(Arc::clone(&window))
        .map_err(|e| AppError::new(format!("Error creando la superficie WGPU: {e}")))?;

    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: Some(&surface),
        force_fallback_adapter: false,
        ..Default::default()
    }))
    .map_err(|e| AppError::new(format!("No se encontró una GPU compatible: {e}")))?;

    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("PulseFlow Screen Device"),
        ..Default::default()
    }))
    .map_err(|e| AppError::new(format!("Error inicializando el dispositivo WGPU: {e}")))?;

    let size = window.inner_size().unwrap_or(PhysicalSize::new(1920, 1080));
    let mut config = surface
        .get_default_config(&adapter, size.width.max(1), size.height.max(1))
        .ok_or_else(|| AppError::new("La superficie no es compatible con la GPU"))?;
    config.present_mode = wgpu::PresentMode::Fifo; // VSync
    surface.configure(&device, &config);

    thread::Builder::new()
        .name(format!("PulseFlow-Screen-{}", window.label()))
        .spawn(move || {
            let background_pipeline = BackgroundPipeline::new(&device, config.format);
            let mut text_engine = TextEngine::new(&device, &queue, config.format);
            let mut media_pool = MediaPool::new();
            let mut failed_images: HashSet<String> = HashSet::new();

            while running.load(Ordering::Relaxed) {
                let frame_start = Instant::now();

                if let Ok(current) = window.inner_size() {
                    if current.width > 0 && current.height > 0 && (current.width != config.width || current.height != config.height) {
                        config.width = current.width;
                        config.height = current.height;
                        surface.configure(&device, &config);
                    }
                }

                if let Some((id, w, h, bytes)) = video_frame.lock_safe().take() {
                    let _ = media_pool.update_video_frame(&device, &queue, &background_pipeline, &id, w, h, &bytes);
                }

                let frame = match surface.get_current_texture() {
                    wgpu::CurrentSurfaceTexture::Success(frame) | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => frame,
                    wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                        surface.configure(&device, &config);
                        continue;
                    }
                    _ => {
                        thread::sleep(Duration::from_millis(16));
                        continue;
                    }
                };

                let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());
                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("PulseFlow Screen Encoder"),
                });

                {
                    let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("PulseFlow Screen Pass"),
                        color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                            view: &view,
                            resolve_target: None,
                            ops: wgpu::Operations {
                                load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                                store: wgpu::StoreOp::Store,
                            },
                            depth_slice: None,
                        })],
                        depth_stencil_attachment: None,
                        timestamp_writes: None,
                        occlusion_query_set: None,
                        multiview_mask: None,
                    });

                    let current = scene.read_safe().clone();
                    let (w, h) = (config.width, config.height);

                    let blocks = if let Some(number) = current.identify {
                        identify_blocks(&number, w as f32, h as f32)
                    } else {
                        match kind {
                            ScreenKind::Audience => {
                                if let Some(bg) = current.background {
                                    if media_pool.get(&bg.id).is_none() && !is_video(&bg) && !failed_images.contains(&bg.id) {
                                        if let Some(path) = bg.path.as_deref() {
                                            if let Err(err) = media_pool.load_image(&device, &queue, &background_pipeline, path) {
                                                eprintln!("[screens] {err}");
                                                failed_images.insert(bg.id.clone());
                                            }
                                        }
                                    }
                                    if let Some(texture) = media_pool.get(&bg.id) {
                                        background_pipeline.render(&queue, &mut pass, &texture, w, h, bg.opacity, bg.aspect_mode);
                                    }
                                }
                                current.text
                            }
                            ScreenKind::Stage => stage_blocks(&current.stage, w as f32, h as f32),
                        }
                    };

                    if !blocks.is_empty() {
                        let _ = text_engine.render(&device, &queue, &mut pass, w, h, &blocks);
                    }
                }

                queue.submit([encoder.finish()]);
                queue.present(frame);

                // Fifo ya limita a la frecuencia del monitor; esto evita girar en
                // vacío si el compositor no bloquea (ventanas ocultas, Xvfb...).
                let elapsed = frame_start.elapsed();
                if elapsed < Duration::from_millis(8) {
                    thread::sleep(Duration::from_millis(8) - elapsed);
                }
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando el hilo de render: {e}")))
}

fn text_block(text: String, font_size: f32, weight: u16, color: [f32; 4], alignment: &str, x: f32, y: f32, width: f32, height: f32) -> TextBlock {
    TextBlock {
        text,
        font_family: None,
        font_size,
        font_weight: weight,
        font_style: None,
        color,
        alignment: alignment.to_string(),
        x,
        y,
        width,
        height,
        line_height_ratio: 1.2,
        outline_color: None,
        outline_width: None,
        shadow_color: None,
        shadow_offset: None,
        ..Default::default()
    }
}

fn identify_blocks(number: &str, w: f32, h: f32) -> Vec<TextBlock> {
    let size = h * 0.6;
    let mut block = text_block(number.to_string(), size, 800, [1.0, 1.0, 1.0, 1.0], "center", 0.0, 0.0, w, h);
    block.vertical_align = Some("center".to_string());
    block.outline_color = Some([0.94, 0.0, 0.55, 1.0]);
    block.outline_width = Some((size * 0.03).max(2.0));
    vec![block]
}

/// Layout de stage de alto contraste: reloj, actual, siguiente y mensaje.
fn stage_blocks(data: &StageData, w: f32, h: f32) -> Vec<TextBlock> {
    let mut blocks = Vec::new();
    let margin = w * 0.03;

    let clock = data.clock.clone().unwrap_or_else(|| chrono::Local::now().format("%H:%M:%S").to_string());
    blocks.push(text_block(clock, (h * 0.07).max(18.0), 700, [0.3, 0.9, 0.3, 1.0], "right", margin, h * 0.03, w - margin * 2.0, h * 0.1));

    if !data.current_slide.is_empty() {
        blocks.push(text_block(data.current_slide.clone(), (h * 0.075).max(18.0), 700, [1.0, 1.0, 1.0, 1.0], "left", margin, h * 0.15, w - margin * 2.0, h * 0.45));
    }

    if let Some(next) = data.next_slide.as_ref().filter(|n| !n.is_empty()) {
        blocks.push(text_block(next.clone(), (h * 0.05).max(14.0), 600, [0.6, 0.6, 0.6, 1.0], "left", margin, h * 0.64, w - margin * 2.0, h * 0.24));
    }

    if let Some(message) = data.message.as_ref().filter(|m| !m.is_empty()) {
        blocks.push(text_block(message.clone(), (h * 0.05).max(14.0), 700, [1.0, 0.45, 0.2, 1.0], "center", margin, h * 0.9, w - margin * 2.0, h * 0.08));
    }

    blocks
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn config_kind_and_screen_index() {
        let audience: ScreenConfig = serde_json::from_value(json!({ "id": "a", "screen": "1", "bounds": { "x": 1920, "y": 0, "width": 1920, "height": 1080 } })).expect("config");
        assert_eq!(audience.kind(), ScreenKind::Audience);
        assert_eq!(audience.screen_index(), Some(1));

        let stage: ScreenConfig = serde_json::from_value(json!({ "id": "s", "stageOutput": "layout1" })).expect("config");
        assert_eq!(stage.kind(), ScreenKind::Stage);
    }

    #[test]
    fn rect_contains_center() {
        let monitor = ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 };
        let bounds = ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 };
        assert!(monitor.contains(bounds.center()));
        assert!(!ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }.contains(bounds.center()));
    }

    #[test]
    fn stage_layout_has_clock_and_slides() {
        let data = StageData { current_slide: "Actual".into(), next_slide: Some("Siguiente".into()), ..Default::default() };
        let blocks = stage_blocks(&data, 1920.0, 1080.0);
        assert_eq!(blocks.len(), 3);
        assert_eq!(blocks[1].text, "Actual");
    }

    #[test]
    fn screen_label_is_safe() {
        assert_eq!(screen_label("abc 1/2"), "screen-abc_1_2");
    }
}
