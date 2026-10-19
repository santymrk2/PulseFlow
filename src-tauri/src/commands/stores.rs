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
///
/// Propaga el error de escritura al frontend (F3.1): si el archivo no se pudo
/// guardar, el comando falla y el aviso se muestra como toast.
#[tauri::command]
pub fn SET_STORE_VALUE(state: State<'_, AppState>, data: SetStoreValueData) -> AppResult<()> {
    let mut stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    stores.set_value(&data.file, &data.key, data.value)
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
    stores.update_data_path(&data.new_path, &data.old_path)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::data::store::StoreManager;
    use serde_json::json;
    use tauri::Manager;

    const ORIGINAL: &str = r#"{"language":"es"}"#;

    /// Carpeta de datos temporal con un `settings.json` original.
    fn temp_data_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("pulseflow-stores-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("carpeta temporal");
        dir
    }

    fn payload() -> SetStoreValueData {
        SetStoreValueData {
            file: "SETTINGS".to_string(),
            key: "theme".to_string(),
            value: json!("dark"),
        }
    }

    /// Carpeta sin permisos de escritura (F3.1): el comando debe devolver el
    /// error en lugar de ignorarlo, y el archivo original debe quedar intacto.
    #[cfg(unix)]
    #[test]
    fn set_store_value_devuelve_error_en_carpeta_sin_permisos() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_data_dir("set-store-value");
        std::fs::write(dir.join("settings.json"), ORIGINAL).expect("archivo original");
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o555)).expect("chmod 555");

        let app = tauri::test::mock_app();
        app.manage(AppState::new(StoreManager::new(dir.clone())));
        let result = SET_STORE_VALUE(app.state::<AppState>(), payload());

        // Restaurar permisos para verificar y limpiar.
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).expect("chmod 755");

        assert!(result.is_err(), "el comando debe devolver error si no se pudo escribir");
        assert_eq!(
            std::fs::read_to_string(dir.join("settings.json")).expect("leer original"),
            ORIGINAL,
            "el archivo original debe quedar intacto"
        );
        assert!(!dir.join("settings.json.tmp").exists(), "no debe quedar un temporal");

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Equivalente en Windows (no hay chmod de carpeta): el destino no es
    /// escribible porque es una carpeta, y el renombre atómico falla.
    #[cfg(windows)]
    #[test]
    fn set_store_value_devuelve_error_si_el_destino_no_es_escribible() {
        let dir = temp_data_dir("set-store-value");
        let target = dir.join("settings.json");
        std::fs::create_dir(&target).expect("destino no escribible");
        std::fs::write(target.join("dentro.txt"), ORIGINAL).expect("contenido original");

        let app = tauri::test::mock_app();
        app.manage(AppState::new(StoreManager::new(dir.clone())));
        let result = SET_STORE_VALUE(app.state::<AppState>(), payload());

        assert!(result.is_err(), "el comando debe devolver error si no se pudo escribir");
        assert_eq!(
            std::fs::read_to_string(target.join("dentro.txt")).expect("leer original"),
            ORIGINAL,
            "el contenido original debe quedar intacto"
        );
        assert!(!dir.join("settings.json.tmp").exists(), "no debe quedar un temporal");

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Con la carpeta escribible, la misma llamada guarda el valor (control
    /// del test anterior: falla por permisos, no por otra razón).
    #[test]
    fn set_store_value_guarda_cuando_hay_permisos() {
        let dir = temp_data_dir("set-store-value-ok");

        let app = tauri::test::mock_app();
        app.manage(AppState::new(StoreManager::new(dir.clone())));
        SET_STORE_VALUE(app.state::<AppState>(), payload()).expect("guardado con permisos");

        let saved = std::fs::read_to_string(dir.join("settings.json")).expect("leer guardado");
        assert!(saved.contains("dark"), "el valor debe haberse escrito: {saved}");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
