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
//! `ScreenManager` es el estado de Tauri: guarda un `HashMap<outputId, ScreenHandle>`
//! con las pantallas abiertas y, aparte, la escena de cada salida — que persiste
//! aunque la ventana esté cerrada, para que al abrirla muestre de inmediato el
//! contenido actual.
//!
//! La ventana se ubica en el monitor que contiene los `bounds` de la salida. Si ese
//! monitor es el de la ventana de control, se abre en modo ventana (para no tapar
//! la UI); en cualquier otro monitor cubre la pantalla completa.

use super::media::{BackgroundPipeline, MediaPool};
use super::sync::{MutexExt, RwLockExt};
use super::text::TextEngine;
use super::types::{BackgroundMedia, OverlayItem, StageData, TextBlock};
use super::video::{self, VideoPlayback};
use crate::error::{AppError, AppResult};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::window::{Monitor, Window, WindowBuilder};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WindowEvent};

/// Prefijo de las etiquetas de ventana de las pantallas.
const SCREEN_LABEL_PREFIX: &str = "screen-";
/// Etiqueta de la ventana de control (webview principal).
const MAIN_WINDOW_LABEL: &str = "main";

/// Tipo de pantalla.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScreenKind {
    Audience,
    Stage,
}

/// Rectángulo en píxeles físicos (mismo sistema que `GET_DISPLAYS`).
#[derive(Debug, Clone, Copy, Default, PartialEq, serde::Serialize, Deserialize)]
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
        if is_stage {
            ScreenKind::Stage
        } else {
            ScreenKind::Audience
        }
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
    pub overlays: Vec<OverlayItem>,
    pub stage: StageData,
}

/// Petición de transición pendiente de una pantalla. La escribe el hilo que aplica
/// la escena (`RENDER_SCENE`) y la consume el bucle de render (F4.4), que es quien
/// tiene la `TransitionEngine`.
#[derive(Debug, Clone, Copy)]
struct TransitionRequest {
    transition_type: super::transition::TransitionType,
    duration_ms: u64,
    easing: super::transition::EasingType,
}

/// Pantalla abierta: ventana + hilo de render + video de fondo.
struct ScreenHandle {
    kind: ScreenKind,
    label: String,
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    video_frame: Arc<Mutex<Option<VideoFrame>>>,
    video: Option<(String, VideoPlayback)>,
    /// Última transición pedida (la toma el bucle al dibujar el próximo frame).
    transition: Arc<Mutex<Option<TransitionRequest>>>,
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

/// Estado de todas las pantallas del engine (gestionado por Tauri en `lib.rs`).
pub struct ScreenManager {
    /// Escena por id de salida. Se conserva aunque la pantalla esté cerrada, para
    /// que al abrirla muestre de inmediato el contenido actual.
    scenes: Mutex<HashMap<String, Arc<RwLock<ScreenScene>>>>,
    screens: Mutex<HashMap<String, ScreenHandle>>,
    /// Captura de framebuffer para NDI (recurso de engine, hasta F8).
    pub(crate) ndi_capture: Mutex<Option<super::ndi_stream::GpuFramebufferCapture>>,
    /// Configuración global de transición hasta que F3 la aplique por pantalla.
    pub(crate) transition_config:
        Mutex<(super::transition::TransitionType, u64, super::transition::EasingType)>,
}

impl ScreenManager {
    pub fn new() -> Self {
        Self {
            scenes: Mutex::new(HashMap::new()),
            screens: Mutex::new(HashMap::new()),
            ndi_capture: Mutex::new(None),
            transition_config: Mutex::new((
                super::transition::TransitionType::Crossfade,
                300,
                super::transition::EasingType::EaseInOut,
            )),
        }
    }

    fn scene(&self, id: &str) -> Arc<RwLock<ScreenScene>> {
        let mut scenes = self.scenes.lock_safe();
        Arc::clone(scenes.entry(id.to_string()).or_default())
    }

    pub fn is_open(&self, id: &str) -> bool {
        self.screens.lock_safe().contains_key(id)
    }
}

pub(crate) fn manager(app: &AppHandle) -> AppResult<tauri::State<'_, ScreenManager>> {
    app.try_state::<ScreenManager>()
        .ok_or_else(|| AppError::new("ScreenManager no disponible"))
}

fn screen_label(id: &str) -> String {
    let safe: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("{SCREEN_LABEL_PREFIX}{safe}")
}

