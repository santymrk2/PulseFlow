//! Comandos del dominio `SHOWS` (presentaciones, biblias y copias de seguridad).
//!
//! Traducción de `src/electron/utils/shows.ts`, `src/electron/data/save.ts` y la
//! parte de copias de seguridad de `src/electron/data/backup.ts`.
//!
//! Simplificaciones documentadas:
//! - `SHOWS`/`REFRESH_SHOWS` devuelven el mapa de shows recortados recalculado
//!   desde disco (Electron además fusiona la caché en memoria y emite eventos).
//! - `SAVE` escribe las tiendas, biblias, shows y borrados/renombrados. La
//!   sincronización en la nube y la copia de seguridad en ZIP se postergan
//!   (el ZIP llega con el bloque 7 / sidecars).

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::files::{self, DataFolder};
use crate::utils::helpers::check_if_matching;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::path::Path;
use tauri::{AppHandle, State};

/// Tiendas gestionadas por `SAVE` (identificadores de `electron-store`).
const SAVE_STORE_IDS: &[&str] = &[
    "SETTINGS",
    "SYNCED_SETTINGS",
    "SHOWS",
    "STAGE",
    "PROJECTS",
    "OVERLAYS",
    "TEMPLATES",
    "EVENTS",
    "MEDIA",
    "THEMES",
    "DRIVE_API_KEY",
    "CACHE",
    "HISTORY",
    "USAGE",
];

fn data_folder(state: &State<'_, AppState>, folder: DataFolder) -> AppResult<String> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    Ok(stores.get_data_folder_path(folder, None))
}

fn read_folder(path: &str) -> Vec<String> {
    files::read_folder(path).unwrap_or_default()
}

/// Equivalente a `parseJSON`/`parseShow`, incluyendo la reparación de archivos
/// truncados (corte en `"}}]"`).
fn parse_show(content: &str) -> Option<Value> {
    if let Ok(value) = serde_json::from_str::<Value>(content) {
        return Some(value);
    }
    if let Some(idx) = content.find("}}]") {
        let repaired = &content[..idx + 3];
        if let Ok(value) = serde_json::from_str::<Value>(repaired) {
            return Some(value);
        }
    }
    None
}

/// `trimShow`: recorta un show a los campos usados por la biblioteca.
fn trim_show(show: &Value, name: &str) -> Option<Value> {
    let obj = show.as_object()?;
    let mut out = Map::new();
    out.insert("name".to_string(), Value::String(name.to_string()));
    out.insert(
        "category".to_string(),
        obj.get("category").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "timestamps".to_string(),
        obj.get("timestamps").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "quickAccess".to_string(),
        obj.get("quickAccess").cloned().unwrap_or_else(|| json!({})),
    );
    if let Some(origin) = obj.get("origin") {
        out.insert("origin".to_string(), origin.clone());
    }
    if obj.get("private").and_then(Value::as_bool).unwrap_or(false) {
        out.insert("private".to_string(), Value::Bool(true));
    }
    if obj.get("locked").and_then(Value::as_bool).unwrap_or(false) {
        out.insert("locked".to_string(), Value::Bool(true));
    }
    Some(Value::Object(out))
}

/// Reconstruye el mapa de shows recortados leyendo `<Shows>/*.show`.
fn load_trimmed_shows(shows_path: &str) -> Value {
    let mut result = Map::new();
    for file_name in read_folder(shows_path) {
        if !file_name.to_lowercase().ends_with(".show") {
            continue;
        }
        let name = &file_name[..file_name.len() - ".show".len()];
        if name.is_empty() {
            continue;
        }
        let path = Path::new(shows_path).join(&file_name);
        let Ok(content) = files::read_file(&path) else {
            continue;
        };
        let Some(show) = parse_show(&content) else {
            continue;
        };
        let Some(data) = show.get(1) else {
            continue;
        };
        let Some(trimmed) = trim_show(data, name) else {
            continue;
        };
        if let Some(id) = show.get(0).and_then(Value::as_str) {
            result.insert(id.to_string(), trimmed);
        }
    }
    Value::Object(result)
}

// ---------------------------------------------------------------------------
// Listado y carga
// ---------------------------------------------------------------------------

