//! Tipos y estructuras de datos para el motor de renderizado GPU y Scene Graph.

use serde::{Deserialize, Serialize};

/// Bloque de texto para proyectar en pantalla.
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Payload para el evento de selección de diapositiva rápida (`SELECT_SLIDE`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectSlidePayload {
    /// Identificador o índice de la diapositiva.
    #[serde(default)]
    pub slide_id: Option<String>,
    /// Título opcional o referencia bíblica.
    #[serde(default)]
    pub title: Option<String>,
    /// Bloques de texto principales a proyectar en el motor nativo.
    #[serde(default)]
    pub text_blocks: Vec<TextBlock>,
}

/// Escena completa para el Scene Graph nativo en GPU.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneGraph {
    pub display_id: u32,
    pub text_blocks: Vec<TextBlock>,
}
