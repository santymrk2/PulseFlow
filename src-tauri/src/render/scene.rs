//! Scene Graph que viaja desde Svelte (`RENDER_SCENE`) hacia el engine.
//!
//! Espejo exacto de `src/types/SceneGraph.ts` (serde `camelCase`): si cambias un
//! campo en un lado, cambia el otro. El payload lleva `version` y este engine
//! rechaza las versiones que no entiende. Las coordenadas de los items están en
//! la resolución lógica de la salida (`width`), y el engine las escala a la
//! resolución real de la ventana.
//!
//! # Qué está implementado en el engine (F4.1)
//!
//! El contrato describe más de lo que el engine dibuja hoy. Implementado de verdad:
//!
//! - `outputId`: rutea la escena a la pantalla con ese id (`ScreenManager`).
//! - `stage`: elige el layout de Stage Display (`plainText`/`nextText`).
//! - `width`: resolución lógica; escala `x`, `width` y `fontSize` (los items
//!   vienen en unidades de diseño). `height` se acepta pero el engine no lo usa.
//! - `background`: imagen o video (con `opacity` y `fit` → `aspect_mode`).
//! - `items` de tipo `text`: caja, alineación horizontal y vertical, línea,
//!   fuente por tramo (`spans`), color, contorno (`stroke`) y sombra (`shadow`).
//! - `items` de tipo `media` (imágenes): caja, `src`, `fit` (cover/contain/fill) y
//!   `opacity` (F4.5). Los videos se aceptan pero el engine todavía no los dibuja.
//! - `transition`: crossfade y corte en el bucle de render (F4.4).
//! - `plainText`/`nextText`: texto del Stage Display.
//! - `overlays`: capa propia con los items de las overlays activas (texto e imagen),
//!   dibujada encima de la slide (F4.6): fondo → medios de la slide → texto de la
//!   slide → medios de los overlays → texto de los overlays. Los overlays con
//!   `placeUnderSlide` viajan igual en esta capa (limitación anotada a propósito).
//!
//! Sólo tipo (llega al engine pero todavía no se dibuja):
//!
//! - `height`.
//! - Items que no son `text` ni `media` (cámaras, web, temporizadores…): se
//!   deserializan como `SceneItem::Unknown` y se ignoran.
//!
//! El contrato se verifica con los fixtures de `src-tauri/tests/fixtures/scene/`
//! (F4.2): los genera el test de vitest `sceneGraphPayload.test.ts` —el payload lo
//! arma `sceneGraphPayload.ts`, único lugar que enumera las claves— y los deserializa
//! `render/scene_contract.rs` con estos tipos.

use super::types::{BackgroundMedia, MediaItem, TextBlock, TextSpan};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// Versión del contrato `SceneGraph` (F4.1). El frontend la manda en cada payload
/// y este engine rechaza cualquier otra (viaja acoplado al frontend).
pub const SCENE_GRAPH_VERSION: u32 = 1;

fn default_scene_version() -> u32 {
    SCENE_GRAPH_VERSION
}

/// Escena completa de una salida.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScenePayload {
    /// Versión del contrato. Si falta en el JSON se asume la actual.
    #[serde(default = "default_scene_version")]
    pub version: u32,
    pub output_id: String,
    /// `true` si la salida es de tipo Stage.
    pub stage: bool,
    /// Resolución lógica de la escena.
    pub width: f32,
    pub height: f32,
    pub background: Option<SceneBackground>,
    pub items: Vec<SceneItem>,
    /// Items de las overlays activas: capa propia dibujada encima de la slide (F4.6).
    pub overlays: Vec<SceneItem>,
    pub transition: Option<SceneTransition>,
    /// Todo el texto de la slide en una cadena (lo usa el Stage Display).
    pub plain_text: String,
    /// Texto de la slide siguiente, si la hay (lo usa el Stage Display).
    pub next_text: Option<String>,
}

impl Default for ScenePayload {
    /// Igual que el `Default` derivado, pero con la versión actual del contrato
    /// (el derivado dejaría `version: 0`, que no es una versión válida).
    fn default() -> Self {
        Self {
            version: SCENE_GRAPH_VERSION,
            output_id: String::new(),
            stage: false,
            width: 0.0,
            height: 0.0,
            background: None,
            items: Vec::new(),
            overlays: Vec::new(),
            transition: None,
            plain_text: String::new(),
            next_text: None,
        }
    }
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
    Media(SceneMediaItem),
    #[serde(other)]
    Unknown,
}

