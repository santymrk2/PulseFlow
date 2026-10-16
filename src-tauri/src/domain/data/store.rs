//! Gestor de tiendas de datos (persistencia en JSON).
//!
//! Adaptación incremental de `src/electron/data/store.ts` (electron-store) a Rust.
//!
//! - `config.json` y las tiendas **no portables** viven en el directorio de
//!   configuración de la app.
//! - Las tiendas **portables** viven en `<dataPath>/Config` (equivale a
//!   `dataFolderNames.userData`), donde `dataPath` es `config.dataPath` o el
//!   valor por defecto (`<Documents>/PulseFlow`).
//!
//! Los datos se representan como [`serde_json::Value`] para conservar la
//! exactitud de las claves anidadas de TypeScript. Una capa de structs tipados
//! se puede añadir más adelante por dominio (regla 4 del proyecto).

use super::defaults;
use crate::utils::files::{self, DataFolder};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::PathBuf;

/// Definición de una tienda: `id`, nombre de archivo, si es portable y si se
/// serializa en modo "minify" (sin espacios).
struct StoreDef {
    id: &'static str,
    file_name: &'static str,
    portable: bool,
    minify: bool,
}

const STORE_DEFS: &[StoreDef] = &[
    StoreDef { id: "SHOWS", file_name: "shows", portable: false, minify: true },
    StoreDef { id: "SETTINGS", file_name: "settings", portable: false, minify: false },
    StoreDef { id: "SYNCED_SETTINGS", file_name: "settings_synced", portable: true, minify: false },
    StoreDef { id: "THEMES", file_name: "themes", portable: true, minify: false },
    StoreDef { id: "PROJECTS", file_name: "projects", portable: true, minify: false },
    StoreDef { id: "STAGE", file_name: "stage", portable: true, minify: false },
    StoreDef { id: "OVERLAYS", file_name: "overlays", portable: true, minify: false },
    StoreDef { id: "TEMPLATES", file_name: "templates", portable: true, minify: false },
    StoreDef { id: "EVENTS", file_name: "events", portable: true, minify: false },
    StoreDef { id: "HISTORY", file_name: "history", portable: false, minify: true },
    StoreDef { id: "MEDIA", file_name: "media", portable: false, minify: true },
    StoreDef { id: "CACHE", file_name: "cache", portable: false, minify: true },
    StoreDef { id: "CACHE_SYNC", file_name: "cache_sync", portable: false, minify: true },
    StoreDef { id: "USAGE", file_name: "usage", portable: false, minify: true },
    StoreDef { id: "ERROR_LOG", file_name: "error_log", portable: false, minify: false },
    StoreDef { id: "DRIVE_API_KEY", file_name: "DRIVE_API_KEY", portable: false, minify: false },
    StoreDef { id: "ACCESS", file_name: "ACCESS", portable: false, minify: false },
];

/// Tienda cargada en memoria.
struct StoreData {
    def_index: usize,
    value: Value,
}

/// Gestor de tiendas + config.
pub struct StoreManager {
    config_dir: PathBuf,
    config_path: PathBuf,
    config: Value,
    stores: HashMap<String, StoreData>,
}

fn default_for(id: &str) -> Value {
    match id {
        "SETTINGS" => defaults::default_settings(),
        "SYNCED_SETTINGS" => defaults::default_synced_settings(),
        _ => json!({}),
    }
}

impl StoreManager {
    /// Crea el gestor leyendo los archivos existentes (o los valores por defecto).
    pub fn new(config_dir: PathBuf) -> Self {
        let config_path = config_dir.join("config.json");
        let config = std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .filter(|v| v.is_object())
            .unwrap_or_else(defaults::default_config);

        let mut stores = HashMap::new();
        for (idx, def) in STORE_DEFS.iter().enumerate() {
            let path = Self::store_path_for(&config, &config_dir, def);
            let value = std::fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .unwrap_or_else(|| default_for(def.id));
            stores.insert(def.id.to_string(), StoreData { def_index: idx, value });
        }

        Self { config_dir, config_path, config, stores }
    }

    fn store_path_for(config: &Value, config_dir: &std::path::Path, def: &StoreDef) -> PathBuf {
        if def.portable {
            let root = data_root_from_config(config);
            root.join(DataFolder::UserData.name()).join(format!("{}.json", def.file_name))
        } else {
            config_dir.join(format!("{}.json", def.file_name))
        }
    }

    /// Devuelve una copia del contenido de la tienda (`getStore`).
    pub fn get(&self, id: &str) -> Value {
        self.stores
            .get(id)
            .map(|s| s.value.clone())
            .unwrap_or_else(|| default_for(id))
    }

    /// Guarda el contenido completo de la tienda (`safeStoreSet` / `setStore`).
    pub fn set(&mut self, id: &str, value: Value) {
        let Some(idx) = STORE_DEFS.iter().position(|d| d.id == id) else {
            return;
        };
        let def = &STORE_DEFS[idx];
        let path = Self::store_path_for(&self.config, &self.config_dir, def);
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let payload = if def.minify {
            serde_json::to_string(&value).unwrap_or_default()
        } else {
            serde_json::to_string_pretty(&value).unwrap_or_default()
        };
        let _ = std::fs::write(&path, payload);
        self.stores.insert(id.to_string(), StoreData { def_index: idx, value });
    }

