//! F4.2: contrato del Scene Graph entre el frontend (TypeScript) y el engine (Rust).
//!
//! El test de vitest `src/frontend/components/helpers/sceneGraphPayload.test.ts` genera
//! los fixtures de `src-tauri/tests/fixtures/scene/*.json` (el módulo
//! `sceneGraphPayload.ts` es el único lugar que enumera las claves del payload) y los
//! comprueba contra la copia commiteada; acá se deserializan con los tipos reales del
//! engine y se verifican las claves y los valores. Renombrar un campo de un solo lado
//! rompe alguno de los dos tests.
//!
//! Los fixtures cubren el contrato completo (texto con tramos, contorno y sombra;
//! fondo de video; Stage Display; escena vacía), no todos los casos de la app.

use super::scene::{SCENE_GRAPH_VERSION, SceneItem, ScenePayload};
use serde_json::Value;

/// Nombres de los fixtures; el mismo listado que `sceneGraphPayload.test.ts`.
const SCENE_FIXTURES: [&str; 5] = [
    "audience-text",
    "audience-background-video",
    "audience-media",
    "stage",
    "cleared",
];

fn fixture(name: &str) -> &'static str {
    match name {
        "audience-text" => include_str!("../../tests/fixtures/scene/audience-text.json"),
        "audience-background-video" => {
            include_str!("../../tests/fixtures/scene/audience-background-video.json")
        }
        "audience-media" => include_str!("../../tests/fixtures/scene/audience-media.json"),
        "stage" => include_str!("../../tests/fixtures/scene/stage.json"),
        "cleared" => include_str!("../../tests/fixtures/scene/cleared.json"),
        other => panic!("fixture de contrato desconocida: {other}"),
    }
}

/// Deserializa un fixture con los tipos del engine y devuelve también el JSON crudo
/// (para verificar los nombres exactos de las claves).
fn parse(name: &str) -> (ScenePayload, Value) {
    let raw = fixture(name);
    let json: Value = serde_json::from_str(raw).expect("fixture JSON válido");
    let payload: ScenePayload =
        serde_json::from_str(raw).expect("fixture deserializa en ScenePayload");
    (payload, json)
}

fn keys(value: &Value) -> Vec<String> {
    let object = value.as_object().expect("el fixture es un objeto JSON");
    let mut keys: Vec<String> = object.keys().cloned().collect();
    keys.sort_unstable();
    keys
}

fn assert_keys(value: &Value, expected: &[&str]) {
    let mut expected: Vec<String> = expected.iter().map(|key| (*key).to_string()).collect();
    expected.sort_unstable();
    assert_eq!(keys(value), expected, "las claves del fixture cambiaron");
}

/// Cualquier fixture del contrato deserializa y declara la versión que entiende el engine.
#[test]
fn cada_fixture_deserializa_y_valida_la_version() {
    assert_eq!(
        SCENE_FIXTURES.len(),
        5,
        "el test de vitest debe generar 5 fixtures"
    );
    for name in SCENE_FIXTURES {
        let (payload, _) = parse(name);
        assert_eq!(payload.version, SCENE_GRAPH_VERSION, "versión en {name}");
        assert!(
            payload.validate_version().is_ok(),
            "versión válida en {name}"
        );
    }
}

