//! Scene Graph que viaja desde Svelte (`RENDER_SCENE`) hacia el engine.
//!
//! Espejo de `src/types/SceneGraph.ts`. Las coordenadas de los items están en la
//! resolución lógica de la salida (`width` x `height`, normalmente 1920 de ancho);
//! el engine las escala a la resolución real de la ventana.

use super::types::{BackgroundMedia, TextBlock, TextSpan};
use serde::{Deserialize, Serialize};

/// Escena completa de una salida.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScenePayload {
    pub output_id: String,
    /// `true` si la salida es de tipo Stage.
    pub stage: bool,
    /// Resolución lógica de la escena.
    pub width: f32,
    pub height: f32,
    pub background: Option<SceneBackground>,
    pub items: Vec<SceneItem>,
    pub transition: Option<SceneTransition>,
    /// Todo el texto de la slide en una cadena (lo usa el Stage Display).
    pub plain_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneBackground {
    pub path: String,
    /// "image" o "video".
    #[serde(default = "default_bg_type", rename = "type")]
    pub media_type: String,
    /// "cover", "contain" o "fill"/"stretch".
    #[serde(default)]
    pub fit: Option<String>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default, rename = "loop")]
    pub looping: bool,
    #[serde(default)]
    pub muted: bool,
}

fn default_bg_type() -> String {
    "image".to_string()
}

fn default_opacity() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneTransition {
    /// Tipo de transición del frontend ("none", "fade", "crossfade", "slide"...).
    #[serde(rename = "type")]
    pub transition_type: String,
    pub duration_ms: u64,
    #[serde(default)]
    pub easing: Option<String>,
}

impl SceneTransition {
    /// Nombre de transición que entiende el engine (`TransitionType::from_str`).
    pub fn engine_name(&self) -> &'static str {
        match self.transition_type.to_lowercase().as_str() {
            "none" => "none",
            "slide" | "fly" => "pushLeft",
            // fade, crossfade, blur, scale, spin... se aproximan con crossfade
            _ => "crossfade",
        }
    }
}

/// Item de la escena. Los tipos que el engine aún no soporta llegan como `Unknown`
/// y se ignoran, para no romper con payloads nuevos.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SceneItem {
    Text(SceneTextItem),
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneTextItem {
    #[serde(default)]
    pub id: Option<String>,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    #[serde(default = "default_align")]
    pub align: String,
    #[serde(default)]
    pub vertical_align: Option<String>,
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default = "default_font_size")]
    pub font_size: f32,
    #[serde(default = "default_font_weight")]
    pub font_weight: u16,
    #[serde(default)]
    pub font_style: Option<String>,
    #[serde(default = "default_color")]
    pub color: [f32; 4],
    #[serde(default)]
    pub stroke: Option<SceneStroke>,
    #[serde(default)]
    pub shadow: Option<SceneShadow>,
    /// Texto completo (se usa si no hay `spans`).
    #[serde(default)]
    pub text: String,
    /// Tramos con estilo propio; los saltos de línea van dentro de los textos.
    #[serde(default)]
    pub spans: Vec<TextSpan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneStroke {
    pub color: [f32; 4],
    pub width: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneShadow {
    pub color: [f32; 4],
    pub offset_x: f32,
    pub offset_y: f32,
}

fn default_align() -> String {
    "center".to_string()
}
fn default_line_height() -> f32 {
    1.1
}
fn default_font_size() -> f32 {
    100.0
}
fn default_font_weight() -> u16 {
    400
}
fn default_color() -> [f32; 4] {
    [1.0, 1.0, 1.0, 1.0]
}

impl ScenePayload {
    /// Ancho lógico de la escena (1920 si no viene informado).
    pub fn design_width(&self) -> f32 {
        if self.width > 0.0 { self.width } else { 1920.0 }
    }

    /// Convierte los items de texto en `TextBlock`s del engine.
    pub fn text_blocks(&self) -> Vec<TextBlock> {
        let design_width = self.design_width();
        self.items
            .iter()
            .filter_map(|item| match item {
                SceneItem::Text(t) => Some(t),
                SceneItem::Unknown => None,
            })
            .filter(|t| !t.text.trim().is_empty() || t.spans.iter().any(|s| !s.text.trim().is_empty()))
            .map(|t| TextBlock {
                text: t.text.clone(),
                font_family: t.font_family.clone(),
                font_size: t.font_size,
                font_weight: t.font_weight,
                font_style: t.font_style.clone(),
                color: t.color,
                alignment: t.align.clone(),
                x: t.x,
                y: t.y,
                width: t.width,
                height: t.height,
                line_height_ratio: t.line_height,
                outline_color: t.stroke.as_ref().map(|s| s.color),
                outline_width: t.stroke.as_ref().map(|s| s.width),
                shadow_color: t.shadow.as_ref().map(|s| s.color),
                shadow_offset: t.shadow.as_ref().map(|s| [s.offset_x, s.offset_y]),
                spans: t.spans.clone(),
                vertical_align: t.vertical_align.clone(),
                design_width: Some(design_width),
            })
            .collect()
    }

    /// Fondo del engine (si lo hay).
    pub fn background_media(&self) -> Option<BackgroundMedia> {
        self.background.as_ref().filter(|b| !b.path.is_empty()).map(|b| BackgroundMedia {
            id: b.path.clone(),
            path: Some(b.path.clone()),
            media_type: b.media_type.clone(),
            opacity: b.opacity.clamp(0.0, 1.0),
            aspect_mode: match b.fit.as_deref() {
                Some("contain") => 1,
                Some("fill") | Some("stretch") => 2,
                _ => 0,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_text_item_and_ignores_unknown_items() {
        let payload: ScenePayload = serde_json::from_value(json!({
            "outputId": "out1",
            "width": 1920,
            "height": 1080,
            "background": { "path": "/a/b.mp4", "type": "video", "fit": "contain", "opacity": 1, "loop": true },
            "items": [
                { "type": "text", "x": 10, "y": 20, "width": 800, "height": 400, "text": "Hola",
                  "spans": [{ "text": "Hola", "color": [1, 0, 0, 1] }],
                  "stroke": { "color": [0, 0, 0, 1], "width": 2 } },
                { "type": "media", "src": "x.png" }
            ],
            "transition": { "type": "fade", "durationMs": 500 }
        }))
        .expect("payload válido");

        let blocks = payload.text_blocks();
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].outline_width, Some(2.0));
        assert_eq!(blocks[0].design_width, Some(1920.0));
        assert_eq!(blocks[0].spans.len(), 1);

        let bg = payload.background_media().expect("fondo");
        assert_eq!(bg.aspect_mode, 1);
        assert_eq!(bg.media_type, "video");
    }

    #[test]
    fn empty_payload_does_not_fail() {
        let payload: ScenePayload = serde_json::from_value(json!({})).expect("payload vacío");
        assert!(payload.text_blocks().is_empty());
        assert!(payload.background_media().is_none());
    }
}
