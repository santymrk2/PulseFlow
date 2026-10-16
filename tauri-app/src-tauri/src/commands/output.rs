//! Comandos del dominio `OUTPUT`: pantallas, ventanas y monitores.
//!
//! `GET_DISPLAYS` se apoya en la API nativa de monitores de Tauri
//! (`available_monitors`). `GET_SCREENS` y `GET_WINDOWS` en Electron usan
//! `desktopCapturer`, que no tiene equivalente directo: aquí se derivan de los
//! monitores disponibles y de las ventanas de la propia app. La captura real de
//! pantalla/ventana (para salidas NDI/streaming) llegará con los sidecars
//! (bloque 7).
//!
//! Las utilidades de rutas del sistema del bloque 4 (`OPEN_LOG`, `OPEN_CACHE`,
//! `OPEN_APPDATA`, `OPEN_FOLDER_PATH`) ya quedaron implementadas en
//! `commands/files.rs`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{
    window::Color, AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder,
};

/// Etiqueta (`label`) de la ventana nativa de audiencia.
const OUTPUT_LABEL: &str = "output";

fn monitor_name(index: usize, name: Option<&String>) -> String {
    match name {
        Some(n) if !n.is_empty() => n.clone(),
        _ => format!("Display {}", index + 1),
    }
}

/// `GET_DISPLAYS`: información de todos los monitores (equivalente a
/// `screen.getAllDisplays()`).
#[tauri::command]
pub fn GET_DISPLAYS(app: AppHandle) -> AppResult<Vec<Value>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::new(e.to_string()))?;

    let mut displays = Vec::new();
    for (index, monitor) in monitors.iter().enumerate() {
        let position = monitor.position();
        let size = monitor.size();
        let bounds = json!({
            "x": position.x,
            "y": position.y,
            "width": size.width,
            "height": size.height,
        });
        displays.push(json!({
            "id": index,
            "label": monitor_name(index, monitor.name()),
            "bounds": bounds,
            "workArea": bounds,
            "size": { "width": size.width, "height": size.height },
            "scaleFactor": monitor.scale_factor(),
        }));
    }
    Ok(displays)
}

/// `GET_SCREENS`: fuentes de captura de pantalla `{ name, id }`.
#[tauri::command]
pub fn GET_SCREENS(app: AppHandle) -> AppResult<Vec<Value>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::new(e.to_string()))?;

    let screens = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            json!({
                "name": monitor_name(index, monitor.name()),
                "id": format!("screen:{index}"),
            })
        })
        .collect();
    Ok(screens)
}

/// `GET_WINDOWS`: fuentes de captura de ventana `{ name, id }` (ventanas de la
/// propia app; el resto requerirá captura nativa en el bloque 7).
#[tauri::command]
pub fn GET_WINDOWS(app: AppHandle) -> AppResult<Vec<Value>> {
    let mut windows = Vec::new();
    for (label, window) in app.webview_windows() {
        let name = window.title().unwrap_or_else(|_| label.clone());
        windows.push(json!({
            "name": name,
            "id": format!("window:{label}"),
        }));
    }
    Ok(windows)
}

// ---------------------------------------------------------------------------
// Ventana nativa de audiencia (Output)
// ---------------------------------------------------------------------------

/// Opciones para abrir la ventana de audiencia.
///
/// Todas son opcionales: sin datos se elige automáticamente el monitor
/// secundario (si existe) y pantalla completa.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OutputWindowOptions {
    /// Índice del monitor donde colocar la salida (por defecto: el secundario).
    pub display: Option<usize>,
    /// Fuerza pantalla completa (`true`) o ventana (`false`). Por defecto: auto
    /// (pantalla completa solo si hay un monitor secundario).
    pub fullscreen: Option<bool>,
}