/// `FULL_SHOWS_LIST`: nombres de archivo `.show` en la carpeta de shows.
#[tauri::command]
pub fn FULL_SHOWS_LIST(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;
    Ok(read_folder(&shows_path)
        .into_iter()
        .filter(|a| a.contains(".show") && a.len() > 5)
        .collect())
}

/// `SHOWS`: mapa de shows recortados (id → información de biblioteca).
#[tauri::command]
pub fn SHOWS(state: State<'_, AppState>) -> AppResult<Value> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;
    Ok(load_trimmed_shows(&shows_path))
}

/// `REFRESH_SHOWS`: recalcula la lista de shows (en Electron emite el evento).
#[tauri::command]
pub fn REFRESH_SHOWS(state: State<'_, AppState>) -> AppResult<Value> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;
    Ok(load_trimmed_shows(&shows_path))
}

#[derive(Deserialize)]
pub struct ShowData {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
}

/// `SHOW`: carga un `.show` concreto.
#[tauri::command]
pub fn SHOW(state: State<'_, AppState>, data: ShowData) -> AppResult<Value> {
    let folder = data_folder(&state, DataFolder::Shows)?;
    let file_name = format!("{}.show", data.name.as_deref().unwrap_or(&data.id));
    let file_path = Path::new(&folder).join(&file_name);

    let content = match files::read_file(&file_path) {
        Ok(c) if !c.is_empty() => c,
        _ => return Ok(json!({ "error": "not_found", "id": data.id })),
    };
    let Some(mut show) = parse_show(&content) else {
        return Ok(json!({ "error": "not_found", "id": data.id }));
    };
    if !data.id.is_empty() {
        if let Some(arr) = show.as_array_mut() {
            if let Some(first) = arr.first_mut() {
                *first = Value::String(data.id.clone());
            }
        }
    }
    Ok(json!({ "id": data.id, "content": show }))
}

/// `BIBLE`: carga una biblia `.fsb` y aplica la migración `value` → `text`.
#[tauri::command]
pub fn BIBLE(state: State<'_, AppState>, data: ShowData) -> AppResult<Value> {
    let folder = data_folder(&state, DataFolder::Scriptures)?;
    let file_name = format!("{}.fsb", data.name.as_deref().unwrap_or(&data.id));
    let file_path = Path::new(&folder).join(&file_name);

    let content = match files::read_file(&file_path) {
        Ok(c) if !c.is_empty() => c,
        _ => return Ok(json!({ "error": "not_found", "id": data.id })),
    };
    let Some(mut bible) = parse_show(&content) else {
        return Ok(json!({ "error": "not_found", "id": data.id }));
    };
    migrate_bible_value_to_text(&mut bible);
    Ok(json!({ "id": data.id, "content": bible }))
}

