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

use super::sync::{MutexExt, RwLockExt};
use super::text::TextEngine;
use super::types::{BackgroundMedia, MediaItem, OverlayItem, StageData, TextBlock};
use super::video::{self, VideoPlayback};
use crate::error::{AppError, AppResult};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::window::{Monitor, Window, WindowBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalSize, WindowEvent};

/// Prefijo de las etiquetas de ventana de las pantallas.
const SCREEN_LABEL_PREFIX: &str = "screen-";

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

    /// Rectángulo del monitor en píxeles **lógicos** (F10.0c): comparable entre
    /// monitores de distinta escala y coherente con los `bounds` del frontend.
    fn of_monitor(monitor: &Monitor) -> Self {
        let scale = monitor.scale_factor();
        let pos: tauri::LogicalPosition<f64> = monitor.position().to_logical(scale);
        let size: tauri::LogicalSize<f64> = monitor.size().to_logical(scale);
        Self {
            x: pos.x.round() as i32,
            y: pos.y.round() as i32,
            width: size.width.round() as u32,
            height: size.height.round() as u32,
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
    /// Monitor elegido en "Elegir pantalla": id estable de `GET_DISPLAYS`
    /// (F10.0c) o, por compatibilidad, el índice viejo (número/string).
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

    /// Id estable del monitor elegido (`GET_DISPLAYS` de F10.0c), si lo hay.
    /// Un `screen` puramente numérico es el índice viejo, no un id.
    fn screen_id(&self) -> Option<&str> {
        match &self.screen {
            Some(serde_json::Value::String(s)) if s.parse::<usize>().is_err() => Some(s),
            _ => None,
        }
    }

    /// ¿La salida tiene un monitor asignado? (F10.0d). Un `screen` vacío, `null`
    /// o ausente significa "sin asignar" → ventana flotante de vista previa.
    fn has_assigned_monitor(&self) -> bool {
        match &self.screen {
            Some(serde_json::Value::String(s)) => !s.trim().is_empty(),
            Some(serde_json::Value::Number(_)) => true,
            _ => false,
        }
    }
}

/// Contenido actual de una pantalla.
#[derive(Debug, Clone, Default)]
pub struct ScreenScene {
    pub text: Vec<TextBlock>,
    pub media: Vec<MediaItem>,
    pub background: Option<BackgroundMedia>,
    /// Items de texto de las overlays activas (Scene Graph, F4.6).
    pub overlay_text: Vec<TextBlock>,
    /// Items de medio (imágenes) de las overlays activas (Scene Graph, F4.6).
    pub overlay_media: Vec<MediaItem>,
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
    /// Ruta del video suscrito actualmente (el decodificador lo comparte el hub).
    video: Option<String>,
    /// Última transición pedida (la toma el bucle al dibujar el próximo frame).
    transition: Arc<Mutex<Option<TransitionRequest>>>,
}

impl ScreenHandle {
    /// Detiene la pantalla **sin bloquear al llamador**: marca el bucle para que
    /// termine y espera al hilo de render en un hilo aparte; recién después destruye
    /// la ventana. Los comandos de Tauri corren en el hilo principal, y en macOS
    /// cualquier llamada del hilo de render a la ventana pasa por ese hilo: esperar
    /// (`join`) desde ahí colgaba la app al desactivar la audiencia.
    fn stop(&mut self, app: &AppHandle, destroy_window: bool) {
        if let Some(path) = self.video.take() {
            let _ = video_hub_release(app, &path, &self.label);
        }
        self.running.store(false, Ordering::SeqCst);
        let thread = self.thread.take();
        let app = app.clone();
        let label = self.label.clone();
        let _ = thread::Builder::new()
            .name(format!("PulseFlow-Close-{label}"))
            .spawn(move || {
                if let Some(handle) = thread {
                    let _ = handle.join();
                }
                if destroy_window {
                    if let Some(window) = app.get_window(&label) {
                        let _ = window.destroy();
                    }
                }
            });
    }
}

/// Número de ventana para que reabrir una salida mientras la anterior se termina de
/// cerrar no choque con la etiqueta todavía ocupada.
static WINDOW_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Pantallas suscritas a un decodificador compartido (por etiqueta de ventana).
#[derive(Debug, Default)]
struct Subscribers(HashSet<String>);

impl Subscribers {
    /// Suscribe `id`. `true` si era el primero (hay que arrancar el decodificador).
    fn add(&mut self, id: &str) -> bool {
        let first = self.0.is_empty();
        self.0.insert(id.to_string());
        first
    }

    /// Da de baja `id`. `true` si era el último (hay que detener el decodificador).
    fn remove(&mut self, id: &str) -> bool {
        self.0.remove(id) && self.0.is_empty()
    }
}

/// Un video en el hub: un único decodificador, una única textura en VRAM
/// (con la ruta como id) y las pantallas suscritas.
struct SharedVideo {
    playback: VideoPlayback,
    subscribers: Subscribers,
}

/// Estado de todas las pantallas del engine (gestionado por Tauri en `lib.rs`).
pub struct ScreenManager {
    /// Escena por id de salida. Se conserva aunque la pantalla esté cerrada, para
    /// que al abrirla muestre de inmediato el contenido actual.
    scenes: Mutex<HashMap<String, Arc<RwLock<ScreenScene>>>>,
    screens: Mutex<HashMap<String, ScreenHandle>>,
    /// Un decodificador por archivo de video, compartido entre pantallas (F8.2).
    video_hub: Mutex<HashMap<String, SharedVideo>>,
    /// Configuración global de transición hasta que F3 la aplique por pantalla.
    pub(crate) transition_config:
        Mutex<(super::transition::TransitionType, u64, super::transition::EasingType)>,
}

impl ScreenManager {
    pub fn new() -> Self {
        Self {
            scenes: Mutex::new(HashMap::new()),
            screens: Mutex::new(HashMap::new()),
            video_hub: Mutex::new(HashMap::new()),
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

    /// Olvida la escena persistida de una salida eliminada. `true` si existía.
    fn forget_scene(&self, id: &str) -> bool {
        self.scenes.lock_safe().remove(id).is_some()
    }

    /// Parte de `remove_screen` que no toca ventanas: olvida la escena y saca la
    /// pantalla del mapa para que quien llama la detenga.
    fn detach(&self, id: &str) -> Option<ScreenHandle> {
        self.forget_scene(id);
        self.screens.lock_safe().remove(id)
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


mod identify;
mod lifecycle;
mod monitors;
mod render_loop;
mod scene_state;
#[cfg(test)]
mod tests;
mod video_hub;

pub use identify::{identify_screens, IdentifyScreen};
pub use lifecycle::{
    close_all_screens, close_screen, emit_output_state, open_ids, open_screen, remove_screen,
    reposition_screen,
};
pub use monitors::{display_id, monitor_label};
pub use scene_state::{
    set_audience_scene, set_scene_background, set_scene_media, set_scene_text, set_stage_scene,
    set_transition_config,
};

use self::{monitors::*, render_loop::*, video_hub::*};
