//! Comandos del dominio `FILES`.
//!
//! Traducción de `src/electron/utils/files.ts` y de las entradas FILES de
//! `src/electron/IPC/responsesMain.ts`.
//!
//! Cubre el núcleo de sistema de archivos y diálogos:
//!
//! - `READ_FILE`, `READ_FOLDER`, `FILE_INFO`
//! - `OPEN_FOLDER`, `OPEN_FILE` (diálogos nativos)
//! - `SYSTEM_OPEN`, `OPEN_LOG`, `OPEN_CACHE`, `OPEN_APPDATA`, `OPEN_FOLDER_PATH`
//! - `READ_BIBLES_FOLDER`, `GET_CACHE_PATH`
//! - `GET_MEDIA_FOLDER_PATH`, `SET_MEDIA_FOLDER_PATH`
//! - `LOCATE_MEDIA_FILE`, `BUNDLE_MEDIA_FILES`
//!
//! Diferencia de diseño con Electron: allí `OPEN_FOLDER`/`OPEN_FILE` devolvían el
//! resultado por eventos (`ToMain.OPEN_FOLDER2`/`OPEN_FILE2`). En Tauri el comando
//! resuelve directamente la ruta o los archivos seleccionados.
//!
//! Pendiente: la generación real de miniaturas en `READ_FOLDER` (dominio media).

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::files::{self, DataFolder, FileInfoStat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "tiff", "tif", "jfif", "avif", "heic",
];
const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "webm", "ogv", "mov", "m4v", "3gp", "3g2", "avi", "mkv", "flv", "mpeg", "mpg", "wmv",
];

fn is_media(extension: &str) -> bool {
    let ext = extension.to_ascii_lowercase();
    IMAGE_EXTENSIONS.contains(&ext.as_str()) || VIDEO_EXTENSIONS.contains(&ext.as_str())
}

/// Ruta de configuración de la app (donde viven `config.json` y las tiendas).
fn config_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_config_dir()?)
}

/// Carpeta de caché de miniaturas (`getThumbnailFolderPath`), creándola si falta.
pub fn thumbnail_folder(app: &AppHandle) -> AppResult<PathBuf> {
    let folder = config_dir(app)?.join("media-cache");
    std::fs::create_dir_all(&folder)?;
    Ok(folder)
}

// ---------------------------------------------------------------------------
// READ_FILE
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ReadFileData {
    pub path: String,
}

#[derive(Serialize)]
pub struct ReadFileResult {
    pub content: String,
}

/// `READ_FILE`: devuelve el contenido de un archivo como texto.
#[tauri::command]
pub fn READ_FILE(data: ReadFileData) -> AppResult<ReadFileResult> {
    Ok(ReadFileResult {
        content: files::read_file(&data.path)?,
    })
}

// ---------------------------------------------------------------------------
// FILE_INFO
// ---------------------------------------------------------------------------

/// `FILE_INFO`: estadísticas de un archivo o `null` si no existe.
#[tauri::command]
pub fn FILE_INFO(data: String) -> AppResult<Option<files::FileInfo>> {
    if !files::does_path_exist(&data) {
        return Ok(None);
    }
    match files::get_file_info(&data) {
        Ok(info) => Ok(Some(info)),
        Err(_) => Ok(None),
    }
}

// ---------------------------------------------------------------------------
// READ_FOLDER
// ---------------------------------------------------------------------------

/// `path` puede llegar como string o como arreglo de strings.
#[derive(Deserialize)]
#[serde(untagged)]
pub enum PathList {
    One(String),
    Many(Vec<String>),
}