/// Escena de audiencia con texto, tramos, contorno, sombra y transición.
#[test]
fn audience_text_mantiene_el_contrato() {
    let (payload, json) = parse("audience-text");

    assert_eq!(payload.output_id, "audience-1");
    assert!(!payload.stage);
    assert_eq!(payload.width, 1920.0);
    assert_eq!(payload.height, 1080.0);
    assert!(payload.background.is_none());
    assert_eq!(payload.plain_text, "Santo\nSanto");
    assert!(payload.next_text.is_none());

    assert_keys(
        &json,
        &[
            "version",
            "outputId",
            "stage",
            "width",
            "height",
            "background",
            "items",
            "transition",
            "plainText",
        ],
    );
    assert_keys(
        &json["items"][0],
        &[
            "type",
            "id",
            "x",
            "y",
            "width",
            "height",
            "align",
            "verticalAlign",
            "lineHeight",
            "fontFamily",
            "fontSize",
            "fontWeight",
            "fontStyle",
            "color",
            "stroke",
            "shadow",
            "text",
            "spans",
        ],
    );
    assert_keys(&json["items"][0]["stroke"], &["color", "width"]);
    assert_keys(
        &json["items"][0]["shadow"],
        &["color", "offsetX", "offsetY"],
    );
    assert_keys(&json["items"][0]["spans"][0], &["text", "color"]);
    assert_keys(&json["items"][0]["spans"][1], &["text"]);
    assert_keys(&json["items"][0]["spans"][2], &["text", "fontStyle"]);
    assert_keys(&json["transition"], &["type", "durationMs", "easing"]);

    // lo que el engine dibuja
    assert_eq!(payload.items.len(), 1);
    let blocks = payload.text_blocks();
    assert_eq!(blocks.len(), 1, "sólo el item de texto llega al engine");
    let block = &blocks[0];

    assert_eq!(block.text, "Santo\nSanto");
    assert_eq!(block.font_family.as_deref(), Some("CMG Sans"));
    assert_eq!(block.font_size, 96.0);
    assert_eq!(block.font_weight, 700);
    assert_eq!(block.font_style.as_deref(), Some("italic"));
    assert_eq!(block.color, [1.0, 1.0, 1.0, 1.0]);
    assert_eq!(block.alignment, "center");
    assert_eq!(block.vertical_align.as_deref(), Some("center"));
    assert_eq!(block.line_height_ratio, 1.1);
    assert_eq!(block.x, 50.0);
    assert_eq!(block.y, 88.0);
    assert_eq!(block.width, 1820.0);
    assert_eq!(block.height, 904.0);
    assert_eq!(block.design_width, Some(1920.0));
    assert_eq!(block.outline_color, Some([0.0, 0.0, 0.0, 1.0]));
    assert_eq!(block.outline_width, Some(4.0));
    assert_eq!(block.shadow_color, Some([0.0, 0.0, 0.0, 0.7]));
    assert_eq!(block.shadow_offset, Some([2.0, 2.0]));

    assert_eq!(block.spans.len(), 3);
    assert_eq!(block.spans[0].text, "Santo");
    assert_eq!(block.spans[0].color, Some([1.0, 0.0, 0.0, 1.0]));
    assert_eq!(block.spans[1].text, "\n");
    assert_eq!(block.spans[2].text, "Santo");
    assert_eq!(block.spans[2].font_style.as_deref(), Some("italic"));

    let transition = payload.transition.as_ref().expect("transición");
    assert_eq!(transition.transition_type, "crossfade");
    assert_eq!(transition.duration_ms, 400);
    assert_eq!(transition.easing.as_deref(), Some("ease-in"));
    assert_eq!(transition.engine_name(), "crossfade");
}

#[test]
fn audience_background_video_mantiene_su_contrato() {
    let (payload, json) = parse("audience-background-video");

    assert_eq!(payload.output_id, "audience-2");
    assert!(!payload.stage);
    assert!(payload.items.is_empty());
    assert_eq!(payload.plain_text, "");

    assert_keys(
        &json["background"],
        &["path", "type", "fit", "opacity", "loop", "muted"],
    );
    assert_keys(&json["transition"], &["type", "durationMs"]);

    let background = payload.background_media().expect("fondo de video");
    assert_eq!(background.id, "/media/fondo.mp4");
    assert_eq!(background.path.as_deref(), Some("/media/fondo.mp4"));
    assert_eq!(background.media_type, "video");
    assert_eq!(background.opacity, 0.8);
    assert_eq!(background.aspect_mode, 1, "fit contain");

    let transition = payload.transition.as_ref().expect("transición");
    assert_eq!(transition.transition_type, "fade");
    assert_eq!(transition.duration_ms, 500);
    assert!(transition.easing.is_none());
}