// ---------------------------------------------------------------------------
// Monitores
// ---------------------------------------------------------------------------

/// Selección pura del monitor de una salida (testeable sin monitores reales):
/// 1. el que contiene el centro de `bounds`, 2. el elegido por índice,
/// 3. el secundario (o el único si hay uno solo).
fn select_monitor_index(
    monitors: &[ScreenRect],
    bounds: Option<ScreenRect>,
    screen_index: Option<usize>,
) -> Option<usize> {
    if monitors.is_empty() {
        return None;
    }
    if let Some(b) = bounds.filter(|b| b.width > 0 && b.height > 0) {
        let center = b.center();
        if let Some(i) = monitors.iter().position(|m| m.contains(center)) {
            return Some(i);
        }
    }
    if let Some(i) = screen_index.filter(|i| *i < monitors.len()) {
        return Some(i);
    }
    Some(if monitors.len() > 1 { 1 } else { 0 })
}

/// Monitor de la salida, según `select_monitor_index`.
fn target_monitor(monitors: &[Monitor], config: &ScreenConfig) -> Option<Monitor> {
    let rects: Vec<ScreenRect> = monitors.iter().map(ScreenRect::of_monitor).collect();
    select_monitor_index(&rects, config.bounds, config.screen_index()).and_then(|i| monitors.get(i).cloned())
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

    let on_control_monitor = main_monitor(app)
        .map(|m| same_monitor(&m, &monitor))
        .unwrap_or(false);
    let bounds = config.bounds.filter(|b| b.width > 0 && b.height > 0);
    let covers_monitor = bounds
        .map(|b| b.width >= monitor_rect.width && b.height >= monitor_rect.height)
        .unwrap_or(true);

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
        ScreenKind::Audience => format!(
            "PulseFlow — {}",
            if config.name.is_empty() { "Audiencia" } else { &config.name }
        ),
        ScreenKind::Stage => format!(
            "PulseFlow — Stage: {}",
            if config.name.is_empty() { "Stage" } else { &config.name }
        ),
    };

    // La ventana se crea visible: el handle nativo no existe hasta que la ventana
    // se realiza, y WGPU lo necesita para crear la superficie (hallazgo 2, F2.1).
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
    let transition: Arc<Mutex<Option<TransitionRequest>>> = Arc::new(Mutex::new(None));
    let running = Arc::new(AtomicBool::new(true));

    let thread = match spawn_render_loop(
        Arc::clone(&window),
        kind,
        Arc::clone(&scene),
        Arc::clone(&video_frame),
        Arc::clone(&running),
        Arc::clone(&transition),
    ) {
        Ok(thread) => thread,
        Err(err) => {
            let _ = window.destroy();
            return Err(err);
        }
    };

    // (F2.3 agregará aquí la emisión de OUTPUT_STATE al frontend.)
    {
        let app_handle = app.clone();
        let id = config.id.clone();
        window.on_window_event(move |event| {
            if matches!(event, WindowEvent::Destroyed) {
                let handle = manager(&app_handle)
                    .ok()
                    .and_then(|s| s.screens.lock_safe().remove(&id));
                if let Some(mut handle) = handle {
                    handle.stop();
                }
                emit_output_state(&app_handle, &[(id.clone(), false)]);
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
        transition,
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
    let ids = open_ids(app);
    for id in &ids {
        close_screen(app, id)?;
    }
    Ok(ids)
}

/// Reubica una pantalla **abierta** con la configuración nueva (la que mueve el
/// usuario en "Elegir pantalla"). Si está cerrada no la abre: la configuración
/// quedará aplicada cuando se abra.
pub fn reposition_screen(app: &AppHandle, config: &ScreenConfig) -> AppResult<()> {
    let state = manager(app)?;
    let open_kind = {
        let screens = state.screens.lock_safe();
        screens.get(&config.id).map(|h| h.kind)
    };
    match open_kind {
        Some(kind) if kind == config.kind() => open_screen(app, config),
        _ => Ok(()),
    }
}

/// Ids de todas las pantallas abiertas.
pub fn open_ids(app: &AppHandle) -> Vec<String> {
    manager(app)
        .map(|s| s.screens.lock_safe().keys().cloned().collect())
        .unwrap_or_default()
}

/// Notifica al frontend el estado de las salidas (`OUTPUT` → `OUTPUT_STATE`).
pub fn emit_output_state(app: &AppHandle, states: &[(String, bool)]) {
    let data: Vec<_> = states
        .iter()
        .map(|(id, active)| serde_json::json!({ "id": id, "active": active }))
        .collect();
    let _ = app.emit("OUTPUT", serde_json::json!({ "channel": "OUTPUT_STATE", "data": data }));
}

// ---------------------------------------------------------------------------
// Identificación de monitores (F2.5)
// ---------------------------------------------------------------------------

/// Duración del número en pantalla al identificar monitores.
const IDENTIFY_DURATION: Duration = Duration::from_secs(3);

/// Pantalla enviada por `IDENTIFY_SCREENS` (espejo en TypeScript:
/// `IdentifyScreen` en `src/types/Output.ts`). El frontend manda la lista de
/// `GET_DISPLAYS` ya ordenada como la previsualiza; la posición (1-based) de
/// cada entrada es el número que se muestra en el monitor.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct IdentifyScreen {
    /// Índice del monitor en `GET_DISPLAYS`.
    pub id: Option<usize>,
    /// Bounds del monitor (mismo sistema que `ScreenRect`).
    pub bounds: Option<ScreenRect>,
}

/// Emparejamiento puro entre las entradas del payload y los monitores reales
/// (testeable sin monitores): devuelve (número a mostrar, índice de monitor).
/// El monitor es el que contiene el centro de los bounds de la entrada; si no,
/// el mismo índice de la entrada (el orden de `GET_DISPLAYS` coincide con el de
/// `available_monitors`). Sin monitor, la entrada se omite.
fn identify_targets(monitors: &[ScreenRect], entries: &[IdentifyScreen]) -> Vec<(String, usize)> {
    entries
        .iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            let monitor = entry
                .bounds
                .filter(|b| b.width > 0 && b.height > 0)
                .and_then(|b| monitors.iter().position(|m| m.contains(b.center())))
                .or_else(|| (index < monitors.len()).then_some(index))?;
            Some(((index + 1).to_string(), monitor))
        })
        .collect()
}

