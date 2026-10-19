//! Importación de archivos (IMPORT / IMPORT_FILES).
//!
//! IMPORT abre el diálogo nativo y comparte el pipeline con IMPORT_FILES
//! (recibe la lista de rutas elegida en el frontend como fallback web).
//!
//! El resultado no se devuelve por IPC: se emite por el canal MAIN con
//! `channel: IMPORT2`, que el frontend despacha según el tipo de archivo
//! (importShow / importTemplate / importOverlay / importProject / convertTexts…).

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::files::DataFolder;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use tauri::{Emitter, Manager};

/// Formatos que IMPORT acepta en el diálogo nativo.
const IMPORT_EXTENSIONS: &[&str] = &[
    "freeshow_project",
    "freeshow_template",
    "freeshow_overlay",
    "pro_bundle",
    "proremix",
    "show",
    "text",
    "pdf",
    "powerkey",
    "verse",
];

/// El frontend importa estos formatos leyendo el contenido como texto.
const TEXT_EXTENSIONS: &[&str] = &["show", "text", "verse"];

/// Formatos binarios con soporte pendiente (protobuf de PowerPoint, Word, bases de datos…).
const UNSUPPORTED_EXTENSIONS: &[&str] = &["powerpoint", "word", "powerkey_binary", "sqlite", "mdb"];

/// Prefijos que en el JSON de un proyecto envuelven una ruta de media.
const MEDIA_MARKERS: &[&str] = &["img src=\\\"", "audio path=\\\""];

fn extension_type(extension: &str) -> &'static str {
    if TEXT_EXTENSIONS.contains(&extension) {
        "text"
    } else if UNSUPPORTED_EXTENSIONS.contains(&extension) {
        "unsupported"
    } else {
        "project"
    }
}

/// Réplica del `filePathHashCode` de JavaScript (hash de 32 bits con signo).
fn file_path_hash_code(path: &str) -> i32 {
    let mut hash: u32 = 0;
    for c in path.chars() {
        let code = c as u32;
        hash = hash.wrapping_mul(31).wrapping_add(code);
    }
    hash as i32
}

/// Ruta de una carpeta de datos del StoreManager (la crea si no existe).
fn data_folder_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    folder: DataFolder,
    subfolder: Option<&str>,
) -> String {
    let state = app.state::<AppState>();
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"));
    match stores {
        Ok(s) => s.get_data_folder_path(folder, subfolder),
        Err(_) => String::new(),
    }
}

/// Misma convención que la miniatura de PDF de la app: hash del path bajo Imports/PDF.
fn pdf_thumbnail_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>, input_path: &Path) -> String {
    let input_str = input_path.to_string_lossy().to_string();
    let folder = data_folder_path(app, DataFolder::Imports, Some("PDF"));
    if folder.is_empty() {
        return String::new();
    }
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    input_str.hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());
    Path::new(&folder)
        .join(format!("{hash}.png"))
        .to_string_lossy()
        .into_owned()
}

fn emit_import<R: tauri::Runtime>(app: &tauri::AppHandle<R>, channel: &str, data: Value) {
    let _ = app.emit(
        "MAIN",
        json!({ "channel": "IMPORT2", "data": { "channel": channel, "data": data } }),
    );
}

fn emit_alert<R: tauri::Runtime>(app: &tauri::AppHandle<R>, message: &str) {
    let _ = app.emit("MAIN", json!({ "channel": "ALERT", "data": message }));
}

