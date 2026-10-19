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
use crate::error::{AppError, AppResult};
use crate::utils::files::{self, DataFolder};
use serde_json::{Map, Value, json};
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
    StoreDef {
        id: "SHOWS",
        file_name: "shows",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "SETTINGS",
        file_name: "settings",
        portable: false,
        minify: false,
    },
    StoreDef {
        id: "SYNCED_SETTINGS",
        file_name: "settings_synced",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "THEMES",
        file_name: "themes",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "PROJECTS",
        file_name: "projects",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "STAGE",
        file_name: "stage",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "OVERLAYS",
        file_name: "overlays",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "TEMPLATES",
        file_name: "templates",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "EVENTS",
        file_name: "events",
        portable: true,
        minify: false,
    },
    StoreDef {
        id: "HISTORY",
        file_name: "history",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "MEDIA",
        file_name: "media",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "CACHE",
        file_name: "cache",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "CACHE_SYNC",
        file_name: "cache_sync",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "USAGE",
        file_name: "usage",
        portable: false,
        minify: true,
    },
    StoreDef {
        id: "ERROR_LOG",
        file_name: "error_log",
        portable: false,
        minify: false,
    },
    StoreDef {
        id: "DRIVE_API_KEY",
        file_name: "DRIVE_API_KEY",
        portable: false,
        minify: false,
    },
    StoreDef {
        id: "ACCESS",
        file_name: "ACCESS",
        portable: false,
        minify: false,
    },
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
            stores.insert(
                def.id.to_string(),
                StoreData {
                    def_index: idx,
                    value,
                },
            );
        }

        Self {
            config_dir,
            config_path,
            config,
            stores,
        }
    }

    fn store_path_for(config: &Value, config_dir: &std::path::Path, def: &StoreDef) -> PathBuf {
        if def.portable {
            let root = data_root_from_config(config);
            root.join(DataFolder::UserData.name())
                .join(format!("{}.json", def.file_name))
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
    ///
    /// La escritura es atómica y **propaga el error** (F3.1): si el archivo no
    /// se pudo guardar, el valor en memoria no se actualiza, de modo que un
    /// intento siguiente vuelva a intentar escribirlo en vez de darlo por
    /// hecho.
    pub fn set(&mut self, id: &str, value: Value) -> AppResult<()> {
        let Some(idx) = STORE_DEFS.iter().position(|d| d.id == id) else {
            return Ok(());
        };
        let def = &STORE_DEFS[idx];
        let path = Self::store_path_for(&self.config, &self.config_dir, def);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|err| {
                AppError::new(format!("No se pudo crear {}: {err}", parent.display()))
            })?;
        }
        let payload = if def.minify {
            serde_json::to_string(&value)?
        } else {
            serde_json::to_string_pretty(&value)?
        };
        files::write_file(&path, &payload)?;
        self.stores.insert(
            id.to_string(),
            StoreData {
                def_index: idx,
                value,
            },
        );
        Ok(())
    }

    /// Devuelve el objeto config completo.
    pub fn config(&self) -> Value {
        self.config.clone()
    }

    /// Devuelve `config.dataPath` (o `null`).
    pub fn data_path(&self) -> Option<String> {
        self.config
            .get("dataPath")
            .and_then(Value::as_str)
            .map(str::to_string)
    }

    /// Raíz de datos de la app (`getDataFolderRoot`).
    pub fn data_folder_root(&self) -> String {
        self.data_path()
            .unwrap_or_else(|| default_data_folder_root().to_string_lossy().into_owned())
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
        let container = if file == "config" {
            &self.config
        } else {
            match self.stores.get(file) {
                Some(s) => &s.value,
                None => return Value::Null,
            }
        };
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
    ///
    /// Calcula el nuevo valor sobre una copia y sólo lo fija en memoria si el
    /// archivo se guardó bien (escritura atómica + error propagado, F3.1).
    pub fn set_value(&mut self, file: &str, key: &str, value: Value) -> AppResult<()> {
        if file == "config" {
            let mut next = self.config.clone();
            set_path(&mut next, key, value);
            let payload = serde_json::to_string_pretty(&next)?;
            files::write_file(&self.config_path, &payload)?;
            self.config = next;
            return Ok(());
        }

        let Some(store) = self.stores.get_mut(file) else {
            return Ok(());
        };
        let mut next = store.value.clone();
        set_path(&mut next, key, value);

        let def = &STORE_DEFS[store.def_index];
        let payload = if def.minify {
            serde_json::to_string(&next)?
        } else {
            serde_json::to_string_pretty(&next)?
        };
        let path = Self::store_path_for(&self.config, &self.config_dir, def);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|err| {
                AppError::new(format!("No se pudo crear {}: {err}", parent.display()))
            })?;
        }
        files::write_file(&path, &payload)?;
        store.value = next;
        Ok(())
    }

    /// Actualiza `config.dataPath` (`UPDATE_DATA_PATH`), crea las carpetas y
    /// reescribe las tiendas portables en la nueva ubicación.
    ///
    /// Propaga cualquier error de escritura (F3.1): si una tienda portable no
    /// se pudo guardar, el comando informa del fallo en lugar de ignorarlo.
    pub fn update_data_path(&mut self, new_path: &str, _old_path: &str) -> AppResult<()> {
        self.set_value("config", "dataPath", json!(new_path))?;
        let portable = data_root_from_config(&self.config).join(DataFolder::UserData.name());
        std::fs::create_dir_all(&portable).map_err(|err| {
            AppError::new(format!("No se pudo crear {}: {err}", portable.display()))
        })?;

        // Migrar las tiendas portables: como sus valores ya están en memoria,
        // reescribirlos en la nueva ruta conserva los datos.
        for def in STORE_DEFS.iter().filter(|d| d.portable) {
            let Some(store) = self.stores.get(def.id) else {
                continue;
            };
            let payload = if def.minify {
                serde_json::to_string(&store.value)?
            } else {
                serde_json::to_string_pretty(&store.value)?
            };
            let path = portable.join(format!("{}.json", def.file_name));
            files::write_file(&path, &payload)?;
        }
        Ok(())
    }
}

