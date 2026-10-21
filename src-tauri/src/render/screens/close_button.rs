//! Botón "✕" de cada pantalla: aparece abajo a la izquierda mientras el mouse está sobre la
//! ventana de salida y la cierra al hacer clic (sin depender de Esc).
//!
//! La ventana de salida no tiene webview ni recibe eventos de mouse de Tauri, así que el hilo
//! de render consulta la posición del cursor y el estado del botón izquierdo cada fotograma y
//! dibuja la "✕" con el motor de texto.

use crate::render::types::TextBlock;

/// Posición del cursor dentro de la superficie, en píxeles. Tauri entrega `cursor_position()` en puntos lógicos en
/// macOS y en píxeles físicos en Windows, mientras que `inner_position()` es siempre físico: mezclarlos desplaza el
/// cursor en cualquier monitor con escala distinta de 1.
pub(super) fn cursor_local(
    cursor: (f64, f64),
    inner: (i32, i32),
    scale: f64,
    cursor_in_points: bool,
) -> (f32, f32) {
    let k = if cursor_in_points { scale } else { 1.0 };
    (
        (cursor.0 * k - inner.0 as f64) as f32,
        (cursor.1 * k - inner.1 as f64) as f32,
    )
}

/// Rectángulo del botón en píxeles de la superficie: `(x, y, lado)`.
pub(super) fn button_rect(height: u32) -> (f32, f32, f32) {
    let side = (height as f32 * 0.06).clamp(40.0, 96.0);
    let margin = side * 0.4;
    (margin, height as f32 - margin - side, side)
}

/// Si el punto (en píxeles de la superficie) cae dentro del botón.
pub(super) fn hit(height: u32, px: f32, py: f32) -> bool {
    let (x, y, side) = button_rect(height);
    px >= x && px <= x + side && py >= y && py <= y + side
}

/// Si el punto cae dentro de la ventana (la "✕" sólo se muestra con el mouse encima).
pub(super) fn inside(width: u32, height: u32, px: f32, py: f32) -> bool {
    px >= 0.0 && py >= 0.0 && px < width as f32 && py < height as f32
}

/// Bloque de texto de la "✕". Resaltada (roja) cuando el cursor está justo encima.
pub(super) fn block(height: u32, hovered: bool) -> TextBlock {
    let (x, y, side) = button_rect(height);
    TextBlock {
        text: "✕".to_string(),
        font_size: side * 0.8,
        font_weight: 700,
        color: if hovered {
            [1.0, 0.35, 0.35, 1.0]
        } else {
            [1.0, 1.0, 1.0, 0.9]
        },
        alignment: "center".to_string(),
        x,
        y: y + side * 0.05,
        width: side,
        height: side,
        line_height_ratio: 1.0,
        outline_color: Some([0.0, 0.0, 0.0, 1.0]),
        outline_width: Some(2.0),
        shadow_color: Some([0.0, 0.0, 0.0, 0.8]),
        shadow_offset: Some([2.0, 2.0]),
        ..Default::default()
    }
}

/// Botón izquierdo del mouse apretado ahora mismo (en cualquier app).
#[cfg(target_os = "macos")]
pub(super) fn left_button_down() -> bool {
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceButtonState(state_id: i32, button: u32) -> bool;
    }
    // kCGMouseButtonLeft = 0; estado combinado de la sesión (0) o del hardware (1)
    unsafe { CGEventSourceButtonState(0, 0) || CGEventSourceButtonState(1, 0) }
}

#[cfg(target_os = "windows")]
pub(super) fn left_button_down() -> bool {
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetAsyncKeyState(vkey: i32) -> i16;
    }
    const VK_LBUTTON: i32 = 0x01;
    unsafe { GetAsyncKeyState(VK_LBUTTON) < 0 }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(super) fn left_button_down() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_cursor_in_points_is_scaled_to_the_surface_pixels() {
        // Reportado en un monitor retina (escala 2): cursor (900, 1550) pts, ventana en (248, 1080) pts = (496, 2160) px.
        let (x, y) = cursor_local((900.0, 1550.0), (496, 2160), 2.0, true);
        assert_eq!((x, y), (1304.0, 940.0));
    }

    #[test]
    fn windows_cursor_is_already_physical() {
        let (x, y) = cursor_local((900.0, 1550.0), (500, 1000), 1.5, false);
        assert_eq!((x, y), (400.0, 550.0));
    }

    #[test]
    fn button_sits_bottom_left_and_inside_the_surface() {
        let (x, y, side) = button_rect(1080);
        assert!(x > 0.0 && x < 200.0);
        assert!(y + side < 1080.0 && y > 800.0);
    }

    #[test]
    fn hit_only_inside_the_button() {
        let (x, y, side) = button_rect(1080);
        assert!(hit(1080, x + side / 2.0, y + side / 2.0));
        assert!(!hit(1080, x + side * 2.0, y + side / 2.0));
        assert!(!hit(1080, 960.0, 540.0));
    }

    #[test]
    fn side_is_clamped_for_tiny_and_huge_surfaces() {
        assert_eq!(button_rect(200).2, 40.0);
        assert_eq!(button_rect(4320).2, 96.0);
    }

    #[test]
    fn inside_excludes_points_outside_the_window() {
        assert!(inside(100, 100, 0.0, 0.0));
        assert!(!inside(100, 100, 100.0, 50.0));
        assert!(!inside(100, 100, -1.0, 50.0));
    }
}