/// Item de medio (imagen o video) colocado dentro de la slide (F4.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneMediaItem {
    #[serde(default)]
    pub id: Option<String>,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    /// Ruta del archivo en disco.
    #[serde(default)]
    pub src: String,
    /// "image" o "video" (el engine sólo dibuja imágenes por ahora).
    #[serde(default = "default_bg_type", rename = "mediaType")]
    pub media_type: String,
    /// "cover", "contain" o "fill"/"stretch".
    #[serde(default)]
    pub fit: Option<String>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
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

    /// F4.1: rechaza un payload de una versión del contrato que este engine no
    /// entiende. Ausente en el JSON = versión actual (compatible con payloads a
    /// mano, p. ej. la consola de `RENDER_SNAPSHOT`).
    pub fn validate_version(&self) -> AppResult<()> {
        if self.version != SCENE_GRAPH_VERSION {
            return Err(AppError::new(format!(
                "Scene Graph versión {} desconocida: este engine entiende la versión {}. Actualizá PulseFlow.",
                self.version, SCENE_GRAPH_VERSION
            )));
        }
        Ok(())
    }

    /// Convierte los items de texto en `TextBlock`s del engine.
    pub fn text_blocks(&self) -> Vec<TextBlock> {
        let design_width = self.design_width();
        self.items
            .iter()
            .filter_map(|item| match item {
                SceneItem::Text(t) => Some(t),
                _ => None,
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

    /// Items de medio (imágenes) colocados dentro de la slide (F4.5).
    pub fn media_items(&self) -> Vec<MediaItem> {
        self.items
            .iter()
            .filter_map(|item| match item {
                SceneItem::Media(m) => Some(m),
                _ => None,
            })
            .filter(|m| !m.src.trim().is_empty())
            .map(|m| MediaItem {
                // El `MediaPool` cachea por ruta (como el fondo): la clave es el `src`.
                id: m.src.clone(),
                path: m.src.clone(),
                media_type: m.media_type.clone(),
                x: m.x,
                y: m.y,
                width: m.width,
                height: m.height,
                aspect_mode: match m.fit.as_deref() {
                    Some("contain") => 1,
                    Some("fill") | Some("stretch") => 2,
                    _ => 0,
                },
                opacity: m.opacity.clamp(0.0, 1.0),
                design_width: Some(self.width),
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

    /// Convierte los items de texto de la capa de overlays en `TextBlock`s del engine (F4.6).
    pub fn overlay_text_blocks(&self) -> Vec<TextBlock> {
        let design_width = self.design_width();
        self.overlays
            .iter()
            .filter_map(|item| match item {
                SceneItem::Text(t) => Some(t),
                _ => None,
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

    /// Items de medio (imágenes) de la capa de overlays (F4.6).
    pub fn overlay_media_items(&self) -> Vec<MediaItem> {
        self.overlays
            .iter()
            .filter_map(|item| match item {
                SceneItem::Media(m) => Some(m),
                _ => None,
            })
            .filter(|m| !m.src.trim().is_empty())
            .map(|m| MediaItem {
                id: m.src.clone(),
                path: m.src.clone(),
                media_type: m.media_type.clone(),
                x: m.x,
                y: m.y,
                width: m.width,
                height: m.height,
                aspect_mode: match m.fit.as_deref() {
                    Some("contain") => 1,
                    Some("fill") | Some("stretch") => 2,
                    _ => 0,
                },
                opacity: m.opacity.clamp(0.0, 1.0),
                design_width: Some(self.width),
            })
            .collect()
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
                { "type": "camera", "src": "x.png" }
            ],
            "transition": { "type": "fade", "durationMs": 500 }
        }))
        .expect("payload válido");

        let blocks = payload.text_blocks();
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].outline_width, Some(2.0));
        assert_eq!(blocks[0].design_width, Some(1920.0));
        assert_eq!(blocks[0].spans.len(), 1);
        assert!(
            payload.media_items().is_empty(),
            "una cámara no es un item de medio"
        );

        let bg = payload.background_media().expect("fondo");
        assert_eq!(bg.aspect_mode, 1);
        assert_eq!(bg.media_type, "video");
    }

    /// F4.5: los items de medio se traducen a `MediaItem` con la caja en la
    /// resolución lógica de la escena y el modo de encaje del contrato.
    #[test]
    fn parses_media_items_with_box_and_fit() {
        let payload: ScenePayload = serde_json::from_value(json!({
            "outputId": "out1",
            "width": 1920,
            "height": 1080,
            "items": [
                { "type": "media", "x": 10, "y": 20, "width": 800, "height": 400,
                  "src": "/a/b.png", "mediaType": "image", "fit": "contain", "opacity": 0.5 },
                { "type": "media", "x": 0, "y": 0, "width": 1920, "height": 1080,
                  "src": "/a/c.mp4", "mediaType": "video", "fit": "fill" },
                // sin src: el engine lo ignora
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10 }
            ]
        }))
        .expect("payload con medios válido");

        let media = payload.media_items();
        assert_eq!(media.len(), 2, "el item sin src se descarta");
        assert!(payload.text_blocks().is_empty());

        assert_eq!(media[0].id, "/a/b.png");
        assert_eq!(media[0].path, "/a/b.png");
        assert_eq!(media[0].media_type, "image");
        assert_eq!(media[0].x, 10.0);
        assert_eq!(media[0].y, 20.0);
        assert_eq!(media[0].width, 800.0);
        assert_eq!(media[0].height, 400.0);
        assert_eq!(media[0].aspect_mode, 1, "contain");
        assert_eq!(media[0].opacity, 0.5);
        assert_eq!(media[0].design_width, Some(1920.0));

        assert_eq!(media[1].media_type, "video");
        assert_eq!(media[1].aspect_mode, 2, "fill");
        assert_eq!(media[1].opacity, 1.0, "opacidad por defecto");
    }

    #[test]
    fn parses_stage_next_text_and_defaults_to_none() {
        let with_next: ScenePayload = serde_json::from_value(json!({
            "outputId": "stage1",
            "stage": true,
            "plainText": "Actual",
            "nextText": "Siguiente"
        }))
        .expect("payload de stage válido");
        assert_eq!(with_next.next_text.as_deref(), Some("Siguiente"));

        let without_next: ScenePayload =
            serde_json::from_value(json!({ "outputId": "stage1", "plainText": "Actual" }))
                .expect("payload sin nextText válido");
        assert!(without_next.next_text.is_none());
    }

    #[test]
    fn empty_payload_does_not_fail() {
        let payload: ScenePayload = serde_json::from_value(json!({})).expect("payload vacío");
        assert!(payload.text_blocks().is_empty());
        assert!(payload.background_media().is_none());
    }

    /// F4.1: la versión ausente se interpreta como la actual (payloads escritos a
    /// mano o de una versión anterior del frontend siguen funcionando).
    #[test]
    fn version_ausente_se_asume_la_actual() {
        let payload: ScenePayload =
            serde_json::from_value(json!({ "outputId": "out1" })).expect("payload sin versión");
        assert_eq!(payload.version, SCENE_GRAPH_VERSION);
        assert!(payload.validate_version().is_ok());
        assert_eq!(ScenePayload::default().version, SCENE_GRAPH_VERSION);
    }

    /// F4.1: una versión conocida del contrato se acepta.
    #[test]
    fn version_actual_se_acepta() {
        let payload: ScenePayload =
            serde_json::from_value(json!({ "version": SCENE_GRAPH_VERSION, "outputId": "out1" }))
                .expect("payload de la versión actual");
        assert!(payload.validate_version().is_ok());
    }

    /// F4.1: una versión que el engine no conoce se rechaza con un mensaje claro
    /// (no se renderiza a medias).
    #[test]
    fn version_desconocida_se_rechaza() {
        let future: ScenePayload =
            serde_json::from_value(json!({ "version": 99, "outputId": "out1" }))
                .expect("payload de versión futura");
        let err = future
            .validate_version()
            .expect_err("la versión 99 debe rechazarse");
        let message = err.message();

        assert!(
            message.contains("99"),
            "el mensaje debe decir la versión recibida: {message}"
        );
        assert!(
            message.contains(&SCENE_GRAPH_VERSION.to_string()),
            "el mensaje debe decir la versión soportada: {message}"
        );
    }
}