/// Extrae data.json y la media de un zip de proyecto, moviendo la media a
/// Imports/Media y reemplazando en el JSON las rutas originales por
/// `../Media/<hash>_<nombre>` (igual que `extractZipDataAndMedia` de Electron).
fn read_zip_project<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    path: &Path,
) -> AppResult<(String, String, String)> {
    let bytes = std::fs::read(path)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let path_str = path.to_string_lossy().to_string();

    let reader = std::io::Cursor::new(bytes);
    let mut archive =
        zip::ZipArchive::new(reader).map_err(|e| AppError::new(format!("zip inválido: {e}")))?;

    let mut data_json: Option<String> = None;
    let mut media: HashMap<String, Vec<u8>> = HashMap::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| AppError::new(format!("zip: {e}")))?;
        if file.is_dir() {
            continue;
        }
        let entry_name = file.name().to_string();
        if entry_name == "data.json" {
            let mut buf = String::new();
            file.read_to_string(&mut buf)?;
            data_json = Some(buf);
        } else {
            let base_name = Path::new(&entry_name)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or(entry_name);
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)?;
            media.insert(base_name, buf);
        }
    }

    let mut content =
        data_json.ok_or_else(|| AppError::new("El zip no contiene data.json".to_string()))?;

    let media_folder = data_folder_path(app, DataFolder::Imports, Some("Media"));
    if media_folder.is_empty() {
        return Err(AppError::new("No se pudo resolver la carpeta de media"));
    }

    // Reemplaza cada ruta de media del JSON por el nombre con hash del archivo extraído.
    for marker in MEDIA_MARKERS {
        let mut cursor = 0;
        while let Some(start) = content[cursor..].find(marker) {
            let url_start = cursor + start + marker.len();
            // En el JSON crudo la URL termina en `\"` (las barras invertidas de las
            // rutas Windows son `\\`, así que hay que buscar la secuencia completa).
            let Some(end_rel) = content[url_start..].find("\\\"") else {
                break;
            };
            let url_end = url_start + end_rel;
            let url = content[url_start..url_end].to_string();
            let decoded = url.replace("%20", " ");
            let base_name = Path::new(&decoded)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let Some(file_bytes) = media.get(&base_name) else {
                cursor = url_end;
                continue;
            };
            let new_name = format!("{}_{}", file_path_hash_code(&decoded), base_name);
            let _ = std::fs::create_dir_all(&media_folder);
            let _ = std::fs::write(Path::new(&media_folder).join(&new_name), file_bytes);
            let rel_path = format!("../Media/{}", new_name);
            content.replace_range(url_start..url_end, &rel_path);
            cursor = url_start + rel_path.len();
        }
    }

    Ok((content, path_str, name))
}

/// Un archivo .shows o .zip de proyecto puede traer el JSON plano o un zip con data.json + media.
fn read_project<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    path: &Path,
    extension: &str,
) -> AppResult<Value> {
    let bytes = std::fs::read(path)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let path_str = path.to_string_lossy().to_string();

    if bytes.starts_with(b"PK\x03\x04") {
        let (content, path_str, name) = read_zip_project(app, path)?;
        return Ok(
            json!({ "content": content, "path": path_str, "name": name, "extension": extension }),
        );
    }

    let content = String::from_utf8_lossy(&bytes).into_owned();
    Ok(json!({ "content": content, "path": path_str, "name": name, "extension": extension }))
}

/// Bundle de proyectos (probundle/vpc/qsp o .shows comprimido): el frontend
/// espera el contenido concatenado de los items del data.json del zip.
fn read_zip_bundle(path: &Path) -> AppResult<Value> {
    let bytes = std::fs::read(path)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let reader = std::io::Cursor::new(bytes);
    let mut archive =
        zip::ZipArchive::new(reader).map_err(|e| AppError::new(format!("zip inválido: {e}")))?;
    let mut data_json: Option<Value> = None;
    for i in 0..archive.len() {
        let file = archive
            .by_index(i)
            .map_err(|e| AppError::new(format!("zip: {e}")))?;
        if file.name().ends_with("data.json") {
            let mut buf = String::new();
            file.take(u64::MAX).read_to_string(&mut buf)?;
            data_json = serde_json::from_str(&buf).ok();
            break;
        }
    }
    match data_json {
        Some(Value::Array(items)) => {
            let content = items
                .iter()
                .filter_map(|item| item.get("content").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n");
            Ok(
                json!({ "content": content, "path": path.to_string_lossy().to_string(), "name": name, "extension": "show" }),
            )
        }
        _ => Err(AppError::new(
            "No se encontró data.json legible en el bundle".to_string(),
        )),
    }
}

fn import_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, files: &[String]) {
    // Aviso de "importando" sólo cuando hay cosas pesadas que hacer (como en Electron).
    if files.len() > 1 {
        emit_alert(app, "popup.importing");
    }

    let mut projects: Vec<Value> = Vec::new();
    let mut shows: Vec<Value> = Vec::new();

    for file in files {
        let path = Path::new(file);
        let Some(ext) = path.extension().map(|e| e.to_string_lossy().to_string()) else {
            continue;
        };

        let entry = match ext.as_str() {
            // Un zip puede ser un bundle de proyectos (probundle/vpc/qsp) o un .shows comprimido.
            "zip" | "probundle" | "vpc" | "qsp" => match read_zip_bundle(path) {
                Ok(value) => value,
                Err(e) => {
                    emit_alert(app, &e.to_string());
                    continue;
                }
            },
            "pdf" => {
                let thumbnail_path = pdf_thumbnail_path(app, path);
                json!({ "thumbnailPath": thumbnail_path, "path": file, "name": path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default() })
            }
            "powerkey" => json!({ "path": file.clone() }),
            "freeshow_project" | "freeshow_template" | "freeshow_overlay" => {
                match read_project(app, path, &ext) {
                    Ok(value) => value,
                    Err(e) => {
                        emit_alert(app, &e.to_string());
                        continue;
                    }
                }
            }
            _ => {
                if extension_type(&ext) == "unsupported" {
                    let name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    emit_alert(
                        app,
                        &format!("Sin soporte para importar \"{}\" todavía", name),
                    );
                    continue;
                }
                let content = match std::fs::read_to_string(path) {
                    Ok(c) => c,
                    Err(e) => {
                        emit_alert(app, &e.to_string());
                        continue;
                    }
                };
                json!({ "content": content, "path": file, "name": path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), "extension": ext })
            }
        };

        match extension_type(&ext) {
            "text" => shows.push(entry),
            _ => projects.push(entry),
        }
    }

    let has_projects = !projects.is_empty();
    let has_shows = !shows.is_empty();
    if has_projects {
        emit_import(app, "IMPORT_PROJECTS", Value::Array(projects));
    }
    if has_shows {
        emit_import(app, "IMPORT_SHOWS", Value::Array(shows));
    }
    if has_projects || has_shows {
        emit_alert(app, "actions.imported");
    }
}