/// `IDENTIFY_SCREENS`: ventana temporal por monitor con su número grande
/// durante 3 s (F2.5), usando el mismo bucle de render que las salidas. No
/// entra en `ScreenManager`: son ventanas `identify-*` que se destruyen solas.
pub fn identify_screens(app: &AppHandle, entries: &[IdentifyScreen]) -> AppResult<()> {
    let monitors = app.available_monitors().map_err(|e| AppError::new(e.to_string()))?;
    let rects: Vec<ScreenRect> = monitors.iter().map(ScreenRect::of_monitor).collect();

    let targets = if entries.is_empty() {
        // Sin payload: todos los monitores, numerados por su orden.
        rects.iter().enumerate().map(|(i, _)| ((i + 1).to_string(), i)).collect()
    } else {
        identify_targets(&rects, entries)
    };

    for (number, monitor_index) in targets {
        let Some(monitor) = monitors.get(monitor_index) else { continue };
        if let Err(err) = open_identify_window(app, &number, monitor) {
            eprintln!("[identify] no se pudo abrir la ventana del monitor {monitor_index}: {err}");
        }
    }
    Ok(())
}

/// Ventana temporal cubriendo el monitor con el número grande; se cierra sola.
fn open_identify_window(app: &AppHandle, number: &str, monitor: &Monitor) -> AppResult<()> {
    let label = format!("identify-{number}");
    // Reemplaza una identificación anterior en curso (mismo monitor).
    if let Some(existing) = app.get_window(&label) {
        let _ = existing.destroy();
    }

    let rect = ScreenRect::of_monitor(monitor);
    let window = WindowBuilder::new(app, &label)
        .title(format!("Pantalla {number}"))
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .always_on_top(true)
        .visible(true)
        .build()
        .map_err(|e| AppError::new(format!("Error al crear la ventana de identificación: {e}")))?;

    let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
    let _ = window.set_size(PhysicalSize::new(rect.width, rect.height));

    let window = Arc::new(window);
    let scene = Arc::new(RwLock::new(ScreenScene {
        text: identify_blocks(number, rect.width, rect.height),
        ..Default::default()
    }));
    let running = Arc::new(AtomicBool::new(true));
    let video_frame: Arc<Mutex<Option<VideoFrame>>> = Arc::new(Mutex::new(None));

    // La ventana de identificación no transiciona: nace con su contenido.
    let render_thread = match spawn_render_loop(
        Arc::clone(&window),
        ScreenKind::Audience,
        Arc::clone(&scene),
        video_frame,
        Arc::clone(&running),
        Arc::new(Mutex::new(None)),
    ) {
        Ok(thread) => thread,
        Err(err) => {
            let _ = window.destroy();
            return Err(err);
        }
    };

    // La ventana se destruye sola a los 3 s (F2.5).
    thread::Builder::new()
        .name(format!("PulseFlow-Identify-{number}"))
        .spawn(move || {
            thread::sleep(IDENTIFY_DURATION);
            running.store(false, Ordering::SeqCst);
            let _ = render_thread.join();
            let _ = window.destroy();
        })
        .map_err(|e| AppError::new(format!("Error iniciando el temporizador de identificación: {e}")))?;

    Ok(())
}

