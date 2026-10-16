//! Comandos de persistencia (dominio `STORES`).
//!
//! Traducción de los canales `Main.SETTINGS` ... `Main.CACHE`, además de
//! `GET_STORE_VALUE`, `SET_STORE_VALUE`, `DATA_PATH`, `UPDATE_DATA_PATH` y
//! `GET_PATHS` de `src/electron/IPC/responsesMain.ts`.

#![allow(non_snake_case)]

use crate::domain::data::store::default_data_folder_root;
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::utils::files::get_media_folder_path;
use serde::Deserialize;
use serde_json::Value;
use tauri::State;

/// Ayudante para bloquear el `StoreManager` y leer una tienda.
fn read_store(state: &State<'_, AppState>, id: &str) -> AppResult<Value> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    Ok(stores.get(id))
}

macro_rules! store_getter {
    ($name:ident, $id:expr) => {
        #[tauri::command]
        pub fn $name(state: State<'_, AppState>) -> AppResult<Value> {
            read_store(&state, $id)
        }
    };
}

store_getter!(SETTINGS, "SETTINGS");
store_getter!(SYNCED_SETTINGS, "SYNCED_SETTINGS");
store_getter!(STAGE, "STAGE");
store_getter!(PROJECTS, "PROJECTS");
store_getter!(OVERLAYS, "OVERLAYS");
store_getter!(TEMPLATES, "TEMPLATES");
store_getter!(EVENTS, "EVENTS");
store_getter!(MEDIA, "MEDIA");
store_getter!(THEMES, "THEMES");
store_getter!(DRIVE_API_KEY, "DRIVE_API_KEY");
store_getter!(HISTORY, "HISTORY");
store_getter!(USAGE, "USAGE");
store_getter!(CACHE, "CACHE");

#[derive(Deserialize)]
pub struct StoreValueData {
    pub file: String,
    pub key: String,
}

#[derive(Deserialize)]
pub struct SetStoreValueData {
    pub file: String,
    pub key: String,
    pub value: Value,
}

/// `GET_STORE_VALUE`: lee un valor con notación por puntos.
#[tauri::command]
pub fn GET_STORE_VALUE(state: State<'_, AppState>, data: StoreValueData) -> AppResult<Value> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    Ok(stores.get_value(&data.file, &data.key))
}

/// `SET_STORE_VALUE`: escribe un valor con notación por puntos.
#[tauri::command]
pub fn SET_STORE_VALUE(state: State<'_, AppState>, data: SetStoreValueData) -> AppResult<()> {
    let mut stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    stores.set_value(&data.file, &data.key, data.value);
    Ok(())
}

/// `DATA_PATH`: raíz de datos de la app.
#[tauri::command]
pub fn DATA_PATH(state: State<'_, AppState>) -> AppResult<String> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    Ok(stores.data_folder_root())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDataPathData {
    pub new_path: String,
    pub old_path: String,
}

/// `UPDATE_DATA_PATH`: cambia la carpeta de datos.
#[tauri::command]
pub fn UPDATE_DATA_PATH(state: State<'_, AppState>, data: UpdateDataPathData) -> AppResult<()> {
    let mut stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    stores.update_data_path(&data.new_path, &data.old_path);
    Ok(())
}

/// Rutas base de medios (`GET_PATHS` en Electron → `pictures`, `videos`, `music`).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MainFilePaths {
    pub pictures: String,
    pub videos: String,
    pub music: String,
}

/// `GET_PATHS`.
#[tauri::command]
pub fn GET_PATHS() -> AppResult<MainFilePaths> {
    Ok(MainFilePaths {
        pictures: media_path("pictures"),
        videos: media_path("videos"),
        music: media_path("music"),
    })
}

fn media_path(kind: &str) -> String {
    get_media_folder_path(kind)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| default_data_folder_root().to_string_lossy().into_owned())
}