/// IMPORT: abre el diálogo nativo para elegir archivos y los importa.
#[tauri::command]
pub async fn IMPORT<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    window: tauri::WebviewWindow<R>,
) -> AppResult<()> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("Importable", IMPORT_EXTENSIONS)
        .pick_files(move |files| {
            let _ = tx.send(files);
        });

    let files: Vec<String> = match rx.await {
        Ok(Some(paths)) => paths
            .iter()
            .filter_map(|p| p.as_path().map(|p| p.to_string_lossy().to_string()))
            .collect(),
        _ => {
            // Cancelado: se notifica al frontend para que ofrezca su fallback web.
            let _ = window.emit(
                "MAIN",
                json!({ "channel": "IMPORT2", "data": { "channel": "IMPORT_FILES", "data": Value::Null } }),
            );
            return Ok(());
        }
    };

    import_paths(&app, &files);
    Ok(())
}

/// IMPORT_FILES: importa una lista de rutas ya elegidas (fallback web del diálogo).
#[tauri::command]
pub async fn IMPORT_FILES<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    files: Vec<String>,
) -> AppResult<()> {
    import_paths(&app, &files);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::data::store::StoreManager;
    use crate::state::AppState;
    use tauri::test::mock_app;

    #[test]
    fn file_path_hash_matches_javascript() {
        assert_eq!(
            file_path_hash_code("C:\\Users\\test\\media\\background.png"),
            -2100800270
        );
    }

    #[test]
    fn import_files_emits_projects_and_shows() {
        let app = mock_app();
        let temp = std::env::temp_dir().join(format!("pf_import_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp);
        app.manage(AppState::new(StoreManager::new(temp.clone())));

        let project_path = temp.join("demo.freeshow_project");
        std::fs::write(&project_path, "{\"shows\":{}}").unwrap();
        let show_path = temp.join("demo.show");
        std::fs::write(&show_path, "{\"name\":\"hola\"}").unwrap();

        let files = vec![
            project_path.to_string_lossy().to_string(),
            show_path.to_string_lossy().to_string(),
        ];
        tauri::async_runtime::block_on(IMPORT_FILES(app.handle().clone(), files)).unwrap();

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn import_files_skips_unsupported_without_crashing() {
        let app = mock_app();
        let temp = std::env::temp_dir().join(format!("pf_import_bad_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp);
        app.manage(AppState::new(StoreManager::new(temp.clone())));

        let pptx = temp.join("deck.pptx");
        std::fs::write(&pptx, b"fake").unwrap();

        let files = vec![pptx.to_string_lossy().to_string()];
        tauri::async_runtime::block_on(IMPORT_FILES(app.handle().clone(), files)).unwrap();

        let _ = std::fs::remove_dir_all(&temp);
    }
}