/// Bloques de texto de una ventana de identificación: número grande centrado
/// y, debajo, el nombre del monitor.
fn identify_blocks(number: &str, width: u32, height: u32) -> Vec<TextBlock> {
    let (w, h) = (width as f32, height as f32);
    vec![
        TextBlock {
            text: number.to_string(),
            font_size: (h * 0.5).min(w * 0.5),
            font_weight: 800,
            color: [1.0, 1.0, 1.0, 1.0],
            alignment: "center".to_string(),
            vertical_align: Some("center".to_string()),
            x: 0.0,
            y: 0.0,
            width: w,
            height: h,
            line_height_ratio: 1.0,
            outline_color: Some([0.0, 0.0, 0.0, 1.0]),
            outline_width: Some(4.0),
            ..Default::default()
        },
        TextBlock {
            text: format!("PulseFlow — Pantalla {number}"),
            font_size: (h * 0.04).clamp(16.0, 40.0),
            color: [0.6, 0.6, 0.6, 1.0],
            alignment: "center".to_string(),
            x: 0.0,
            y: h * 0.9,
            width: w,
            height: h * 0.08,
            line_height_ratio: 1.2,
            ..Default::default()
        },
    ]
}

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

/// Reemplaza la escena de audiencia de una salida (texto + fondo).
pub fn set_audience_scene(
    app: &AppHandle,
    id: &str,
    text: Vec<TextBlock>,
    background: Option<BackgroundMedia>,
) -> AppResult<()> {
    let state = manager(app)?;
    // El frontend reenvía la escena ante cualquier cambio de `outputs`, no sólo al
    // cambiar de diapositiva; por eso sólo se pide transición si el contenido visible
    // cambió de verdad (F4.4).
    let changed = {
        let scene = state.scene(id);
        let current = scene.read_safe();
        current.text != text || current.background != background
    };

    set_scene_text(app, id, text)?;
    set_scene_background(app, id, background)?;

    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Reemplaza sólo el texto de la escena de una salida.
pub fn set_scene_text(app: &AppHandle, id: &str, text: Vec<TextBlock>) -> AppResult<()> {
    let scene = manager(app)?.scene(id);
    scene.write_safe().text = text;
    Ok(())
}

/// Reemplaza sólo el fondo de la escena de una salida y sincroniza el video.
pub fn set_scene_background(
    app: &AppHandle,
    id: &str,
    background: Option<BackgroundMedia>,
) -> AppResult<()> {
    let state = manager(app)?;
    let scene = state.scene(id);
    {
        let mut scene = scene.write_safe();
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
    let state = manager(app)?;
    let scene = state.scene(id);
    let changed = scene.read_safe().stage != data;
    scene.write_safe().stage = data;

    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Configura la transición global del engine (se aplica por pantalla desde F3).
pub fn set_transition_config(
    app: &AppHandle,
    trans_type_str: &str,
    duration_ms: u64,
    easing_str: &str,
) -> AppResult<()> {
    let state = manager(app)?;
    let mut cfg = state.transition_config.lock_safe();
    let trans_type = super::transition::TransitionType::from_str(trans_type_str);
    let easing = match easing_str.to_lowercase().as_str() {
        "easeout" | "ease_out" => super::transition::EasingType::EaseOut,
        "linear" => super::transition::EasingType::Linear,
        _ => super::transition::EasingType::EaseInOut,
    };
    *cfg = (trans_type, duration_ms, easing);
    Ok(())
}

/// Pide al bucle de la pantalla `id` una transición con la config global actual.
/// Sólo se llama cuando el contenido renderizable cambió (ver `set_audience_scene`).
fn request_transition(state: &ScreenManager, id: &str) {
    let (transition_type, duration_ms, easing) = *state.transition_config.lock_safe();
    if let Some(handle) = state.screens.lock_safe().get(id) {
        *handle.transition.lock_safe() = Some(TransitionRequest {
            transition_type,
            duration_ms,
            easing,
        });
    }
}

/// Arranca, mantiene o detiene el video de fondo de una pantalla según el fondo actual.
fn sync_video(app: &AppHandle, handle: &mut ScreenHandle, background: Option<&BackgroundMedia>) {
    let wanted = background
        .filter(|bg| is_video(bg))
        .and_then(|bg| bg.path.clone().map(|p| (bg.id.clone(), p)));

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
    [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

// ---------------------------------------------------------------------------
// Bucle de render (uno por pantalla; audiencia y stage son layouts, no ciclos)
// ---------------------------------------------------------------------------

fn spawn_render_loop(
    window: Arc<Window>,
    kind: ScreenKind,
    scene: Arc<RwLock<ScreenScene>>,
    video_frame: Arc<Mutex<Option<VideoFrame>>>,
    running: Arc<AtomicBool>,
    pending_transition: Arc<Mutex<Option<TransitionRequest>>>,
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
            // F4.4: doble buffer offscreen donde se compone la escena + la transición.
            let mut transition_engine = super::transition::TransitionEngine::new(
                &device,
                config.format,
                config.width,
                config.height,
            );
            let mut failed_images: HashSet<String> = HashSet::new();

            while running.load(Ordering::Relaxed) {
                let frame_start = Instant::now();

                if let Ok(current) = window.inner_size() {
                    if current.width > 0
                        && current.height > 0
                        && (current.width != config.width || current.height != config.height)
                    {
                        config.width = current.width;
                        config.height = current.height;
                        surface.configure(&device, &config);
                        transition_engine.resize(&device, config.format, config.width, config.height);
                    }
                }

                if let Some((id, w, h, bytes)) = video_frame.lock_safe().take() {
                    let _ = media_pool.update_video_frame(
                        &device,
                        &queue,
                        &background_pipeline,
                        &id,
                        w,
                        h,
                        &bytes,
                    );
                }

                let frame = match surface.get_current_texture() {
                    wgpu::CurrentSurfaceTexture::Success(frame)
                    | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => frame,
                    wgpu::CurrentSurfaceTexture::Outdated
                    | wgpu::CurrentSurfaceTexture::Lost => {
                        surface.configure(&device, &config);
                        continue;
                    }
                    _ => {
                        thread::sleep(Duration::from_millis(16));
                        continue;
                    }
                };

                let view = frame
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default());
                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("PulseFlow Screen Encoder"),
                });

                // F4.4: si llegó una escena nueva, se dispara la transición. Sólo hay
                // que copiar el fotograma anterior cuando de verdad se anima (crossfade
                // y demás); el corte muestra el buffer nuevo sin copiar nada.
                let copy_previous = match pending_transition.lock_safe().take() {
                    Some(request) => transition_engine.trigger(
                        request.transition_type,
                        request.duration_ms,
                        request.easing,
                    ),
                    None => false,
                };
                if copy_previous {
                    let size = wgpu::Extent3d {
                        width: transition_engine.width,
                        height: transition_engine.height,
                        depth_or_array_layers: 1,
                    };
                    encoder.copy_texture_to_texture(
                        transition_engine.texture_b.as_image_copy(),
                        transition_engine.texture_a.as_image_copy(),
                        size,
                    );
                }

                {
                    // La escena se dibuja en el buffer B; la transición compone A -> B
                    // sobre la superficie de la ventana.
                    let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("PulseFlow Screen Pass"),
                        color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                            view: &transition_engine.view_b,
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

                    let blocks = match kind {
                        ScreenKind::Audience => {
                            if let Some(bg) = current.background {
                                if media_pool.get(&bg.id).is_none()
                                    && !is_video(&bg)
                                    && !failed_images.contains(&bg.id)
                                {
                                    if let Some(path) = bg.path.as_deref() {
                                        if let Err(err) = media_pool.load_image(
                                            &device,
                                            &queue,
                                            &background_pipeline,
                                            path,
                                        ) {
                                            eprintln!("[screens] {err}");
                                            failed_images.insert(bg.id.clone());
                                        }
                                    }
                                }
                                if let Some(texture) = media_pool.get(&bg.id) {
                                    background_pipeline.render(
                                        &queue,
                                        &mut pass,
                                        &texture,
                                        w,
                                        h,
                                        bg.opacity,
                                        bg.aspect_mode,
                                    );
                                }
                            }

                            let mut blocks = current.text;
                            // Overlays (relojes, avisos): modelo previo, hasta F2.7.
                            blocks.extend(
                                current.overlays.into_iter().map(|o| overlay_block(o, w)),
                            );
                            blocks
                        }
                        ScreenKind::Stage => super::stage::stage_blocks(&current.stage, w as f32, h as f32),
                    };

                    if !blocks.is_empty() {
                        let _ = text_engine.render(&device, &queue, &mut pass, w, h, &blocks);
                    }
                }

                // Compone la transición (o, sin transición activa, copia el buffer B,
                // que ya tiene la escena actual) sobre la superficie de la ventana.
                {
                    let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("PulseFlow Transition Pass"),
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
                    transition_engine.render(&queue, &mut pass);
                }

                queue.submit([encoder.finish()]);
                queue.present(frame);

                // Fifo ya limita a la frecuencia del monitor; esto evita girar en
                // vacío si el compositor no bloquea.
                let elapsed = frame_start.elapsed();
                if elapsed < Duration::from_millis(8) {
                    thread::sleep(Duration::from_millis(8) - elapsed);
                }
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando el hilo de render: {e}")))
}

/// Mapea un overlay del modelo previo a un bloque de texto (contorno + sombra).
fn overlay_block(o: OverlayItem, surface_width: u32) -> TextBlock {
    TextBlock {
        text: o.text,
        font_family: None,
        font_size: o.font_size,
        font_weight: 700,
        font_style: None,
        color: o.color,
        alignment: "left".to_string(),
        x: o.x,
        y: o.y,
        width: surface_width as f32,
        height: 200.0,
        line_height_ratio: 1.2,
        outline_color: Some([0.0, 0.0, 0.0, 1.0]),
        outline_width: Some(1.5),
        shadow_color: Some([0.0, 0.0, 0.0, 0.8]),
        shadow_offset: Some([3.0, 3.0]),
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn config_kind_and_screen_index() {
        let audience: ScreenConfig = serde_json::from_value(json!({
            "id": "a", "screen": "1",
            "bounds": { "x": 1920, "y": 0, "width": 1920, "height": 1080 }
        }))
        .expect("config de audiencia válida");
        assert_eq!(audience.kind(), ScreenKind::Audience);
        assert_eq!(audience.screen_index(), Some(1));

        let stage: ScreenConfig =
            serde_json::from_value(json!({ "id": "s", "stageOutput": "layout1" }))
                .expect("config de stage válida");
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
    fn select_monitor_prefers_bounds_center() {
        let monitors = [
            ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
            ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 },
            ScreenRect { x: -1280, y: 0, width: 1280, height: 720 },
        ];

        // Centro de bounds dentro del monitor 1 (aunque screen diga 0).
        let bounds = ScreenRect { x: 2000, y: 100, width: 800, height: 600 };
        assert_eq!(select_monitor_index(&monitors, Some(bounds), Some(0)), Some(1));

        // Centro de bounds dentro del monitor 2 (secundario a la izquierda).
        let bounds = ScreenRect { x: -1000, y: 10, width: 200, height: 200 };
        assert_eq!(select_monitor_index(&monitors, Some(bounds), None), Some(2));
    }

    #[test]
    fn select_monitor_falls_back_to_index_then_secondary() {
        let two = [
            ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
            ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 },
        ];
        let one = [ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }];

        // Sin bounds: índice elegido.
        assert_eq!(select_monitor_index(&two, None, Some(0)), Some(0));
        // Índice fuera de rango: secundario.
        assert_eq!(select_monitor_index(&two, None, Some(9)), Some(1));
        // Sin nada: secundario si existe, si no el único.
        assert_eq!(select_monitor_index(&two, None, None), Some(1));
        assert_eq!(select_monitor_index(&one, None, None), Some(0));
        // Sin monitores: nada.
        assert_eq!(select_monitor_index(&[], None, None), None);
    }

    #[test]
    fn identify_targets_matches_bounds_then_index() {
        let monitors = [
            ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
            ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 },
        ];

        // El número es la posición (1-based) y el monitor el que contiene los bounds.
        let entries = [
            IdentifyScreen { bounds: Some(ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 }), ..Default::default() },
            IdentifyScreen { bounds: Some(ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }), ..Default::default() },
        ];
        assert_eq!(
            identify_targets(&monitors, &entries),
            vec![("1".to_string(), 1), ("2".to_string(), 0)]
        );

        // Sin bounds válidos: fallback al índice de la entrada.
        let no_bounds = [IdentifyScreen::default()];
        assert_eq!(identify_targets(&monitors, &no_bounds), vec![("1".to_string(), 0)]);

        // Entrada sin monitor asociado: se omite.
        let out_of_range = [IdentifyScreen { bounds: Some(ScreenRect { x: 9999, y: 9999, width: 100, height: 100 }), ..Default::default() }];
        assert!(identify_targets(&[], &out_of_range).is_empty());
    }

    #[test]
    fn identify_screen_deserializa_desde_display_del_frontend() {
        // Payload real: la lista de `GET_DISPLAYS` (id numérico + bounds), con
        // campos extra (label, workArea, size, scaleFactor) que serde ignora.
        let screens: Vec<IdentifyScreen> = serde_json::from_value(serde_json::json!([
            {
                "id": 0,
                "label": "Built-in Retina Display",
                "bounds": { "x": 0, "y": 0, "width": 1728, "height": 1117 },
                "workArea": { "x": 0, "y": 37, "width": 1728, "height": 1080 },
                "size": { "width": 1728, "height": 1117 },
                "scaleFactor": 2
            }
        ]))
        .expect("display de GET_DISPLAYS debe mapear a IdentifyScreen");

        assert_eq!(screens[0].id, Some(0));
        assert_eq!(screens[0].bounds.map(|b| b.width), Some(1728));
    }

    #[test]
    fn identify_blocks_center_big_number() {
        let blocks = identify_blocks("2", 1920, 1080);
        assert_eq!(blocks[0].text, "2");
        assert_eq!(blocks[0].alignment, "center");
        assert_eq!(blocks[0].vertical_align.as_deref(), Some("center"));
        assert!(blocks[0].font_size > 400.0, "el número debe ser grande");
        assert!(blocks[1].text.contains("2"));
    }

    #[test]
    fn screen_label_is_safe() {
        assert_eq!(screen_label("abc 1/2"), "screen-abc_1_2");
        assert_eq!(screen_label("main-out_2"), "screen-main-out_2");
    }

    #[test]
    fn screen_manager_new_starts_empty() {
        let state = ScreenManager::new();
        assert!(!state.is_open("cualquiera"));
    }

    #[test]
    fn screen_config_deserializa_desde_output_del_frontend() {
        // Payload real de UPDATE_BOUNDS/TOGGLE_OUTPUTS: un `Output` de Svelte
        // (src/types/Output.ts) con campos extra que serde debe ignorar.
        let config: ScreenConfig = serde_json::from_value(json!({
            "id": "output-1",
            "name": "Principal",
            "color": "#ff0000",
            "active": true,
            "enabled": true,
            "bounds": { "x": 1920, "y": 0, "width": 1920, "height": 1080 },
            "boundsLocked": false,
            "screen": "1",
            "alwaysOnTop": true,
            "invisible": false
        }))
        .expect("Output del frontend debe mapear a ScreenConfig");

        assert_eq!(config.id, "output-1");
        assert_eq!(config.kind(), ScreenKind::Audience);
        assert_eq!(config.bounds.map(|b| b.width), Some(1920));
        assert_eq!(config.always_on_top, Some(true));
        assert_eq!(config.enabled, Some(true));

        // Una salida de stage se reconoce por stageOutput.
        let stage: ScreenConfig = serde_json::from_value(json!({
            "id": "stage-1",
            "name": "Stage",
            "enabled": true,
            "stageOutput": "layout-1",
            "screen": null
        }))
        .expect("Output de stage debe mapear a ScreenConfig");
        assert_eq!(stage.kind(), ScreenKind::Stage);
        assert_eq!(stage.screen_index(), None);
    }
}