/// `OPEN_OUTPUT_WINDOW`: crea (o enfoca) la ventana nativa de audiencia.
///
/// La ventana reutiliza el mismo frontend React (`index.html`) con su etiqueta
/// `"output"`; `main.tsx` decide renderizar `OutputView` en lugar del panel de
/// control. Es una ventana nativa sin bordes (frameless), con fondo negro.
///
/// Devuelve `true` si la ventana quedó en pantalla completa.
#[tauri::command]
pub fn OPEN_OUTPUT_WINDOW(app: AppHandle, data: Option<OutputWindowOptions>) -> AppResult<bool> {
    // Si ya existe, solo la trae al frente (evita duplicados/desincronización).
    if let Some(window) = app.get_webview_window(OUTPUT_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(window.is_fullscreen().unwrap_or(false));
    }

    let options = data.unwrap_or_default();
    let monitors = app.available_monitors().unwrap_or_default();

    let display = options
        .display
        .unwrap_or_else(|| if monitors.len() > 1 { 1 } else { 0 });
    let target = monitors.get(display).or_else(|| monitors.first());

    // Auto: pantalla completa solo cuando hay un monitor distinto para la salida.
    let fullscreen = options.fullscreen.unwrap_or(monitors.len() > 1);

    let window = WebviewWindowBuilder::new(&app, OUTPUT_LABEL, WebviewUrl::App("index.html".into()))
        .title("FreeShow — Output")
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .background_color(Color(0, 0, 0, 255))
        .visible(false)
        .build()
        .map_err(AppError::from)?;

    if let Some(monitor) = target {
        let position = monitor.position();
        let size = monitor.size();

        if fullscreen {
            // Colocar la ventana dentro del monitor destino antes de maximizar,
            // para que la pantalla completa se aplique a ese monitor.
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

    let _ = window.show();
    let _ = window.set_focus();
    Ok(fullscreen)
}

/// `CLOSE_OUTPUT_WINDOW`: cierra la ventana de audiencia si está abierta.
#[tauri::command]
pub fn CLOSE_OUTPUT_WINDOW(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window(OUTPUT_LABEL) {
        let _ = window.close();
    }
    Ok(())
}

/// `IS_OUTPUT_WINDOW_OPEN`: indica si la ventana de audiencia está abierta.
#[tauri::command]
pub fn IS_OUTPUT_WINDOW_OPEN(app: AppHandle) -> AppResult<bool> {
    Ok(app.get_webview_window(OUTPUT_LABEL).is_some())
}

// ---------------------------------------------------------------------------
// Ventana de Stage (monitores de retorno para músicos/operadores)
// ---------------------------------------------------------------------------

/// Etiqueta (`label`) de la ventana nativa de Stage.
const STAGE_LABEL: &str = "stage";

/// `OPEN_STAGE_WINDOW`: crea (o enfoca) la ventana nativa de Stage.
///
/// A diferencia de la salida de audiencia, es una ventana normal (con bordes y
/// redimensionable) que se abre en el monitor principal por defecto y muestra
/// información de alto contraste (reloj, texto actual, siguiente y notas).
#[tauri::command]
pub fn OPEN_STAGE_WINDOW(app: AppHandle, data: Option<OutputWindowOptions>) -> AppResult<bool> {
    if let Some(window) = app.get_webview_window(STAGE_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(window.is_fullscreen().unwrap_or(false));
    }

    let options = data.unwrap_or_default();
    let monitors = app.available_monitors().unwrap_or_default();
    let display = options.display.unwrap_or(0);
    let target = monitors.get(display).or_else(|| monitors.first());
    let fullscreen = options.fullscreen.unwrap_or(false);

    let window = WebviewWindowBuilder::new(&app, STAGE_LABEL, WebviewUrl::App("index.html".into()))
        .title("FreeShow — Stage")
        .background_color(Color(0, 0, 0, 255))
        .visible(false)
        .build()
        .map_err(AppError::from)?;

    if let Some(monitor) = target {
        let position = monitor.position();
        let size = monitor.size();

        if fullscreen {
            let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
            let _ = window.set_fullscreen(true);
        } else {
            let width = ((size.width as f64) * 0.5).max(640.0) as u32;
            let height = ((size.height as f64) * 0.6).max(360.0) as u32;
            let x = position.x + (size.width.saturating_sub(width) / 2) as i32;
            let y = position.y + (size.height.saturating_sub(height) / 2) as i32;
            let _ = window.set_size(PhysicalSize::new(width, height));
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }

    let _ = window.show();
    let _ = window.set_focus();
    Ok(fullscreen)
}

/// `CLOSE_STAGE_WINDOW`: cierra la ventana de Stage si está abierta.
#[tauri::command]
pub fn CLOSE_STAGE_WINDOW(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window(STAGE_LABEL) {
        let _ = window.close();
    }
    Ok(())
}

/// `IS_STAGE_WINDOW_OPEN`: indica si la ventana de Stage está abierta.
#[tauri::command]
pub fn IS_STAGE_WINDOW_OPEN(app: AppHandle) -> AppResult<bool> {
    Ok(app.get_webview_window(STAGE_LABEL).is_some())
}
