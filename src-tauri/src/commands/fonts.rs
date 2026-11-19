//! Lista de fuentes instaladas en el sistema (F19).
//!
//! WKWebView (macOS) no implementa `window.queryLocalFonts`, así que la lista sale de
//! `fontdb` (el mismo que usa el engine de render) y viaja al frontend con la forma de `FontData`.

#![allow(non_snake_case)]

use cosmic_text::fontdb::{Database, Style, Weight};
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFont {
    pub family: String,
    pub full_name: String,
    pub style: String,
    pub postscript_name: String,
}

fn weight_name(weight: Weight) -> &'static str {
    match weight.0 {
        0..=149 => "Thin",
        150..=249 => "ExtraLight",
        250..=349 => "Light",
        350..=449 => "Regular",
        450..=549 => "Medium",
        550..=649 => "SemiBold",
        650..=749 => "Bold",
        750..=849 => "ExtraBold",
        _ => "Black",
    }
}

fn style_label(weight: Weight, style: Style) -> String {
    match (weight_name(weight), style) {
        ("Regular", Style::Normal) => "Regular".into(),
        ("Regular", _) => "Italic".into(),
        (name, Style::Normal) => name.into(),
        (name, _) => format!("{name} Italic"),
    }
}

pub fn system_fonts(db: &Database) -> Vec<SystemFont> {
    db.faces()
        .filter_map(|face| {
            let family = face.families.first()?.0.clone();
            let style = style_label(face.weight, face.style);
            let full_name = if style == "Regular" { family.clone() } else { format!("{family} {style}") };
            Some(SystemFont { family, full_name, style, postscript_name: face.post_script_name.clone() })
        })
        .collect()
}

static CACHE: OnceLock<Vec<SystemFont>> = OnceLock::new();

#[tauri::command]
pub async fn LIST_SYSTEM_FONTS() -> Vec<SystemFont> {
    CACHE
        .get_or_init(|| {
            let mut db = Database::new();
            db.load_system_fonts();
            system_fonts(&db)
        })
        .clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmic_text::fontdb::{FaceInfo, Language, Source, Stretch, ID};
    use std::sync::Arc;

    fn face(family: &str, weight: u16, style: Style) -> FaceInfo {
        FaceInfo {
            id: ID::dummy(),
            source: Source::Binary(Arc::new(Vec::<u8>::new())),
            index: 0,
            families: vec![(family.into(), Language::English_UnitedStates)],
            post_script_name: format!("{family}-{weight}"),
            style,
            weight: Weight(weight),
            stretch: Stretch::Normal,
            monospaced: false,
        }
    }

    #[test]
    fn mapea_caras_a_la_forma_de_font_data() {
        let mut db = Database::new();
        db.push_face_info(face("Menlo", 400, Style::Normal));
        db.push_face_info(face("Menlo", 700, Style::Italic));

        let json = serde_json::to_value(system_fonts(&db)).unwrap();
        let regular = json.as_array().unwrap().iter().find(|f| f["style"] == "Regular").unwrap();
        assert_eq!(regular["family"], "Menlo");
        assert_eq!(regular["fullName"], "Menlo");
        assert_eq!(regular["postscriptName"], "Menlo-400");
        assert!(json.as_array().unwrap().iter().any(|f| f["style"] == "Bold Italic" && f["fullName"] == "Menlo Bold Italic"));
    }
}