/// Raíz de datos por defecto: `<Documents>/PulseFlow` (equivale a
/// `getDefaultDataFolderRoot`).
pub fn default_data_folder_root() -> PathBuf {
    let documents =
        files::get_media_folder_path("documents").unwrap_or_else(|_| PathBuf::from("."));
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
    let Some(head) = parts.first().copied() else {
        return;
    };
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
        let entry = obj
            .entry(head.to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        set_path_parts(entry, &parts[1..], value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    const ORIGINAL: &str = r#"{"language":"es"}"#;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pulseflow-store-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("carpeta temporal");
        dir
    }

    fn file_names(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .expect("leer carpeta")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    /// `set` es la vía que usa `SAVE` para las tiendas (F3.1): en una carpeta
    /// sin permisos debe fallar a la vista, dejar el archivo original y no
    /// marcar el valor como guardado en memoria (así un reintento vuelve a
    /// intentar escribirlo).
    #[cfg(unix)]
    #[test]
    fn set_en_carpeta_sin_permisos_falla_sin_tocar_el_archivo() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("sin-permisos");
        fs::write(dir.join("settings.json"), ORIGINAL).expect("archivo original");

        let mut manager = StoreManager::new(dir.clone());
        let before = manager.get("SETTINGS");

        fs::set_permissions(&dir, fs::Permissions::from_mode(0o555)).expect("chmod 555");
        let result = manager.set("SETTINGS", json!({ "language": "fr" }));
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).expect("chmod 755");

        assert!(
            result.is_err(),
            "debe devolver error en una carpeta sin permisos"
        );
        assert_eq!(
            fs::read_to_string(dir.join("settings.json")).expect("leer original"),
            ORIGINAL,
            "el archivo original debe quedar intacto"
        );
        assert_eq!(
            file_names(&dir),
            vec!["settings.json".to_string()],
            "no debe quedar ningún temporal"
        );
        assert_eq!(
            manager.get("SETTINGS"),
            before,
            "la memoria no debe actualizarse si no se escribió"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn set_escribe_atomicamente_y_actualiza_la_memoria() {
        let dir = temp_dir("ok");
        let mut manager = StoreManager::new(dir.clone());

        manager
            .set("SETTINGS", json!({ "language": "fr" }))
            .expect("guardado");

        let saved = fs::read_to_string(dir.join("settings.json")).expect("leer guardado");
        assert!(
            saved.contains("fr"),
            "el valor debe estar en el archivo: {saved}"
        );
        assert_eq!(manager.get("SETTINGS"), json!({ "language": "fr" }));
        assert_eq!(
            file_names(&dir),
            vec!["settings.json".to_string()],
            "no debe quedar ningún temporal"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    /// `set_value` (usado por `SET_STORE_VALUE`) también propaga el error de
    /// escritura en lugar de ignorarlo.
    #[cfg(unix)]
    #[test]
    fn set_value_en_carpeta_sin_permisos_falla_sin_tocar_el_archivo() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("valor-sin-permisos");
        fs::write(dir.join("settings.json"), ORIGINAL).expect("archivo original");

        let mut manager = StoreManager::new(dir.clone());

        fs::set_permissions(&dir, fs::Permissions::from_mode(0o555)).expect("chmod 555");
        let result = manager.set_value("SETTINGS", "theme", json!("dark"));
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).expect("chmod 755");

        assert!(
            result.is_err(),
            "debe devolver error en una carpeta sin permisos"
        );
        assert_eq!(
            fs::read_to_string(dir.join("settings.json")).expect("leer original"),
            ORIGINAL,
            "el archivo original debe quedar intacto"
        );
        assert_eq!(
            manager.get_value("SETTINGS", "theme"),
            Value::Null,
            "la memoria no debe actualizarse si no se escribió"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    /// F3.2: en una instalación limpia (sin archivos) el estilo que referencia
    /// la salida por defecto existe y tiene nombre, así que Settings → Outputs
    /// no muestra "Unnamed". El `config.json` apunta `dataPath` a la carpeta
    /// temporal para que las tiendas portables (`SYNCED_SETTINGS`) se lean de
    /// ahí y no de la carpeta de datos real.
    #[test]
    fn instalacion_limpia_el_estilo_de_la_salida_existe() {
        let dir = temp_dir("instalacion-limpia");
        let portable_root = dir.join("data");
        fs::create_dir_all(&portable_root).expect("carpeta de datos");
        fs::write(
            dir.join("config.json"),
            format!(r#"{{"dataPath":"{}"}}"#, portable_root.display()),
        )
        .expect("config.json");

        let manager = StoreManager::new(dir.clone());

        let style_id = manager
            .get_value("SETTINGS", "outputs.default.style")
            .as_str()
            .unwrap_or("")
            .to_string();
        let style_name = manager.get_value("SYNCED_SETTINGS", "styles.default.name");

        assert!(
            !style_id.is_empty(),
            "la salida por defecto debe tener un estilo asignado"
        );
        assert_eq!(
            style_name.as_str().unwrap_or(""),
            "Default",
            "el estilo {style_id:?} de la salida debe existir y tener nombre"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}
