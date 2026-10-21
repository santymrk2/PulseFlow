//! Encuadre del contenido dentro de la ventana de salida (F21.2).
//!
//! La escena trae su propia resolución lógica (`width × height`, con la relación de aspecto elegida
//! en la Pantalla). Si la ventana tiene otra proporción, el contenido se encuadra: se escala hasta
//! que entre entero, se alinea (`alignPosition`: centro, inicio o final) y el resto queda negro,
//! como hacía el render HTML. Con "Original" las proporciones coinciden y el contenido llena la ventana.

/// Dónde se ubica el contenido dentro de la ventana cuando sobra espacio.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentAlign {
    /// Arriba o a la izquierda.
    Start,
    /// Abajo o a la derecha.
    End,
    /// Centrado (por defecto, y lo que se usa ante un valor desconocido).
    #[default]
    #[serde(other)]
    Center,
}

/// Resolución lógica de la escena y su alineación.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ContentFrame {
    pub width: f32,
    pub height: f32,
    pub align: ContentAlign,
}

/// Rectángulo en píxeles de la ventana.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub fn full(width: u32, height: u32) -> Self {
        Self { x: 0, y: 0, width: width.max(1), height: height.max(1) }
    }

    /// Limita el dibujo de `pass` a este rectángulo (viewport + scissor).
    pub fn apply_to(&self, pass: &mut wgpu::RenderPass<'_>) {
        pass.set_viewport(self.x as f32, self.y as f32, self.width as f32, self.height as f32, 0.0, 1.0);
        pass.set_scissor_rect(self.x, self.y, self.width, self.height);
    }
}

/// Diferencia de proporción que se considera "la misma" (evita barras de 1 px por redondeo).
const SAME_RATIO_EPSILON: f32 = 0.002;

/// Rectángulo de la ventana que ocupa el contenido. Sin contenido, o con una resolución inválida,
/// ocupa toda la ventana.
pub fn fit_content_rect(content: Option<ContentFrame>, window_width: u32, window_height: u32) -> Rect {
    let full = Rect::full(window_width, window_height);
    let Some(content) = content else { return full };
    if !(content.width > 0.0 && content.height > 0.0) {
        return full;
    }

    let (ww, wh) = (full.width as f32, full.height as f32);
    let (content_ratio, window_ratio) = (content.width / content.height, ww / wh);
    if (content_ratio - window_ratio).abs() < SAME_RATIO_EPSILON {
        return full;
    }

    // el contenido entra entero: se ajusta al lado que limita
    let (width, height) = if content_ratio > window_ratio { (ww, (ww / content_ratio).round()) } else { ((wh * content_ratio).round(), wh) };
    let (width, height) = (width.clamp(1.0, ww) as u32, height.clamp(1.0, wh) as u32);

    let place = |free: u32| match content.align {
        ContentAlign::Start => 0,
        ContentAlign::Center => free / 2,
        ContentAlign::End => free,
    };
    Rect { x: place(full.width - width), y: place(full.height - height), width, height }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(width: f32, height: f32, align: ContentAlign) -> Option<ContentFrame> {
        Some(ContentFrame { width, height, align })
    }

    #[test]
    fn no_content_or_invalid_content_fills_the_window() {
        assert_eq!(fit_content_rect(None, 1920, 1080), Rect::full(1920, 1080));
        assert_eq!(fit_content_rect(frame(0.0, 0.0, ContentAlign::Center), 1920, 1080), Rect::full(1920, 1080));
        assert_eq!(fit_content_rect(frame(1920.0, -5.0, ContentAlign::Center), 1920, 1080), Rect::full(1920, 1080));
    }

    #[test]
    fn same_ratio_fills_the_window_even_at_another_scale() {
        assert_eq!(fit_content_rect(frame(1920.0, 1080.0, ContentAlign::Center), 1280, 720), Rect::full(1280, 720));
        // casi la misma proporción (redondeo de la resolución): sin barras de 1 px
        assert_eq!(fit_content_rect(frame(1512.0, 982.0, ContentAlign::Center), 1512, 983), Rect::full(1512, 983));
    }

    #[test]
    fn narrower_content_is_pillarboxed_and_aligned() {
        // 4:3 en una ventana 16:9 de 1920×1080 → 1440×1080 con barras a los costados
        let center = fit_content_rect(frame(4.0, 3.0, ContentAlign::Center), 1920, 1080);
        assert_eq!(center, Rect { x: 240, y: 0, width: 1440, height: 1080 });

        assert_eq!(fit_content_rect(frame(4.0, 3.0, ContentAlign::Start), 1920, 1080).x, 0);
        assert_eq!(fit_content_rect(frame(4.0, 3.0, ContentAlign::End), 1920, 1080).x, 480);
    }

    #[test]
    fn wider_content_is_letterboxed_and_aligned() {
        // 16:9 en una ventana 4:3 de 1024×768 → 1024×576 con barras arriba y abajo
        let center = fit_content_rect(frame(16.0, 9.0, ContentAlign::Center), 1024, 768);
        assert_eq!(center, Rect { x: 0, y: 96, width: 1024, height: 576 });

        assert_eq!(fit_content_rect(frame(16.0, 9.0, ContentAlign::Start), 1024, 768).y, 0);
        assert_eq!(fit_content_rect(frame(16.0, 9.0, ContentAlign::End), 1024, 768).y, 192);
    }

    #[test]
    fn the_rect_always_fits_inside_the_window() {
        for (cw, ch) in [(1.0, 1.0), (21.0, 9.0), (9.0, 16.0), (1.0, 1000.0), (1000.0, 1.0)] {
            for align in [ContentAlign::Start, ContentAlign::Center, ContentAlign::End] {
                let rect = fit_content_rect(frame(cw, ch, align), 1366, 768);
                assert!(rect.width >= 1 && rect.height >= 1, "{cw}x{ch}: {rect:?}");
                assert!(rect.x + rect.width <= 1366 && rect.y + rect.height <= 768, "{cw}x{ch}: {rect:?}");
            }
        }
    }

    #[test]
    fn unknown_alignment_falls_back_to_center() {
        let known: ContentAlign = serde_json::from_str("\"end\"").expect("end");
        assert_eq!(known, ContentAlign::End);
        let unknown: ContentAlign = serde_json::from_str("\"diagonal\"").expect("desconocido");
        assert_eq!(unknown, ContentAlign::Center);
    }
}
