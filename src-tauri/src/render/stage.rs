//! Layout de Stage Display (Retorno de escenario).
//!
//! El Stage no tiene ciclo de vida propio: es otro layout dentro del mismo bucle
//! de render de `screens.rs` (F2.1). Este módulo sólo traduce `StageData` en
//! bloques de texto de alto contraste para una ventana de `w x h`:
//! - Fondo negro puro (sin distracciones): lo limpia el pass de render.
//! - Diapositiva actual en amarillo de alto contraste.
//! - Siguiente diapositiva en gris claro (anticipación para músicos y cantantes).
//! - Reloj en tiempo real, verde, arriba a la derecha.
//! - Alertas o mensajes pastorales en la parte inferior.

use crate::render::types::{StageData, TextBlock};

/// Construye los bloques de texto del layout de stage para una ventana de `w x h`.
pub fn stage_blocks(data: &StageData, w: f32, h: f32) -> Vec<TextBlock> {
    let mut blocks = Vec::new();

    // 1. Reloj / Timer en la esquina superior derecha (verde brillante)
    let clock_text = data
        .clock
        .clone()
        .unwrap_or_else(|| chrono::Local::now().format("%H:%M:%S").to_string());
    blocks.push(TextBlock {
        text: clock_text,
        font_family: None,
        font_size: (h * 0.06).clamp(24.0, 48.0),
        font_weight: 700,
        font_style: None,
        color: [0.3, 0.9, 0.3, 1.0],
        alignment: "right".to_string(),
        x: 40.0,
        y: 30.0,
        width: w - 80.0,
        height: 60.0,
        line_height_ratio: 1.2,
        ..Default::default()
    });

    // 2. Diapositiva Actual (amarillo vibrante, grande)
    if !data.current_slide.is_empty() {
        blocks.push(TextBlock {
            text: data.current_slide.clone(),
            font_family: None,
            font_size: (h * 0.08).clamp(32.0, 72.0),
            font_weight: 700,
            font_style: None,
            color: [1.0, 0.92, 0.23, 1.0],
            alignment: "left".to_string(),
            x: 50.0,
            y: h * 0.16,
            width: w - 100.0,
            height: h * 0.40,
            line_height_ratio: 1.25,
            ..Default::default()
        });
    }

    // 3. Siguiente diapositiva (gris claro para anticipación)
    if let Some(ref next) = data.next_slide {
        if !next.is_empty() {
            blocks.push(TextBlock {
                text: format!("SIGUIENTE: {next}"),
                font_family: None,
                font_size: (h * 0.05).clamp(20.0, 40.0),
                font_weight: 600,
                font_style: None,
                color: [0.7, 0.7, 0.7, 1.0],
                alignment: "left".to_string(),
                x: 50.0,
                y: h * 0.62,
                width: w - 100.0,
                height: h * 0.25,
                line_height_ratio: 1.2,
                ..Default::default()
            });
        }
    }

    // 4. Mensaje / Alerta Pastoral (rojo anaranjado, abajo)
    if let Some(ref msg) = data.message {
        if !msg.is_empty() {
            blocks.push(TextBlock {
                text: msg.clone(),
                font_family: None,
                font_size: (h * 0.05).clamp(20.0, 36.0),
                font_weight: 700,
                font_style: None,
                color: [1.0, 0.3, 0.2, 1.0],
                alignment: "center".to_string(),
                x: 50.0,
                y: h * 0.90,
                width: w - 100.0,
                height: 50.0,
                line_height_ratio: 1.2,
                ..Default::default()
            });
        }
    }

    blocks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stage_layout_has_clock_and_slides() {
        let data = StageData {
            current_slide: "Actual".into(),
            next_slide: Some("Siguiente".into()),
            ..Default::default()
        };
        let blocks = stage_blocks(&data, 1920.0, 1080.0);
        assert_eq!(blocks.len(), 3); // reloj + actual + siguiente
        assert_eq!(blocks[1].text, "Actual");
        assert_eq!(blocks[2].text, "SIGUIENTE: Siguiente");
    }

    #[test]
    fn stage_layout_empty_data_only_has_clock() {
        let blocks = stage_blocks(&StageData::default(), 1280.0, 720.0);
        assert_eq!(blocks.len(), 1);
        assert!(!blocks[0].text.is_empty()); // el reloj siempre está
    }

    #[test]
    fn stage_layout_includes_message_and_keeps_contrast_colors() {
        let data = StageData {
            current_slide: "Sublime gracia".into(),
            next_slide: Some("Fui ciego".into()),
            clock: Some("11:45 AM".into()),
            message: Some("Pastor listo".into()),
        };
        let blocks = stage_blocks(&data, 1920.0, 1080.0);
        assert_eq!(blocks.len(), 4);
        assert_eq!(blocks[0].text, "11:45 AM");
        assert_eq!(blocks[3].text, "Pastor listo");
        // Amarillo para la actual, gris para la siguiente.
        assert_eq!(blocks[1].color, [1.0, 0.92, 0.23, 1.0]);
        assert_eq!(blocks[2].color, [0.7, 0.7, 0.7, 1.0]);
    }
}