/// Convierte las claves `value` en `text` (compatibilidad pre v1.3.0).
fn migrate_bible_value_to_text(bible: &mut Value) {
    let Some(books) = bible
        .get_mut(1)
        .and_then(|v| v.get_mut("books"))
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    for book in books.iter_mut() {
        let Some(chapters) = book.get_mut("chapters").and_then(Value::as_array_mut) else {
            continue;
        };
        for chapter in chapters.iter_mut() {
            let Some(verses) = chapter.get_mut("verses").and_then(Value::as_array_mut) else {
                continue;
            };
            for verse in verses.iter_mut() {
                let Some(obj) = verse.as_object_mut() else {
                    continue;
                };
                if obj.contains_key("text") {
                    continue;
                }
                let text = obj.remove("value").unwrap_or_else(|| Value::String(String::new()));
                obj.insert("text".to_string(), text);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Borrado
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ShowRef {
    pub name: Option<String>,
    pub id: String,
}

#[derive(Deserialize)]
pub struct DeleteShowsData {
    pub shows: Vec<ShowRef>,
}

/// `DELETE_SHOWS`: elimina una lista de shows.
#[tauri::command]
pub fn DELETE_SHOWS(state: State<'_, AppState>, data: DeleteShowsData) -> AppResult<Value> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;
    let mut deleted = Vec::new();
    for show in data.shows {
        let name = format!("{}.show", show.name.as_deref().unwrap_or(&show.id));
        let path = Path::new(&shows_path).join(&name);
        let _ = files::delete_file(&path);
        deleted.push(name);
    }
    Ok(json!({ "deleted": deleted }))
}

#[derive(Deserialize)]
pub struct DeleteShowsNotIndexedData {
    pub shows: Map<String, Value>,
}

/// `DELETE_SHOWS_NI`: elimina los `.show` que no están indexados.
#[tauri::command]
pub fn DELETE_SHOWS_NI(
    state: State<'_, AppState>,
    data: DeleteShowsNotIndexedData,
) -> AppResult<Value> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;

    let indexed: Vec<String> = data
        .shows
        .iter()
        .map(|(id, value)| {
            let name = value
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or(id.as_str());
            format!("{name}.show")
        })
        .collect();

    let mut deleted = Vec::new();
    for name in read_folder(&shows_path) {
        if indexed.contains(&name) || !name.contains(".show") {
            continue;
        }
        let path = Path::new(&shows_path).join(&name);
        let _ = files::delete_file(&path);
        deleted.push(name);
    }
    Ok(json!({ "deleted": deleted }))
}

// ---------------------------------------------------------------------------
// GET_EMPTY_SHOWS
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct GetEmptyShowsData {
    #[serde(default)]
    pub cached: Map<String, Value>,
}

/// `GET_EMPTY_SHOWS`: shows sin contenido (sin layouts ni texto).
#[tauri::command]
pub fn GET_EMPTY_SHOWS(
    state: State<'_, AppState>,
    data: GetEmptyShowsData,
) -> AppResult<Vec<Value>> {
    let shows_path = data_folder(&state, DataFolder::Shows)?;
    let mut empty = Vec::new();

    for file_name in read_folder(&shows_path) {
        if !file_name.contains(".show") {
            continue;
        }
        let path = Path::new(&shows_path).join(&file_name);
        let Ok(content) = files::read_file(&path) else {
            continue;
        };
        let Some(show) = parse_show(&content) else {
            continue;
        };
        let Some(id) = show.get(0).and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        let Some(show_data) = show.get(1) else {
            continue;
        };

        // Reemplaza los datos guardados por la caché en memoria si existe.
        let effective = data.cached.get(&id).unwrap_or(show_data);

        if show_has_layout_content(effective) || !get_show_text_content(effective).is_empty() {
            continue;
        }

        let name = file_name.replace(".show", "");
        empty.push(json!({ "id": id, "name": name }));
    }

    Ok(empty)
}

fn show_has_layout_content(show: &Value) -> bool {
    show
        .get("layouts")
        .and_then(Value::as_object)
        .map(|layouts| {
            layouts.values().any(|layout| {
                layout
                    .get("slides")
                    .and_then(Value::as_array)
                    .map(|slides| !slides.is_empty())
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn get_show_text_content(show: &Value) -> String {
    let mut text = String::new();
    let Some(slides) = show.get("slides").and_then(Value::as_object) else {
        return text;
    };
    for slide in slides.values() {
        let Some(items) = slide.get("items").and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            let Some(lines) = item.get("lines").and_then(Value::as_array) else {
                continue;
            };
            for line in lines {
                let Some(text_items) = line.get("text").and_then(Value::as_array) else {
                    continue;
                };
                for text_item in text_items {
                    if let Some(value) = text_item.get("value").and_then(Value::as_str) {
                        text.push_str(value);
                    }
                }
            }
        }
    }
    text
}

// ---------------------------------------------------------------------------
// Copias de seguridad (implementadas en `commands::backup`)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SAVE
// ---------------------------------------------------------------------------

/// `SAVE`: persiste tiendas, biblias, shows y borrados/renombrados.
#[tauri::command]
pub fn SAVE(app: AppHandle, state: State<'_, AppState>, data: Value) -> AppResult<Value> {
    let Some(obj) = data.as_object() else {
        return Ok(json!({}));
    };

    let mut stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;

    // Tiendas completas.
    for id in SAVE_STORE_IDS {
        let Some(new_value) = obj.get(*id) else {
            continue;
        };
        if !is_valid_json(new_value) {
            continue;
        }
        if check_if_matching(&stores.get(id), new_value) {
            continue;
        }
        stores.set(id, new_value.clone());
    }

    // Biblias.
    if let Some(scriptures) = obj.get("scripturesCache").and_then(Value::as_object) {
        let folder = stores.get_data_folder_path(DataFolder::Scriptures, None);
        for (id, value) in scriptures {
            if id.is_empty() || !is_valid_json(value) {
                continue;
            }
            let Some(name) = value.get("name").and_then(Value::as_str) else {
                continue;
            };
            let file_path = Path::new(&folder).join(format!("{name}.fsb"));
            let payload = serde_json::to_string(&json!([id, value])).unwrap_or_default();
            let _ = files::write_file(&file_path, &payload);
        }
    }

    let shows_path = stores.get_data_folder_path(DataFolder::Shows, None);

    // Backup disparado desde `customTriggers.backup` (se lanza tras soltar el lock).
    let pending_backup = obj.get("customTriggers").and_then(|triggers| {
        let wants_backup = triggers.get("backup").and_then(Value::as_bool).unwrap_or(false);
        if !wants_backup {
            return None;
        }
        let is_auto = triggers.get("isAutoBackup").and_then(Value::as_bool).unwrap_or(false);
        crate::domain::data::backup::build_plan(&stores, is_auto).ok()
    });

    drop(stores);

    if let Some(plan) = pending_backup {
        crate::commands::backup::spawn_backup(app, plan);
    }

    // Renombrado de shows.
    if let Some(renamed) = obj.get("renamedShows").and_then(Value::as_array) {
        let deleted: Vec<&str> = obj
            .get("deletedShows")
            .and_then(Value::as_array)
            .map(|arr| arr.iter().filter_map(|d| d.get("id").and_then(Value::as_str)).collect())
            .unwrap_or_default();
        for show in renamed {
            let Some(id) = show.get("id").and_then(Value::as_str) else {
                continue;
            };
            if deleted.contains(&id) {
                continue;
            }
            let old_name = show.get("oldName").and_then(Value::as_str).unwrap_or(id);
            let new_name = show.get("name").and_then(Value::as_str).unwrap_or(id);
            let from = Path::new(&shows_path).join(format!("{old_name}.show"));
            let to = Path::new(&shows_path).join(format!("{new_name}.show"));
            let _ = std::fs::rename(from, to);
        }
    }

    // Shows en caché se escriben como archivos individuales.
    if let Some(shows_cache) = obj.get("showsCache").and_then(Value::as_object) {
        for (id, value) in shows_cache {
            if !is_valid_json(value) {
                continue;
            }
            let name = value.get("name").and_then(Value::as_str).unwrap_or(id.as_str());
            let file_path = Path::new(&shows_path).join(format!("{name}.show"));
            let payload = serde_json::to_string(&json!([id, value])).unwrap_or_default();
            let _ = files::write_file(&file_path, &payload);
        }
    }

    // Borrado de shows.
    if let Some(deleted) = obj.get("deletedShows").and_then(Value::as_array) {
        let shows_cache = obj.get("showsCache").and_then(Value::as_object);
        for show in deleted {
            let Some(id) = show.get("id").and_then(Value::as_str) else {
                continue;
            };
            if id.is_empty() || shows_cache.map(|c| c.contains_key(id)).unwrap_or(false) {
                continue;
            }
            let name = show.get("name").and_then(Value::as_str).unwrap_or(id);
            let file_path = Path::new(&shows_path).join(format!("{name}.show"));
            if !files::does_path_exist(&file_path) {
                continue;
            }
            // Comprobar el ID real antes de borrar (puede existir otro show con
            // el mismo nombre pero distinto ID).
            let content = files::read_file(&file_path).unwrap_or_else(|_| "{}".to_string());
            if let Some(parsed) = parse_show(&content) {
                if parsed.get(0).and_then(Value::as_str) != Some(id) {
                    continue;
                }
            }
            let _ = files::delete_file(&file_path);
        }
    }

    Ok(json!({
        "closeWhenFinished": obj.get("closeWhenFinished").cloned().unwrap_or(Value::Bool(false)),
        "customTriggers": obj.get("customTriggers").cloned().unwrap_or(Value::Null),
    }))
}

fn is_valid_json(value: &Value) -> bool {
    !value.is_null()
}