#[test]
fn stage_mantiene_su_contrato() {
    let (payload, json) = parse("stage");

    assert_eq!(payload.output_id, "stage-1");
    assert!(payload.stage);
    assert_eq!(payload.width, 1280.0);
    assert_eq!(payload.height, 720.0);
    assert_eq!(payload.plain_text, "Santo\nSanto");
    assert_eq!(payload.next_text.as_deref(), Some("Digno"));
    assert!(payload.items.is_empty());
    assert!(payload.background.is_none());
    assert!(payload.transition.is_none());

    assert_keys(
        &json,
        &[
            "version",
            "outputId",
            "stage",
            "width",
            "height",
            "background",
            "items",
            "transition",
            "plainText",
            "nextText",
        ],
    );
}

#[test]
fn escena_vacia_mantiene_su_contrato() {
    let (payload, json) = parse("cleared");

    assert_eq!(payload.output_id, "audience-2");
    assert!(!payload.stage);
    assert!(payload.items.is_empty());
    assert!(payload.background.is_none());
    assert!(payload.transition.is_none());
    assert_eq!(payload.plain_text, "");
    assert!(payload.next_text.is_none());
    assert!(payload.text_blocks().is_empty());

    // sin nextText: la clave no existe en el payload
    assert_keys(
        &json,
        &[
            "version",
            "outputId",
            "stage",
            "width",
            "height",
            "background",
            "items",
            "transition",
            "plainText",
        ],
    );
}

#[test]
fn audience_media_mantiene_su_contrato() {
    let (payload, json) = parse("audience-media");

    assert_eq!(payload.output_id, "audience-3");
    assert!(!payload.stage);
    assert_eq!(payload.width, 1920.0);
    assert_eq!(payload.height, 1080.0);
    assert_eq!(payload.items.len(), 2);

    // claves del contrato de un item de medio
    assert_keys(
        &json["items"][0],
        &[
            "type",
            "id",
            "x",
            "y",
            "width",
            "height",
            "src",
            "mediaType",
            "fit",
            "opacity",
        ],
    );
    assert_keys(
        &json["items"][1],
        &[
            "type",
            "x",
            "y",
            "width",
            "height",
            "src",
            "mediaType",
            "fit",
            "opacity",
        ],
    );

    // ningún item de medio llega al motor de texto
    assert!(payload.text_blocks().is_empty());

    let media = payload.media_items();
    assert_eq!(media.len(), 2);

    let image = &media[0];
    assert_eq!(
        image.id, "/media/imagen.png",
        "el MediaPool cachea por ruta"
    );
    assert_eq!(image.path, "/media/imagen.png");
    assert_eq!(image.media_type, "image");
    assert_eq!(image.x, 50.0);
    assert_eq!(image.y, 100.0);
    assert_eq!(image.width, 1820.0);
    assert_eq!(image.height, 880.0);
    assert_eq!(image.aspect_mode, 1, "fit contain");
    assert_eq!(image.opacity, 1.0);
    assert_eq!(image.design_width, Some(1920.0));

    let video = &media[1];
    assert_eq!(video.media_type, "video");
    assert_eq!(video.aspect_mode, 2, "fit fill");
    assert_eq!(video.opacity, 0.5);
}

/// El engine ignora los items de tipos que todavía no soporta (F4.5) en vez de fallar.
#[test]
fn un_item_de_tipo_desconocido_deserializa_como_unknown() {
    let item: SceneItem =
        serde_json::from_value(serde_json::json!({ "type": "camera", "src": "x.png" }))
            .expect("item desconocido");
    assert!(matches!(item, SceneItem::Unknown));
}