impl PathList {
    fn into_vec(self) -> Vec<String> {
        match self {
            PathList::One(s) => vec![s],
            PathList::Many(v) => v,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFolderData {
    pub path: PathList,
    #[serde(default)]
    pub depth: Option<i64>,
    #[serde(default)]
    pub generate_thumbnails: Option<bool>,
    #[serde(default)]
    pub capture_folder_content: Option<bool>,
}

/// Entrada del mapa devuelto por `READ_FOLDER` (equivalente a `FileFolder`).
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum FileFolder {
    Folder {
        #[serde(rename = "isFolder")]
        is_folder: bool,
        path: String,
        name: String,
        files: Vec<String>,
        #[serde(rename = "noMedia", skip_serializing_if = "Option::is_none")]
        no_media: Option<bool>,
    },
    File {
        #[serde(rename = "isFolder")]
        is_folder: bool,
        path: String,
        name: String,
        #[serde(rename = "thumbnailPath")]
        thumbnail_path: String,
        stats: FileInfoStat,
    },
}

struct ReadFolderCtx {
    depth: i64,
    capture: bool,
}

/// `READ_FOLDER`: recorre carpetas recursivamente y devuelve un mapa
/// `ruta -> FileFolder`.
#[tauri::command]
pub fn READ_FOLDER(data: ReadFolderData) -> AppResult<HashMap<String, FileFolder>> {
    let ctx = ReadFolderCtx {
        depth: data.depth.unwrap_or(0),
        capture: data.capture_folder_content.unwrap_or(false),
    };

    let mut content: HashMap<String, FileFolder> = HashMap::new();
    for folder_path in data.path.into_vec() {
        let p = PathBuf::from(&folder_path);
        if !p.is_dir() {
            continue;
        }
        walk_folder(&folder_path, 0, &ctx, &mut content);
    }
    Ok(content)
}

fn walk_folder(folder_path: &str, current_depth: i64, ctx: &ReadFolderCtx, content: &mut HashMap<String, FileFolder>) {
    let exceeded = current_depth > ctx.depth;

    if content.contains_key(folder_path) {
        return;
    }

    if ctx.capture && current_depth >= 2 && exceeded {
        content.insert(folder_path.to_string(), folder_entry(folder_path, Vec::new(), None));
        return;
    }

    let Ok(names) = files::read_folder(folder_path) else {
        return;
    };
    let file_paths: Vec<String> = names
        .iter()
        .map(|name| Path::new(folder_path).join(name).to_string_lossy().into_owned())
        .collect();

    let mut no_media = false;
    if ctx.capture {
        no_media = true;
        for file_path in &file_paths {
            if !no_media {
                break;
            }
            if Path::new(file_path).is_dir() || is_media(&files::get_extension(file_path)) {
                no_media = false;
            }
        }
    }

    let stub = if ctx.capture && current_depth < 2 {
        false
    } else {
        exceeded
    };
    if stub {
        content.insert(
            folder_path.to_string(),
            folder_entry(folder_path, file_paths, no_media.then_some(true)),
        );
        return;
    }

    if ctx.capture && current_depth == 1 {
        let capture_thumbnails = first_media_files(&file_paths, 4);
        for file_path in capture_thumbnails {
            walk_file(&file_path, content);
        }
    } else {
        for file_path in &file_paths {
            if Path::new(file_path).is_dir() {
                walk_folder(file_path, current_depth + 1, ctx, content);
            } else {
                walk_file(file_path, content);
            }
        }
    }

    content.insert(
        folder_path.to_string(),
        folder_entry(folder_path, file_paths, no_media.then_some(true)),
    );
}

fn walk_file(file_path: &str, content: &mut HashMap<String, FileFolder>) {
    // La generación real de miniaturas pertenece al dominio thumbnails; aquí se
    // deja la ruta vacía como en Electron cuando no se genera miniatura.
    let Ok(info) = files::get_file_info(file_path) else {
        return;
    };
    let name = Path::new(file_path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    content.insert(
        file_path.to_string(),
        FileFolder::File {
            is_folder: false,
            path: file_path.to_string(),
            name,
            thumbnail_path: String::new(),
            stats: info.stat,
        },
    );
}

fn folder_entry(folder_path: &str, files: Vec<String>, no_media: Option<bool>) -> FileFolder {
    let name = Path::new(folder_path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    FileFolder::Folder {
        is_folder: true,
        path: folder_path.to_string(),
        name,
        files,
        no_media,
    }
}

fn first_media_files(paths: &[String], count: usize) -> Vec<String> {
    paths
        .iter()
        .filter(|p| is_media(&files::get_extension(p)))
        .take(count)
        .cloned()
        .collect()
}

// ---------------------------------------------------------------------------
// OPEN_FOLDER / OPEN_FILE (diálogos nativos)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct OpenFolderData {
    pub channel: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
}

/// `OPEN_FOLDER`: abre el diálogo de selección de carpeta y devuelve la ruta.
#[tauri::command]
pub async fn OPEN_FOLDER(app: AppHandle, data: OpenFolderData) -> AppResult<Option<String>> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    let mut builder = app.dialog().file();
    if let Some(title) = data.title {
        builder = builder.set_title(title);
    }
    if let Some(path) = data.path {
        builder = builder.set_directory(path);
    }
    builder.pick_folder(move |folder| {
        let _ = tx.send(folder.map(|f| f.to_string()));
    });
    rx.await.map_err(|_| AppError::new("Folder dialog cancelled"))
}

#[derive(Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Deserialize)]
pub struct OpenFileData {
    #[serde(default)]
    pub id: Option<String>,
    pub channel: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub filter: Option<FileFilter>,
    #[serde(default)]
    pub multiple: Option<bool>,
    #[serde(default)]
    pub read: Option<bool>,
}

#[derive(Serialize)]
pub struct OpenFileResult {
    pub files: Vec<String>,
    pub content: HashMap<String, String>,
}

/// `OPEN_FILE`: abre el diálogo de selección de archivos y devuelve los
/// elegidos (y su contenido si `read` es `true`).
#[tauri::command]
pub async fn OPEN_FILE(app: AppHandle, data: OpenFileData) -> AppResult<OpenFileResult> {
    let multiple = data.multiple.unwrap_or(true);
    let mut builder = app.dialog().file();
    if let Some(title) = &data.title {
        builder = builder.set_title(title.clone());
    }
    if let Some(filter) = &data.filter {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(filter.name.clone(), &extensions);
    }

    let files: Vec<String> = if multiple {
        let (tx, rx) = tokio::sync::oneshot::channel::<Option<Vec<String>>>();
        builder.pick_files(move |selected| {
            let list = selected.map(|paths| paths.into_iter().map(|p| p.to_string()).collect());
            let _ = tx.send(list);
        });
        rx.await.map_err(|_| AppError::new("File dialog cancelled"))?.unwrap_or_default()
    } else {
        let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
        builder.pick_file(move |selected| {
            let _ = tx.send(selected.map(|p| p.to_string()));
        });
        rx.await
            .map_err(|_| AppError::new("File dialog cancelled"))?
            .into_iter()
            .collect()
    };

    let mut content = HashMap::new();
    if data.read.unwrap_or(false) {
        for file_path in &files {
            content.insert(file_path.clone(), files::read_file(file_path).unwrap_or_default());
        }
    }

    Ok(OpenFileResult { files, content })
}

// ---------------------------------------------------------------------------
// SYSTEM_OPEN y atajos de carpetas
// ---------------------------------------------------------------------------

/// Replica de `openInSystem`: si `open_folder` abre la carpeta en el explorador,
/// si no la revela (`showItemInFolder`). Si abrir falla, revela.
fn open_in_system(app: &AppHandle, file_path: &str, open_folder: bool) {
    if !files::does_path_exist(file_path) {
        return;
    }
    if open_folder {
        if app.opener().open_path(file_path.to_string(), None::<&str>).is_ok() {
            return;
        }
    }
    if let Err(err) = app.opener().reveal_item_in_dir(file_path) {
        log::warn!("No se pudo mostrar {file_path} en el explorador: {err}");
    }
}

/// `SYSTEM_OPEN`: revela una ruta en el explorador del sistema.
#[tauri::command]
pub fn SYSTEM_OPEN(app: AppHandle, data: String) -> AppResult<()> {
    open_in_system(&app, &data, false);
    Ok(())
}

/// `OPEN_FOLDER_PATH`: abre una carpeta en el explorador del sistema.
#[tauri::command]
pub fn OPEN_FOLDER_PATH(app: AppHandle, data: String) -> AppResult<()> {
    open_in_system(&app, &data, true);
    Ok(())
}

/// `OPEN_LOG`: abre la carpeta de registros (`app_log_dir`, ver `logging_plugin` en `lib.rs`).
#[tauri::command]
pub fn OPEN_LOG(app: AppHandle) -> AppResult<()> {
    let folder = app.path().app_log_dir()?;
    std::fs::create_dir_all(&folder)?;
    open_in_system(&app, &folder.to_string_lossy(), true);
    Ok(())
}

/// `OPEN_CACHE`: abre la carpeta de caché de miniaturas.
#[tauri::command]
pub fn OPEN_CACHE(app: AppHandle) -> AppResult<()> {
    let folder = thumbnail_folder(&app)?;
    open_in_system(&app, &folder.to_string_lossy(), true);
    Ok(())
}

/// `OPEN_APPDATA`: abre la carpeta de configuración/datos de la app.
#[tauri::command]
pub fn OPEN_APPDATA(app: AppHandle) -> AppResult<()> {
    let folder = config_dir(&app)?;
    open_in_system(&app, &folder.to_string_lossy(), true);
    Ok(())
}

/// `GET_CACHE_PATH`: ruta de la carpeta de caché de miniaturas.
#[tauri::command]
pub fn GET_CACHE_PATH(app: AppHandle) -> AppResult<String> {
    Ok(thumbnail_folder(&app)?.to_string_lossy().into_owned())
}

// ---------------------------------------------------------------------------
// READ_BIBLES_FOLDER
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct BibleFile {
    pub path: String,
    pub name: String,
}

/// `READ_BIBLES_FOLDER`: lista los archivos `.fsb` de la carpeta de Biblias.
#[tauri::command]
pub fn READ_BIBLES_FOLDER(state: State<'_, AppState>) -> AppResult<Vec<BibleFile>> {
    let folder = {
        let stores = state
            .stores
            .lock()
            .map_err(|_| AppError::new("Store manager lock poisoned"))?;
        stores.get_data_folder_path(DataFolder::Scriptures, None)
    };

    let mut bibles = Vec::new();
    for name in files::read_folder(&folder)? {
        let path = Path::new(&folder).join(&name).to_string_lossy().into_owned();
        let display = name
            .strip_suffix(".fsb")
            .or_else(|| name.strip_suffix(".FSB"))
            .unwrap_or(&name)
            .to_string();
        bibles.push(BibleFile { path, name: display });
    }
    Ok(bibles)
}

// ---------------------------------------------------------------------------
// GET_MEDIA_FOLDER_PATH / SET_MEDIA_FOLDER_PATH
// ---------------------------------------------------------------------------

/// `GET_MEDIA_FOLDER_PATH`: `config.mediaFolderPath` o la carpeta de medios.
#[tauri::command]
pub fn GET_MEDIA_FOLDER_PATH(state: State<'_, AppState>) -> AppResult<String> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    if let Some(path) = stores.get_value("config", "mediaFolderPath").as_str() {
        if !path.is_empty() {
            return Ok(path.to_string());
        }
    }
    Ok(stores.get_data_folder_path(DataFolder::Media, None))
}

/// `SET_MEDIA_FOLDER_PATH`: guarda `config.mediaFolderPath`.
#[tauri::command]
pub fn SET_MEDIA_FOLDER_PATH(state: State<'_, AppState>, data: String) -> AppResult<()> {
    let mut stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    stores.set_value("config", "mediaFolderPath", serde_json::Value::String(data))
}

// ---------------------------------------------------------------------------
// LOCATE_MEDIA_FILE
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocateMediaFileData {
    pub file_path: String,
    #[serde(default)]
    pub folders: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocateMediaFileResult {
    pub path: String,
    pub has_changed: bool,
}

const NESTED_SEARCH: u32 = 8;

/// Carpeta de medios activa (`getMediaSyncFolderPath`).
fn media_sync_folder(state: &State<'_, AppState>) -> AppResult<String> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    if let Some(path) = stores.get_value("config", "mediaFolderPath").as_str() {
        if !path.is_empty() {
            return Ok(path.to_string());
        }
    }
    Ok(stores.get_data_folder_path(DataFolder::Media, None))
}

/// `filePathHashCode`: hash de 32 bits con desplazamiento, igual que en Electron.
fn file_path_hash_code(s: &str) -> String {
    let mut hash: i32 = 0;
    for code_unit in s.encode_utf16() {
        hash = hash.wrapping_shl(5).wrapping_sub(hash).wrapping_add(code_unit as i32);
    }
    if hash < 0 {
        let digits = hash.to_string();
        format!("i{}", &digits[1..])
    } else {
        format!("a{hash}")
    }
}

/// `getFileParentFolderId`: nombre de carpeta padre + hash de su ruta.
fn get_file_parent_folder_id(file_path: &str) -> String {
    let p = Path::new(file_path);
    let parent = p.parent().unwrap_or_else(|| Path::new(""));
    let parent_name = parent
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    format!("{}_{}", parent_name, file_path_hash_code(&parent.to_string_lossy()))
}

/// Decodifica secuencias `%XX` sin depender de una tabla de códigos completa.
fn decode_uri(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn file_names_match(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

/// `LOCATE_MEDIA_FILE`: intenta localizar un medio perdido en la carpeta de
/// medios o en las carpetas indicadas (búsqueda anidada hasta 8 niveles).
#[tauri::command]
pub async fn LOCATE_MEDIA_FILE(
    state: State<'_, AppState>,
    data: LocateMediaFileData,
) -> AppResult<Option<LocateMediaFileResult>> {
    let original = decode_uri(&data.file_path);
    if Path::new(&original).is_file() {
        return Ok(Some(LocateMediaFileResult {
            path: original,
            has_changed: false,
        }));
    }

    let media_folder = media_sync_folder(&state)?;
    let folder_id = get_file_parent_folder_id(&original);
    let file_name = Path::new(&original)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let media_file_path = Path::new(&media_folder).join(&folder_id).join(&file_name);
    if media_file_path.is_file() {
        return Ok(Some(LocateMediaFileResult {
            path: media_file_path.to_string_lossy().into_owned(),
            has_changed: true,
        }));
    }

    let parent_folder_name = Path::new(&original)
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut search_folders = vec![media_folder];
    search_folders.extend(data.folders.into_iter().map(|f| decode_uri(&f)));
    search_folders.retain(|f| !f.is_empty());

    for folder in search_folders {
        if let Some(found) = search_in_folder(&folder, &parent_folder_name, &file_name, 1) {
            return Ok(Some(LocateMediaFileResult {
                path: found,
                has_changed: true,
            }));
        }
    }

    Ok(None)
}

fn search_in_folder(
    folder: &str,
    parent_folder_name: &str,
    file_name: &str,
    level: u32,
) -> Option<String> {
    if level > NESTED_SEARCH || !Path::new(folder).is_dir() {
        return None;
    }

    // Se prioriza una ruta con la misma carpeta padre para desambiguar nombres.
    if !parent_folder_name.is_empty() {
        let potential = Path::new(folder).join(parent_folder_name).join(file_name);
        if potential.is_file() {
            return Some(potential.to_string_lossy().into_owned());
        }
    }

    let entries = files::read_folder(folder).ok()?;
    let mut sub_folders: Vec<String> = Vec::new();

    for name in &entries {
        let current = Path::new(folder).join(name);
        if current.is_dir() {
            sub_folders.push(current.to_string_lossy().into_owned());
            continue;
        }
        if file_names_match(name, file_name) {
            return Some(current.to_string_lossy().into_owned());
        }
    }

    for sub in sub_folders {
        if let Some(found) = search_in_folder(&sub, parent_folder_name, file_name, level + 1) {
            return Some(found);
        }
    }

    None
}

// ---------------------------------------------------------------------------
// BUNDLE_MEDIA_FILES
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleMediaFilesData {
    #[serde(default)]
    pub open_folder: bool,
    #[serde(default)]
    pub output_path: String,
}

/// Reúne las rutas de medios referenciadas por todas las tiendas/proyectos.
fn collect_media_paths(stores: &crate::domain::data::store::StoreManager, shows_folder: &str) -> Vec<String> {
    let mut media_files: Vec<String> = Vec::new();

    // Shows guardados en disco
    if let Ok(names) = files::read_folder(shows_folder) {
        for name in names {
            if !name.to_lowercase().ends_with(".show") {
                continue;
            }
            let show_path = Path::new(shows_folder).join(&name);
            let Ok(raw) = files::read_file(&show_path) else {
                continue;
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
                continue;
            };
            let show = value.get(1).unwrap_or(&value);

            if let Some(media) = show.get("media").and_then(|m| m.as_object()) {
                for entry in media.values() {
                    if let Some(path) = entry.get("path").and_then(|p| p.as_str()) {
                        media_files.push(path.to_string());
                    }
                }
            }
            if let Some(slides) = show.get("slides").and_then(|s| s.as_object()) {
                for slide in slides.values() {
                    if let Some(items) = slide.get("items").and_then(|i| i.as_array()) {
                        collect_items_media(items, &mut media_files);
                    }
                }
            }
        }
    }

    // Proyectos
    let projects = stores.get("PROJECTS");
    if let Some(map) = projects.get("projects").and_then(|p| p.as_object()) {
        for project in map.values() {
            if let Some(shows) = project.get("shows").and_then(|s| s.as_array()) {
                for show in shows {
                    let kind = show.get("type").and_then(|t| t.as_str()).unwrap_or("show");
                    if ["image", "video", "audio", "pdf", "ppt"].contains(&kind) {
                        if let Some(id) = show.get("id").and_then(|i| i.as_str()) {
                            media_files.push(id.to_string());
                        }
                    }
                }
            }
        }
    }

    // Overlays y plantillas
    for store_id in ["OVERLAYS", "TEMPLATES"] {
        let store = stores.get(store_id);
        if let Some(map) = store.as_object() {
            for entry in map.values() {
                if let Some(items) = entry.get("items").and_then(|i| i.as_array()) {
                    collect_items_media(items, &mut media_files);
                }
            }
        }
    }

    media_files.sort();
    media_files.dedup();
    media_files
}

fn collect_items_media(items: &[serde_json::Value], out: &mut Vec<String>) {
    for item in items {
        if item.get("type").and_then(|t| t.as_str()) == Some("media") {
            if let Some(src) = item.get("src").and_then(|s| s.as_str()) {
                out.push(src.to_string());
            }
        }
    }
}

/// `BUNDLE_MEDIA_FILES`: copia todos los medios referenciados a la carpeta de
/// medios (o a `outputPath`), organizados por carpeta padre + hash.
#[tauri::command]
pub async fn BUNDLE_MEDIA_FILES(
    app: AppHandle,
    state: State<'_, AppState>,
    data: BundleMediaFilesData,
) -> AppResult<()> {
    let (media_files, output_folder) = {
        let stores = state
            .stores
            .lock()
            .map_err(|_| AppError::new("Store manager lock poisoned"))?;
        let shows_folder = stores.get_data_folder_path(DataFolder::Shows, None);
        let media_files = collect_media_paths(&stores, &shows_folder);
        let output_folder = if data.output_path.is_empty() {
            stores.get_data_folder_path(DataFolder::Media, None)
        } else {
            data.output_path.clone()
        };
        (media_files, output_folder)
    };

    if media_files.is_empty() {
        return Ok(());
    }

    files::create_folder(&output_folder)?;

    for media_path in media_files {
        if media_path.starts_with(&output_folder) {
            continue;
        }
        let source = Path::new(&media_path);
        if !source.is_file() {
            continue;
        }

        let folder_id = get_file_parent_folder_id(&media_path);
        let new_folder = Path::new(&output_folder).join(&folder_id);
        files::create_folder(&new_folder)?;

        let file_name = source
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let new_path = new_folder.join(&file_name);
        if new_path.is_file() {
            continue;
        }
        // una copia que falla no frena las demás, pero queda registrada con las rutas
        if let Err(err) = tokio::fs::copy(source, &new_path).await {
            log::warn!("No se pudo copiar {} → {}: {err}", source.display(), new_path.display());
        }
    }

    if data.open_folder {
        open_in_system(&app, &output_folder, true);
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// SAVE_IMAGE
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageData {
    pub id: Option<String>,
    pub path: Option<String>,
    #[serde(default)]
    pub base64: Option<String>,
    #[serde(default)]
    pub buffer: Option<Vec<u8>>,
    #[serde(default)]
    pub file_path: Option<Vec<String>>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub open_folder: Option<bool>,
}

/// `SAVE_IMAGE`: guarda una imagen (base64 o buffer) en disco.
#[tauri::command]
pub fn SAVE_IMAGE(app: AppHandle, state: State<'_, AppState>, data: SaveImageData) -> AppResult<()> {
    if let (Some(path), Some(buffer)) = (data.path.as_deref(), data.buffer.as_ref()) {
        if let Some(parent) = Path::new(path).parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, buffer)?;
        return Ok(());
    }

    if let Some(b64) = data.base64.as_deref() {
        let stripped = if let Some(idx) = b64.find(',') {
            &b64[idx + 1..]
        } else {
            b64
        };
        let bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            stripped.trim(),
        )
        .map_err(|e| AppError::new(format!("base64 inválido: {e}")))?;

        let root = {
            let stores = state.stores.lock().map_err(|_| AppError::new("lock poisoned"))?;
            std::path::PathBuf::from(stores.data_folder_root())
        };

        let mut target = root.clone();
        if let Some(parts) = data.file_path.as_ref() {
            for part in parts {
                target = target.join(part);
            }
        }
        if let Some(fmt) = data.format.as_deref() {
            let fmt = fmt.trim_start_matches('.');
            if target.extension().is_none() {
                target = target.with_extension(fmt);
            }
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&target, &bytes)?;

        if data.open_folder.unwrap_or(false) {
            if let Some(parent) = target.parent() {
                if let Err(err) = app.opener().open_path(parent.to_string_lossy().to_string(), None::<&str>) {
                    log::warn!("No se pudo abrir {}: {err}", parent.display());
                }
            }
        }
        return Ok(());
    }

    let _ = data.id;
    Ok(())
}

// ---------------------------------------------------------------------------
// PDF_TO_IMAGE
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PdfToImageData {
    /// Ruta (o nombre) del PDF de origen; se usa sólo para nombrar la carpeta de
    /// salida `Imports/PDF/<nombre>/`.
    #[serde(default)]
    pub file_path: String,
    /// Páginas ya rasterizadas en el webview con pdf.js, como data URLs base64
    /// (`data:image/jpeg;base64,...`). El engine no renderiza PDFs, así que la
    /// conversión real ocurre en el frontend y acá sólo se persisten los bytes.
    #[serde(default)]
    pub images: Vec<String>,
}

/// Decodifica una data URL (`data:image/jpeg;base64,XXXX`) o un base64 pelado.
fn decode_data_url(input: &str) -> AppResult<Vec<u8>> {
    let stripped = match input.find(',') {
        Some(idx) => &input[idx + 1..],
        None => input,
    };
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, stripped.trim())
        .map_err(|e| AppError::new(format!("base64 inválido en PDF_TO_IMAGE: {e}")))
}

/// Nombre de carpeta seguro para el PDF (sin extensión ni separadores de ruta).
fn pdf_output_folder_name(file_path: &str) -> String {
    let file_name = file_path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(file_path)
        .trim();
    let without_ext = file_name.strip_suffix(".pdf").or_else(|| file_name.strip_suffix(".PDF")).unwrap_or(file_name);
    let sanitized: String = without_ext
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.') { c } else { '_' })
        .collect();
    let sanitized = sanitized.trim();
    if sanitized.is_empty() { "PDF".to_string() } else { sanitized.to_string() }
}

/// `PDF_TO_IMAGE`: guarda las páginas de un PDF (ya rasterizadas con pdf.js en
/// el webview) como `Imports/PDF/<nombre>/<n>.jpg` y devuelve las rutas escritas
/// en orden. El frontend es quien renderiza el PDF: el engine nativo no tiene
/// dependencias de renderizado de PDF (ver F7.5 del roadmap).
#[tauri::command]
pub fn PDF_TO_IMAGE(state: State<'_, AppState>, data: PdfToImageData) -> AppResult<Vec<String>> {
    if data.images.is_empty() {
        return Ok(Vec::new());
    }

    let folder = {
        let stores = state.stores.lock().map_err(|_| AppError::new("lock poisoned"))?;
        stores.get_data_folder_path(DataFolder::Imports, Some("PDF"))
    };
    if folder.is_empty() {
        return Err(AppError::new("No se pudo resolver la carpeta Imports/PDF"));
    }

    let target_dir = Path::new(&folder).join(pdf_output_folder_name(&data.file_path));
    std::fs::create_dir_all(&target_dir)?;

    let mut paths = Vec::with_capacity(data.images.len());
    for (index, image) in data.images.iter().enumerate() {
        let bytes = decode_data_url(image)?;
        let target = target_dir.join(format!("{}.jpg", index + 1));
        std::fs::write(&target, &bytes)?;
        paths.push(target.to_string_lossy().into_owned());
    }

    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::data::store::StoreManager;
    use tauri::test::mock_app;

    /// Config mínima con `dataPath` apuntando a un directorio temporal.
    fn data_configured_state(root: &Path) -> AppState {
        let config_dir = root.join("config");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("config.json"),
            format!("{{\"dataPath\": {:?}}}", root.join("data").to_string_lossy()),
        )
        .unwrap();
        AppState::new(StoreManager::new(config_dir))
    }

    #[test]
    fn pdf_output_folder_name_strips_extension_and_path() {
        assert_eq!(pdf_output_folder_name("/tmp/my deck.pdf"), "my deck");
        assert_eq!(pdf_output_folder_name("C:\\Users\\x\\Song.PDF"), "Song");
        assert_eq!(pdf_output_folder_name("weird/na:me.pdf"), "na_me");
        assert_eq!(pdf_output_folder_name(""), "PDF");
    }

    #[test]
    fn decode_data_url_accepts_prefix_and_bare_base64() {
        // "hi" en base64 = "aGk="
        assert_eq!(decode_data_url("data:image/jpeg;base64,aGk=").unwrap(), b"hi");
        assert_eq!(decode_data_url("aGk=").unwrap(), b"hi");
        assert!(decode_data_url("data:image/jpeg;base64,@@@").is_err());
    }

    #[test]
    fn pdf_to_image_writes_pages_in_order_and_reports_error() {
        let temp = std::env::temp_dir().join(format!("pf_pdf_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        let app = mock_app();
        app.manage(data_configured_state(&temp));
        let state = app.state::<AppState>();

        // Páginas de 1 byte cada una; se espera <data>/Imports/PDF/deck/1.jpg y 2.jpg
        let data = PdfToImageData {
            file_path: "/tmp/deck.pdf".to_string(),
            images: vec!["data:image/jpeg;base64,YQ==".to_string(), "data:image/jpeg;base64,Yg==".to_string()],
        };
        let paths = PDF_TO_IMAGE(state, data).unwrap();
        assert_eq!(paths.len(), 2);
        // Con el separador normalizado: en Windows la ruta nativa usa '\'.
        let norm = |p: &str| p.replace('\\', "/");
        assert!(norm(&paths[0]).ends_with("Imports/PDF/deck/1.jpg"));
        assert!(norm(&paths[1]).ends_with("Imports/PDF/deck/2.jpg"));
        assert_eq!(std::fs::read(&paths[0]).unwrap(), b"a");
        assert_eq!(std::fs::read(&paths[1]).unwrap(), b"b");

        // base64 inválido: falla y no deja el archivo a medio escribir.
        let bad = PdfToImageData {
            file_path: "/tmp/deck.pdf".to_string(),
            images: vec!["not-base64@@@".to_string()],
        };
        assert!(PDF_TO_IMAGE(app.state::<AppState>(), bad).is_err());

        // Sin imágenes: no es error, devuelve vacío.
        let empty = PdfToImageData::default();
        assert!(PDF_TO_IMAGE(app.state::<AppState>(), empty).unwrap().is_empty());

        let _ = std::fs::remove_dir_all(&temp);
    }
}
