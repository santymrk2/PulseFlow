//! Monitores: selección del monitor de una salida y ubicación de la ventana.

use super::*;

// ---------------------------------------------------------------------------
// Monitores
// ---------------------------------------------------------------------------

/// Selección pura del monitor de una salida (testeable sin monitores reales):
/// 1. el id estable elegido (`screen_ids` de F10.0c), 2. el que contiene el centro
/// de `bounds`, 3. el elegido por índice, 4. el secundario (o el único si hay uno).
pub(super) fn select_monitor_index(
    monitors: &[ScreenRect],
    bounds: Option<ScreenRect>,
    screen_index: Option<usize>,
    screen_id: Option<&str>,
    display_ids: &[String],
) -> Option<usize> {
    if monitors.is_empty() {
        return None;
    }
    if let Some(id) = screen_id {
        if let Some(i) = display_ids.iter().position(|a| a == id).filter(|i| *i < monitors.len()) {
            return Some(i);
        }
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

/// Nombre legible de un monitor (o uno genérico si el sistema no lo da).
/// Compartido con `GET_DISPLAYS` (F10.0c).
pub fn monitor_label(index: usize, name: Option<&String>) -> String {
    match name {
        Some(n) if !n.is_empty() => n.clone(),
        _ => format!("Display {}", index + 1),
    }
}

/// Id estable de un monitor: nombre + índice como desempate (el índice cambia al
/// conectar/desconectar; el nombre no). Compartido con `GET_DISPLAYS` (F10.0c).
pub fn display_id(index: usize, name: Option<&String>) -> String {
    format!("{}#{index}", monitor_label(index, name))
}

/// Monitor de la salida, según `select_monitor_index`.
pub(super) fn target_monitor(monitors: &[Monitor], config: &ScreenConfig) -> Option<Monitor> {
    let rects: Vec<ScreenRect> = monitors.iter().map(ScreenRect::of_monitor).collect();
    let display_ids: Vec<String> = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| display_id(i, m.name()))
        .collect();
    select_monitor_index(&rects, config.bounds, config.screen_index(), config.screen_id(), &display_ids)
        .and_then(|i| monitors.get(i).cloned())
}

/// Rectángulo 16:9 de la ventana flotante de vista previa (mismo monitor que la
/// app de control). Puro y testeable. `kind` sólo cambia el tamaño y el offset.
pub(super) fn floating_preview_rect(monitor: ScreenRect, kind: ScreenKind) -> (f64, f64, f64, f64) {
    let scale = if kind == ScreenKind::Stage { 0.4 } else { 0.45 };
    let width = ((monitor.width as f64) * scale).max(480.0);
    let height = width * 9.0 / 16.0;
    let offset = if kind == ScreenKind::Stage { 40.0 } else { 0.0 };
    let x = monitor.x as f64 + monitor.width as f64 - width - 40.0 - offset;
    let y = monitor.y as f64 + monitor.height as f64 - height - 80.0 - offset;
    (x, y, width, height)
}

/// Coloca la ventana de una salida (F10.0d):
/// - **Con monitor asignado** (`output.screen`): siempre sin bordes y a pantalla
///   completa en ese monitor, **aunque sea el mismo monitor de la app** (como
///   ProPresenter). Con `bounds` más chicos que el monitor, se respetan.
/// - **Sin monitor asignado**: ventana flotante 16:9 de vista previa, para no
///   tapar la UI de control.
pub(super) fn place_window(app: &AppHandle, window: &Window, config: &ScreenConfig, kind: ScreenKind) {
    let monitors = app.available_monitors().unwrap_or_default();
    let Some(monitor) = target_monitor(&monitors, config) else { return };
    let monitor_rect = ScreenRect::of_monitor(&monitor);

    let assigned = config.has_assigned_monitor();
    let bounds = config.bounds.filter(|b| b.width > 0 && b.height > 0);
    let covers_monitor = bounds
        .map(|b| b.width >= monitor_rect.width && b.height >= monitor_rect.height)
        .unwrap_or(true);

    let _ = window.set_simple_fullscreen(false);

    if !assigned {
        // Sin monitor asignado: vista previa flotante 16:9 (no tapa el control).
        let (x, y, width, height) = floating_preview_rect(monitor_rect, kind);
        let _ = window.set_decorations(true);
        let _ = window.set_size(LogicalSize::new(width, height));
        let _ = window.set_position(LogicalPosition::new(x, y));
        return;
    }

    // Monitor asignado: sin bordes y a pantalla completa en ese monitor.
    // (`always_on_top` lo aplica `open_screen` según `config.always_on_top`.)
    let _ = window.set_decorations(false);
    match bounds {
        // Bounds personalizados (más chicos que el monitor): respetarlos tal cual.
        Some(b) if !covers_monitor => {
            let _ = window.set_size(LogicalSize::new(b.width as f64, b.height as f64));
            let _ = window.set_position(LogicalPosition::new(b.x as f64, b.y as f64));
        }
        _ => {
            // Mover primero al monitor elegido y recién después pantalla completa:
            // si no, macOS ocupa el monitor donde estaba la ventana.
            let _ = window.set_position(LogicalPosition::new(monitor_rect.x as f64, monitor_rect.y as f64));
            let _ = window.set_size(LogicalSize::new(monitor_rect.width as f64, monitor_rect.height as f64));
            let _ = window.set_simple_fullscreen(true);
        }
    }
}