    /// Devuelve el objeto config completo.
    pub fn config(&self) -> Value {
        self.config.clone()
    }

    /// Devuelve `config.dataPath` (o `null`).
    pub fn data_path(&self) -> Option<String> {
        self.config.get("dataPath").and_then(Value::as_str).map(str::to_string)
    }

    /// Raíz de datos de la app (`getDataFolderRoot`).
    pub fn data_folder_root(&self) -> String {
        self.data_path().unwrap_or_else(|| default_data_folder_root().to_string_lossy().into_owned())
    }

    /// Ruta de una carpeta de datos, creándola si no existe (`getDataFolderPath`).
    pub fn get_data_folder_path(&self, folder: DataFolder, subfolder: Option<&str>) -> String {
        let mut p = PathBuf::from(self.data_folder_root()).join(folder.name());
        if let Some(sub) = subfolder {
            p = p.join(sub);
        }
        let _ = std::fs::create_dir_all(&p);
        p.to_string_lossy().into_owned()
    }

    /// Lectura de un valor con notación por puntos (`getStoreValue`).
    pub fn get_value(&self, file: &str, key: &str) -> Value {
        let container = if file == "config" { &self.config } else { match self.stores.get(file) { Some(s) => &s.value, None => return Value::Null } };
        get_path(container, key)
    }

    /// Identificadores de las tiendas *portables* (las que entran en un backup).
    pub fn portable_store_ids(&self) -> Vec<String> {
        STORE_DEFS
            .iter()
            .filter(|d| d.portable)
            .map(|d| d.id.to_string())
            .collect()
    }

    /// Escritura de un valor con notación por puntos (`setStoreValue`).
    pub fn set_value(&mut self, file: &str, key: &str, value: Value) {
        if file == "config" {
            set_path(&mut self.config, key, value);
            let payload = serde_json::to_string_pretty(&self.config).unwrap_or_default();
            let _ = std::fs::write(&self.config_path, payload);
            return;
        }
        if let Some(store) = self.stores.get_mut(file) {
            set_path(&mut store.value, key, value.clone());
            let def = &STORE_DEFS[store.def_index];
            let path = Self::store_path_for(&self.config, &self.config_dir, def);
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let payload = if def.minify { serde_json::to_string(&store.value).unwrap_or_default() } else { serde_json::to_string_pretty(&store.value).unwrap_or_default() };
            let _ = std::fs::write(path, payload);
        }
    }

    /// Actualiza `config.dataPath` (`UPDATE_DATA_PATH`), crea las carpetas y
    /// reescribe las tiendas portables en la nueva ubicación.
    pub fn update_data_path(&mut self, new_path: &str, _old_path: &str) {
        self.set_value("config", "dataPath", json!(new_path));
        let portable = data_root_from_config(&self.config).join(DataFolder::UserData.name());
        let _ = std::fs::create_dir_all(&portable);

        // Migrar las tiendas portables: como sus valores ya están en memoria,
        // reescribirlos en la nueva ruta conserva los datos.
        for def in STORE_DEFS.iter().filter(|d| d.portable) {
            let Some(store) = self.stores.get(def.id) else { continue };
            let path = portable.join(format!("{}.json", def.file_name));
            let payload = if def.minify { serde_json::to_string(&store.value).unwrap_or_default() } else { serde_json::to_string_pretty(&store.value).unwrap_or_default() };
            let _ = std::fs::write(path, payload);
        }
    }
}

/// Raíz de datos por defecto: `<Documents>/PulseFlow` (equivale a
/// `getDefaultDataFolderRoot`).
pub fn default_data_folder_root() -> PathBuf {
    let documents = files::get_media_folder_path("documents").unwrap_or_else(|_| PathBuf::from("."));
    documents.join("PulseFlow")
}

/// Raíz de datos desde `config.dataPath` o el valor por defecto.
fn data_root_from_config(config: &Value) -> PathBuf {
    config
        .get("dataPath")
        .and_then(Value::as_str)
        .map(PathBuf::from)
        .unwrap_or_else(default_data_folder_root)
}

/// Lee un valor siguiendo una ruta con puntos.
fn get_path(container: &Value, key: &str) -> Value {
    let mut current = container;
    for part in key.split('.') {
        match current.get(part) {
            Some(next) => current = next,
            None => return Value::Null,
        }
    }
    current.clone()
}

/// Escribe un valor siguiendo una ruta con puntos (creando objetos intermedios).
fn set_path(container: &mut Value, key: &str, value: Value) {
    let parts: Vec<&str> = key.split('.').collect();
    set_path_parts(container, &parts, value);
}

fn set_path_parts(current: &mut Value, parts: &[&str], value: Value) {
    let Some(head) = parts.first().copied() else { return };
    if !current.is_object() {
        *current = Value::Object(Map::new());
    }
    if parts.len() == 1 {
        if let Some(obj) = current.as_object_mut() {
            obj.insert(head.to_string(), value);
        }
        return;
    }
    if let Some(obj) = current.as_object_mut() {
        let entry = obj.entry(head.to_string()).or_insert_with(|| Value::Object(Map::new()));
        set_path_parts(entry, &parts[1..], value);
    }
}
