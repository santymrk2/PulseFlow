//! Tipos y estructuras de datos para el motor de renderizado GPU y Scene Graph.

use super::scene::SceneBox;
use serde::{Deserialize, Serialize};

/// Bloque de texto para proyectar en pantalla.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextBlock {
    /// Contenido textual (canción, versículo, título, notas).
    pub text: String,
    /// Familia tipográfica (e.g. "Inter", "Arial", "CMG Sans", etc.).
    #[serde(default)]
    pub font_family: Option<String>,
    /// Tamaño de fuente en puntos/píxeles.
    #[serde(default = "default_font_size")]
    pub font_size: f32,
    /// Peso de la fuente (400 normal, 700 bold, etc.).
    #[serde(default = "default_font_weight")]
    pub font_weight: u16,
    /// Estilo: "normal", "italic".
    #[serde(default)]
    pub font_style: Option<String>,
    /// Color del texto en formato RGBA [r, g, b, a] normalizado de 0.0 a 1.0.
    #[serde(default = "default_white_color")]
    pub color: [f32; 4],
    /// Alineación: "left", "center", "right", "justify".
    #[serde(default = "default_alignment")]
    pub alignment: String,
    /// Posición X en coordenadas de pantalla.
    #[serde(default)]
    pub x: f32,
    /// Posición Y en coordenadas de pantalla.
    #[serde(default)]
    pub y: f32,
    /// Ancho del cuadro de texto (para auto-wrap).
    #[serde(default = "default_box_size")]
    pub width: f32,
    /// Alto del cuadro de texto.
    #[serde(default = "default_box_size")]
    pub height: f32,
    /// Altura de línea proporcional (1.2 por defecto).
    #[serde(default = "default_line_height")]
    pub line_height_ratio: f32,
    /// Color del contorno / borde (stroke).
    #[serde(default)]
    pub outline_color: Option<[f32; 4]>,
    /// Grosor del contorno en píxeles.
    #[serde(default)]
    pub outline_width: Option<f32>,
    /// Color de la sombra arrojada (drop shadow).
    #[serde(default)]
    pub shadow_color: Option<[f32; 4]>,
    /// Desplazamiento de la sombra [dx, dy] en píxeles.
    #[serde(default)]
    pub shadow_offset: Option<[f32; 2]>,
    /// Tramos con estilo propio (color, tamaño, peso...). Si está vacío se usa
    /// `text` con el estilo del bloque. Los saltos de línea van dentro de los textos.
    #[serde(default)]
    pub spans: Vec<TextSpan>,
    /// Alineación vertical dentro del cuadro: "top" (por defecto), "center", "bottom".
    #[serde(default)]
    pub vertical_align: Option<String>,
    /// Ancho de la resolución lógica en la que están expresados x/y/width/height/font_size.
    /// Si está presente, el bloque se escala a la resolución real de la ventana
    /// (`ventana / design_width`). Si es `None`, las coordenadas son píxeles de pantalla.
    #[serde(default)]
    pub design_width: Option<f32>,
    /// El texto cambia solo con el tiempo (reloj, timer): actualizarlo no pide transición.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub live: bool,
    /// Caja del cuadro (fondo, borde, esquinas, opacidad, padding): el engine la dibuja antes del texto (F23.16).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub box_style: Option<SceneBox>,
    /// Espaciado entre letras en las unidades del bloque (px); `None` = el de la fuente (F23.18).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub letter_spacing: Option<f32>,
}

impl TextBlock {
    /// Rect completo de la caja (el texto está achicado por el padding) en las unidades del bloque.
    pub fn box_rect(&self) -> Option<(&SceneBox, [f32; 4])> {
        let style = self.box_style.as_ref()?;
        let pad = style.padding.unwrap_or_default();
        Some((style, [self.x - pad.left, self.y - pad.top, self.width + pad.left + pad.right, self.height + pad.top + pad.bottom]))
    }
}

impl Default for TextBlock {
    fn default() -> Self {
        Self {
            text: String::new(),
            font_family: None,
            font_size: default_font_size(),
            font_weight: default_font_weight(),
            font_style: None,
            color: default_white_color(),
            alignment: default_alignment(),
            x: 0.0,
            y: 0.0,
            width: default_box_size(),
            height: default_box_size(),
            line_height_ratio: default_line_height(),
            outline_color: None,
            outline_width: None,
            shadow_color: None,
            shadow_offset: None,
            spans: Vec::new(),
            vertical_align: None,
            design_width: None,
            live: false,
            box_style: None,
            letter_spacing: None,
        }
    }
}

/// Tramo de texto con estilo propio dentro de un `TextBlock`.
/// Los campos ausentes heredan el estilo del bloque.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextSpan {
    pub text: String,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub font_size: Option<f32>,
    #[serde(default)]
    pub font_weight: Option<u16>,
    #[serde(default)]
    pub font_style: Option<String>,
    #[serde(default)]
    pub color: Option<[f32; 4]>,
    /// Subrayado (F23.18): lo dibuja el engine como un rectángulo bajo la línea base.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub underline: bool,
    /// Tachado (F23.18): rectángulo a media altura.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub strike: bool,
}

