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
//! - `stage`: elige el layout de Stage Display (`plainText`/`nextText`, o `items` si el usuario diseñó un layout, F23.19).
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

use super::frame::{ContentAlign, ContentFrame};
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
    /// Dónde se ubica la escena dentro de la ventana cuando su proporción no coincide (F21.2).
    /// Si falta, centro.
    #[serde(default)]
    pub align: ContentAlign,
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
            align: ContentAlign::default(),
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
    /// El transporte del webview está en pausa (F23.14).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub paused: bool,
    /// Posición del transporte del webview en ms: el video del engine la sigue.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_ms: Option<u64>,
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
    /// "image" o "video" (un video lo decodifica el hub y sigue el transporte del webview, F23.20).
    #[serde(default = "default_bg_type", rename = "mediaType")]
    pub media_type: String,
    /// "cover", "contain" o "fill"/"stretch".
    #[serde(default)]
    pub fit: Option<String>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    /// Fondo, borde, esquinas y opacidad del cuadro (F23.16).
    #[serde(default, rename = "box", skip_serializing_if = "Option::is_none")]
    pub box_style: Option<SceneBox>,
    /// Transporte del webview para un video (F23.20): igual que en el fondo.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub paused: bool,
    #[serde(default, rename = "positionMs", skip_serializing_if = "Option::is_none")]
    pub position_ms: Option<u64>,
}

/// Margen interior de un cuadro, en unidades de la resolución lógica.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct ScenePadding {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

/// Caja de un ítem (F23.16): se dibuja en el rect completo, antes del contenido. `opacity` multiplica caja,
/// texto y medio; `padding` achica el rect del texto.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SceneBox {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<[f32; 4]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_color: Option<[f32; 4]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_width: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<ScenePadding>,
}