fn default_font_size() -> f32 {
    48.0
}

fn default_font_weight() -> u16 {
    600
}

fn default_white_color() -> [f32; 4] {
    [1.0, 1.0, 1.0, 1.0]
}

fn default_alignment() -> String {
    "center".to_string()
}

fn default_box_size() -> f32 {
    1800.0
}

fn default_line_height() -> f32 {
    1.25
}

/// Medio de fondo (imagen o video) cargado en VRAM.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundMedia {
    pub id: String,
    pub path: Option<String>,
    #[serde(default = "default_media_type")]
    pub media_type: String, // "image", "video"
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_aspect_mode")]
    pub aspect_mode: u32, // 0 = Cover, 1 = Contain, 2 = Stretch
    /// Transporte del webview (F23.14): pausa y posición que el video del engine sigue.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub paused: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_ms: Option<u64>,
}

impl BackgroundMedia {
    /// El fondo sin el transporte: lo que decide si la imagen cambió (el transporte cambia cada segundo).
    pub fn without_transport(&self) -> Self {
        Self { paused: false, position_ms: None, ..self.clone() }
    }
}

fn default_media_type() -> String {
    "image".to_string()
}

fn default_opacity() -> f32 {
    1.0
}

fn default_aspect_mode() -> u32 {
    0 // Cover
}

/// Item de medio (imagen) colocado dentro de la slide (F4.5).
///
/// El fondo (`BackgroundMedia`) cubre toda la salida; esto es un medio con su
/// propia caja en coordenadas de la resolución lógica de la escena.
#[derive(Debug, Clone, PartialEq)]
pub struct MediaItem {
    /// Clave de caché en el `MediaPool` (el `src` si no hay id propio).
    pub id: String,
    /// Id del ítem en la slide; para un video es parte de su id de suscripción al hub (F23.20).
    pub item_id: Option<String>,
    /// Ruta del archivo en disco.
    pub path: String,
    /// "image" o "video" (los videos los decodifica el hub, F23.20).
    pub media_type: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    /// 0 = Cover, 1 = Contain, 2 = Stretch.
    pub aspect_mode: u32,
    pub opacity: f32,
    /// Resolución lógica de la escena; el engine escala la caja a la ventana
    /// (`ventana / design_width`). Si es `None`, las coordenadas son píxeles.
    pub design_width: Option<f32>,
    /// Caja del cuadro: se dibuja justo antes del medio (F23.16).
    pub box_style: Option<SceneBox>,
    /// Transporte del webview para un video (F23.20): igual que en el fondo.
    pub paused: bool,
    pub position_ms: Option<u64>,
}

impl MediaItem {
    /// El ítem sin el transporte: lo que decide si la escena cambió (el transporte cambia cada segundo).
    pub fn without_transport(&self) -> Self {
        Self { paused: false, position_ms: None, ..self.clone() }
    }
}

/// Elemento de superposición superior (reloj, avisos, tercios inferiores).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayItem {
    pub id: String,
    #[serde(default = "default_overlay_type")]
    pub item_type: String, // "clock", "alert", "lower_third"
    pub text: String,
    pub x: f32,
    pub y: f32,
    #[serde(default = "default_overlay_font_size")]
    pub font_size: f32,
    #[serde(default = "default_white_color")]
    pub color: [f32; 4],
    pub background_color: Option<[f32; 4]>,
}

fn default_overlay_type() -> String {
    "clock".to_string()
}

fn default_overlay_font_size() -> f32 {
    36.0
}

/// Datos para el Stage Display (retorno de escenario para músicos/pastor).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageData {
    /// Texto de la diapositiva actual.
    #[serde(default)]
    pub current_slide: String,
    /// Texto de la diapositiva siguiente (anticipación).
    #[serde(default)]
    pub next_slide: Option<String>,
    /// Reloj o temporizador en tiempo real.
    #[serde(default)]
    pub clock: Option<String>,
    /// Alerta o mensaje privado para el escenario.
    #[serde(default)]
    pub message: Option<String>,
}



#[cfg(test)]
mod tests_f2318 {
    use super::*;

    #[test]
    fn decoracion_y_espaciado_se_deserializan_y_se_omiten_si_faltan() {
        let block: TextBlock = serde_json::from_str(r#"{"text":"ab","letterSpacing":4,"spans":[{"text":"a","underline":true,"strike":true},{"text":"b"}]}"#).expect("bloque");
        assert_eq!(block.letter_spacing, Some(4.0));
        assert!(block.spans[0].underline && block.spans[0].strike);
        assert!(!block.spans[1].underline && !block.spans[1].strike);
        let json = serde_json::to_value(&block.spans[1]).expect("tramo a JSON");
        assert!(json.get("underline").is_none() && json.get("strike").is_none());
        assert_ne!(block.spans[0], block.spans[1]);
        assert!(serde_json::to_value(TextBlock::default()).expect("json").get("letterSpacing").is_none());
    }
}