impl SceneBox {
    /// Opacidad efectiva (0..=1; sin valor, opaco).
    pub fn opacity_factor(&self) -> f32 {
        self.opacity.unwrap_or(1.0).clamp(0.0, 1.0)
    }
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
    /// El texto cambia solo con el tiempo (reloj, timer): no cuenta como cambio de escena.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub live: bool,
    /// Fondo, borde, esquinas, opacidad y padding del cuadro (F23.16).
    #[serde(default, rename = "box", skip_serializing_if = "Option::is_none")]
    pub box_style: Option<SceneBox>,
    /// Espaciado entre letras en px (F23.18).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub letter_spacing: Option<f32>,
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

/// Multiplica el alfa de un color por la opacidad del cuadro.
fn faded(color: [f32; 4], opacity: f32) -> [f32; 4] {
    [color[0], color[1], color[2], color[3] * opacity]
}

/// Item de texto -> bloque del engine. `opacity` multiplica el alfa del texto, el contorno y la sombra;
/// `padding` achica el rect (la caja se dibuja con el rect completo: ver `TextBlock::box_rect`).
fn text_block(t: &SceneTextItem, design_width: f32) -> TextBlock {
    let opacity = t.box_style.as_ref().map_or(1.0, SceneBox::opacity_factor);
    let pad = t.box_style.as_ref().and_then(|b| b.padding).unwrap_or_default();
    TextBlock {
        text: t.text.clone(),
        font_family: t.font_family.clone(),
        font_size: t.font_size,
        font_weight: t.font_weight,
        font_style: t.font_style.clone(),
        color: faded(t.color, opacity),
        alignment: t.align.clone(),
        x: t.x + pad.left,
        y: t.y + pad.top,
        // shortcut: un padding mayor que el cuadro deja 1 unidad de texto y la caja se agranda; no hay caso real
        width: (t.width - pad.left - pad.right).max(1.0),
        height: (t.height - pad.top - pad.bottom).max(1.0),
        line_height_ratio: t.line_height,
        outline_color: t.stroke.as_ref().map(|s| faded(s.color, opacity)),
        outline_width: t.stroke.as_ref().map(|s| s.width),
        shadow_color: t.shadow.as_ref().map(|s| faded(s.color, opacity)),
        shadow_offset: t.shadow.as_ref().map(|s| [s.offset_x, s.offset_y]),
        spans: t.spans.iter().map(|s| TextSpan { color: s.color.map(|c| faded(c, opacity)), ..s.clone() }).collect(),
        vertical_align: t.vertical_align.clone(),
        design_width: Some(design_width),
        live: t.live,
        box_style: t.box_style.clone(),
        letter_spacing: t.letter_spacing,
    }
}

/// Item de medio -> `MediaItem` del engine. `opacity` del cuadro multiplica la del medio.
fn media_item(m: &SceneMediaItem, design_width: f32) -> MediaItem {
    let box_opacity = m.box_style.as_ref().map_or(1.0, SceneBox::opacity_factor);
    MediaItem {
        // El `MediaPool` cachea por ruta (como el fondo): la clave es el `src`.
        id: m.src.clone(),
        item_id: m.id.clone(),
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
        opacity: (m.opacity * box_opacity).clamp(0.0, 1.0),
        design_width: Some(design_width),
        box_style: m.box_style.clone(),
        paused: m.paused,
        position_ms: m.position_ms,
    }
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
            .filter(|t| t.box_style.is_some() || !t.text.trim().is_empty() || t.spans.iter().any(|s| !s.text.trim().is_empty()))
            .map(|t| text_block(t, design_width))
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
            .map(|m| media_item(m, self.width))
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
            paused: b.paused,
            position_ms: b.position_ms,
        })
    }

    /// Encuadre del contenido: la resolución lógica de la escena y su alineación. `None` para el
    /// stage (usa toda la ventana) o si la escena no trae una resolución utilizable.
    pub fn content_frame(&self) -> Option<ContentFrame> {
        if self.stage || !(self.width > 0.0 && self.height > 0.0) {
            return None;
        }
        Some(ContentFrame { width: self.width, height: self.height, align: self.align })
    }

    /// Rutas de todas las **imágenes** de la escena (fondo, items de la slide y de los overlays), sin
    /// repetir y en ese orden. Los videos no entran: los decodifica el hub de video. Sirve para
    /// precargarlas en los workers antes de que el render las necesite (F19.2).
    pub fn image_paths(&self) -> Vec<String> {
        let mut paths: Vec<String> = Vec::new();
        let background = self.background_media().filter(|b| b.media_type == "image").and_then(|b| b.path);
        let items = self.media_items().into_iter().chain(self.overlay_media_items()).filter(|m| m.media_type == "image").map(|m| m.path);
        for path in background.into_iter().chain(items) {
            if !paths.contains(&path) {
                paths.push(path);
            }
        }
        paths
    }

    /// Texto de las overlays activas (capa propia dibujada encima de la slide, F4.6).
    pub fn overlay_text_blocks(&self) -> Vec<TextBlock> {
        let design_width = self.design_width();
        self.overlays
            .iter()
            .filter_map(|item| match item {
                SceneItem::Text(t) => Some(t),
                _ => None,
            })
            .filter(|t| t.box_style.is_some() || !t.text.trim().is_empty() || t.spans.iter().any(|s| !s.text.trim().is_empty()))
            .map(|t| text_block(t, design_width))
            .collect()
    }

    /// Items de medio (imágenes) de las overlays activas (F4.6).
    pub fn overlay_media_items(&self) -> Vec<MediaItem> {
        self.overlays
            .iter()
            .filter_map(|item| match item {
                SceneItem::Media(m) => Some(m),
                _ => None,
            })
            .filter(|m| !m.src.trim().is_empty())
            .map(|m| media_item(m, self.width))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fondo_con_pausa_y_posicion_se_deserializa() {
        let bg: SceneBackground = serde_json::from_value(json!({"path":"a.mp4","type":"video","paused":true,"positionMs":1500})).expect("fondo");
        assert!(bg.paused);
        assert_eq!(bg.position_ms, Some(1500));
        let payload: ScenePayload = serde_json::from_value(json!({"outputId":"o","background":{"path":"a.mp4","type":"video","paused":true,"positionMs":1500}})).expect("escena");
        let media = payload.background_media().expect("fondo");
        assert_eq!((media.paused, media.position_ms), (true, Some(1500)));

        let plain: SceneBackground = serde_json::from_value(json!({"path":"a.mp4","type":"video"})).expect("fondo");
        assert!(!plain.paused);
        assert_eq!(plain.position_ms, None);
        let text = serde_json::to_string(&plain).expect("json");
        assert!(!text.contains("paused") && !text.contains("positionMs"), "{text}");
    }

    /// F23.15: `live` marca el texto que cambia solo (reloj/timer). Ausente = false, y no se escribe si vale false.
    #[test]
    fn texto_live_se_deserializa_y_no_se_escribe_por_defecto() {
        let con: SceneTextItem = serde_json::from_value(json!({"type":"text","x":0,"y":0,"width":10,"height":10,"text":"10:00","live":true})).expect("item");
        assert!(con.live);
        let sin: SceneTextItem = serde_json::from_value(json!({"type":"text","x":0,"y":0,"width":10,"height":10,"text":"hola"})).expect("item");
        assert!(!sin.live);
        let text = serde_json::to_string(&sin).expect("json");
        assert!(!text.contains("live"), "{text}");
        let text = serde_json::to_string(&con).expect("json");
        assert!(text.contains("\"live\":true"), "{text}");
    }

    /// F23.16: la caja de un ítem se deserializa; sin caja, la clave no se escribe.
    #[test]
    fn caja_se_deserializa_y_se_omite_si_falta() {
        let con: SceneTextItem = serde_json::from_value(json!({
            "type":"text","x":0,"y":0,"width":10,"height":10,"text":"hola",
            "box": { "background": [1,0,0,1], "radius": 8, "padding": { "top": 1, "right": 2, "bottom": 3, "left": 4 } }
        }))
        .expect("item");
        let caja = con.box_style.as_ref().expect("caja");
        assert_eq!((caja.background, caja.radius, caja.border_width), (Some([1.0, 0.0, 0.0, 1.0]), Some(8.0), None));
        assert_eq!(caja.padding.map(|p| (p.top, p.right, p.bottom, p.left)), Some((1.0, 2.0, 3.0, 4.0)));
        let text = serde_json::to_string(&con).expect("json");
        assert!(text.contains("\"box\":{\"background\":[1.0,0.0,0.0,1.0],\"radius\":8.0,\"padding\""), "{text}");

        let sin: SceneTextItem = serde_json::from_value(json!({"type":"text","x":0,"y":0,"width":10,"height":10,"text":"hola"})).expect("item");
        assert!(sin.box_style.is_none());
        assert!(!serde_json::to_string(&sin).expect("json").contains("box"));
        let medio: SceneMediaItem = serde_json::from_value(json!({"x":0,"y":0,"width":10,"height":10,"src":"a.png","box":{"opacity":0.5}})).expect("medio");
        assert_eq!(medio.box_style.and_then(|b| b.opacity), Some(0.5));
    }

    /// F23.20: un ítem de video lleva pausa y posición; sin ellos la clave no se escribe.
    #[test]
    fn item_de_video_lleva_el_transporte() {
        let con: SceneMediaItem = serde_json::from_value(json!({"x":0,"y":0,"width":10,"height":10,"src":"a.mp4","mediaType":"video","paused":true,"positionMs":1500})).expect("medio");
        assert!(con.paused && con.position_ms == Some(1500));
        let sin: SceneMediaItem = serde_json::from_value(json!({"x":0,"y":0,"width":10,"height":10,"src":"a.mp4","mediaType":"video"})).expect("medio");
        let text = serde_json::to_string(&sin).expect("json");
        assert!(!text.contains("paused") && !text.contains("positionMs"), "{text}");
        let motor = media_item(&con, 1920.0);
        assert!(motor.paused && motor.position_ms == Some(1500));
    }

    /// F23.16: `opacity` multiplica texto y medio; `padding` achica el texto y la caja conserva el rect completo.
    #[test]
    fn opacidad_y_padding_se_aplican_al_bloque_y_al_medio() {
        let payload: ScenePayload = serde_json::from_value(json!({
            "outputId": "o", "width": 1000, "height": 500,
            "items": [
                { "type": "text", "x": 100, "y": 50, "width": 400, "height": 200, "text": "Hola", "color": [1,1,1,1],
                  "spans": [{ "text": "Hola", "color": [1,0,0,0.8] }],
                  "box": { "background": [0,0,1,1], "opacity": 0.5, "padding": { "top": 10, "right": 20, "bottom": 30, "left": 40 } } },
                { "type": "text", "x": 0, "y": 0, "width": 10, "height": 10, "text": "", "box": { "background": [0,0,1,1] } },
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10, "src": "a.png", "opacity": 0.8, "box": { "opacity": 0.5 } }
            ]
        }))
        .expect("payload");
        let blocks = payload.text_blocks();
        assert_eq!(blocks.len(), 2, "un cuadro sin texto pero con caja se conserva");
        let b = &blocks[0];
        assert_eq!((b.x, b.y, b.width, b.height), (140.0, 60.0, 340.0, 160.0));
        assert_eq!(b.color[3], 0.5);
        assert_eq!(b.spans[0].color.map(|c| c[3]), Some(0.4));
        let (_, rect) = b.box_rect().expect("caja");
        assert_eq!(rect, [100.0, 50.0, 400.0, 200.0], "la caja ocupa el rect completo");
        assert_eq!(payload.media_items()[0].opacity, 0.4);
    }

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

    /// F19.2: al aplicar una escena se piden a los workers todas sus imágenes (fondo, slide y overlays).
    #[test]
    fn image_paths_collects_background_slide_and_overlay_images_once() {
        let payload: ScenePayload = serde_json::from_value(json!({
            "outputId": "out1",
            "width": 1920,
            "height": 1080,
            "background": { "path": "/m/bg.png", "type": "image" },
            "items": [
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10, "src": "/m/a.png", "mediaType": "image" },
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10, "src": "/m/clip.mp4", "mediaType": "video" },
                { "type": "media", "x": 5, "y": 5, "width": 10, "height": 10, "src": "/m/a.png", "mediaType": "image" }
            ],
            "overlays": [
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10, "src": "/m/o.png", "mediaType": "image" }
            ]
        }))
        .expect("payload válido");

        assert_eq!(payload.image_paths(), vec!["/m/bg.png", "/m/a.png", "/m/o.png"]);
    }

    #[test]
    fn image_paths_skips_a_video_background_and_empty_scenes() {
        let video_bg: ScenePayload = serde_json::from_value(json!({
            "outputId": "out1", "width": 1920, "height": 1080,
            "background": { "path": "/m/bg.mp4", "type": "video" }
        }))
        .expect("payload válido");
        assert!(video_bg.image_paths().is_empty(), "los videos los decodifica el hub, no se precargan como imagen");

        assert!(ScenePayload::default().image_paths().is_empty());
    }

    /// F21.2: la resolución de la escena y su alineación llegan al engine para encuadrar el contenido.
    #[test]
    fn content_frame_comes_from_the_scene_size_and_align() {
        let aligned: ScenePayload = serde_json::from_value(json!({ "outputId": "o", "width": 1440, "height": 1080, "align": "start" })).expect("payload válido");
        let frame = aligned.content_frame().expect("hay resolución");
        assert_eq!((frame.width, frame.height), (1440.0, 1080.0));
        assert_eq!(frame.align, crate::render::frame::ContentAlign::Start);

        let default: ScenePayload = serde_json::from_value(json!({ "outputId": "o", "width": 1920, "height": 1080 })).expect("payload válido");
        assert_eq!(default.content_frame().expect("hay resolución").align, crate::render::frame::ContentAlign::Center, "sin `align` es centro");
    }

    /// F23.19: una escena de stage con `items` los entrega igual que la audiencia.
    #[test]
    fn stage_scene_with_items_yields_text_and_media() {
        let stage: ScenePayload = serde_json::from_value(json!({
            "outputId": "s", "stage": true, "width": 1920, "height": 1080, "plainText": "plano",
            "items": [
                { "type": "text", "x": 40, "y": 40, "width": 900, "height": 300, "align": "left", "verticalAlign": "top", "lineHeight": 1.1, "fontSize": 60, "fontWeight": 400, "color": [1, 1, 1, 1], "text": "uno", "spans": [] },
                { "type": "media", "x": 0, "y": 0, "width": 10, "height": 10, "src": "/m/logo.png", "mediaType": "image" }
            ]
        }))
        .expect("payload de stage válido");
        assert_eq!(stage.text_blocks().len(), 1);
        assert_eq!(stage.media_items().len(), 1);
    }

    #[test]
    fn content_frame_is_none_without_a_usable_size_or_for_stage() {
        assert!(ScenePayload::default().content_frame().is_none(), "sin resolución");

        let stage: ScenePayload = serde_json::from_value(json!({ "outputId": "o", "stage": true, "width": 1920, "height": 1080 })).expect("payload válido");
        assert!(stage.content_frame().is_none(), "el stage usa toda la ventana");
    }
}
