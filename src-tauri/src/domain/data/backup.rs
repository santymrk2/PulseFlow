//! Copias de seguridad y restauración (`src/electron/data/backup.ts`).
//!
//! Empaqueta las tiendas portables, los shows y las biblias en un `.zip`, y
//! aplica la operación inversa. La lógica es independiente de Tauri: devuelve
//! los datos a emitir y las rutas, y la capa de comandos se encarga del IPC.

use super::store::StoreManager;
use super::zip::{self, EntrySource, ZipEntry};
use crate::error::{AppError, AppResult};
use crate::utils::files::{self, DataFolder};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Información de un backup (forma exacta que espera el frontend).
#[derive(Debug, Clone, Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub name: String,
    pub date: u64,
    pub size: u64,
}

/// Plan de backup listo para comprimir (contiene todo lo necesario, sin préstamos).
pub struct BackupPlan {
    pub entries: Vec<ZipEntry>,
    pub zip_path: PathBuf,
    pub backups_folder: PathBuf,
    pub is_auto: bool,
}

/// `getTimePointString`: `YYYY-MM-DD_HH-MM` en hora local.
pub fn time_point_string() -> String {
    chrono::Local::now().format("%Y-%m-%d_%H-%M").to_string()
}

/// Construye el plan de backup leyendo tiendas portables, shows y biblias.
pub fn build_plan(stores: &StoreManager, is_auto: bool) -> AppResult<BackupPlan> {
    let backups_folder = PathBuf::from(stores.get_data_folder_path(DataFolder::Backups, None));
    let folder_name = format!(
        "{}{}",
        time_point_string(),
        if is_auto { "_auto" } else { "" }
    );
    let zip_path = backups_folder.join(format!("{folder_name}.zip"));

    let mut entries: Vec<ZipEntry> = Vec::new();

    // Tiendas portables (contenido serializado en memoria).
    for id in stores.portable_store_ids() {
        let value = stores.get(&id);
        let content = serde_json::to_string(&value)?;
        entries.push(ZipEntry {
            name: format!("{id}.json"),
            source: EntrySource::Content(content),
        });
    }

    // Biblias (archivos `.fsb`), como `BIBLE_<nombre>`.
    let bibles_folder = stores.get_data_folder_path(DataFolder::Scriptures, None);
    if let Ok(names) = files::read_folder(&bibles_folder) {
        for name in names {
            let source_path = Path::new(&bibles_folder).join(&name);
            if source_path.is_file() {
                entries.push(ZipEntry {
                    name: format!("BIBLE_{name}"),
                    source: EntrySource::File(source_path),
                });
            }
        }
    }

    // Shows (`.show`), bajo `SHOWS/`.
    let shows_folder = stores.get_data_folder_path(DataFolder::Shows, None);
    if let Ok(names) = files::read_folder(&shows_folder) {
        for name in names {
            if !name.to_lowercase().ends_with(".show") {
                continue;
            }
            entries.push(ZipEntry {
                name: format!("SHOWS/{name}"),
                source: EntrySource::File(Path::new(&shows_folder).join(&name)),
            });
        }
    }

    Ok(BackupPlan {
        entries,
        zip_path,
        backups_folder,
        is_auto,
    })
}

/// Escribe el ZIP del plan. Devuelve la ruta del backup.
pub fn write_backup(plan: &BackupPlan) -> AppResult<String> {
    files::create_folder(&plan.backups_folder)?;
    zip::compress_to_zip(&plan.entries, &plan.zip_path)?;
    Ok(plan.zip_path.to_string_lossy().into_owned())
}

/// ctime (o fecha de modificación como reserva) en milisegundos.
fn ctime_ms(path: &Path) -> u64 {
    let Ok(meta) = std::fs::metadata(path) else {
        return 0;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let secs = meta.ctime();
        if secs >= 0 {
            return secs as u64 * 1000;
        }
    }
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// `getBackups`: lista los backups (`.zip` o carpetas antiguas).
pub fn get_backups(stores: &StoreManager) -> Vec<BackupInfo> {
    let backups_folder = stores.get_data_folder_path(DataFolder::Backups, None);
    let mut backups = Vec::new();

    let Ok(names) = files::read_folder(&backups_folder) else {
        return backups;
    };

    for name in names {
        let file_path = Path::new(&backups_folder).join(&name);
        let Ok(meta) = std::fs::metadata(&file_path) else {
            continue;
        };

        if name.ends_with(".zip") {
            backups.push(BackupInfo {
                path: file_path.to_string_lossy().into_owned(),
                name: name.trim_end_matches(".zip").to_string(),
                date: ctime_ms(&file_path),
                size: meta.len(),
            });
        } else if meta.is_dir() {
            let mut size = 0u64;
            if let Ok(entries) = files::read_folder(&file_path) {
                for entry in entries {
                    if let Ok(m) = std::fs::metadata(file_path.join(&entry)) {
                        size += m.len();
                    }
                }
            }
            if size > 0 {
                backups.push(BackupInfo {
                    path: file_path.to_string_lossy().into_owned(),
                    name,
                    date: ctime_ms(&file_path),
                    size,
                });
            }
        }
    }

    backups
}

/// `deleteBackup`: elimina un backup (archivo o carpeta) por ruta.
pub fn delete_backup(stores: &StoreManager, path: &str) {
    let backups_folder = stores.get_data_folder_path(DataFolder::Backups, None);
    let full = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        Path::new(&backups_folder).join(path)
    };

    if full.is_dir() {
        let _ = std::fs::remove_dir_all(&full);
    } else {
        let _ = std::fs::remove_file(&full);
    }
}

/// Elimina backups automáticos antiguos (`pruneAutoBackups`).
pub fn prune_auto_backups(stores: &StoreManager, ignore_implementation_date: bool) {
    let mut auto_backups: Vec<BackupInfo> = get_backups(stores)
        .into_iter()
        .filter(|b| b.name.ends_with("_auto"))
        .collect();
    auto_backups.sort_by_key(|b| b.date);

    let count = auto_backups.len();
    if count <= 10 {
        return;
    }

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    // ~5 meses en milisegundos.
    let cutoff_time = now_ms.saturating_sub(150 * 24 * 60 * 60 * 1000);
    // Fecha piso: no borrar nada anterior a la implantación del sistema.
    let safety_floor = 1_774_051_200_000u64; // 2026-03-20T00:00:00Z

    for (index, backup) in auto_backups.iter().enumerate() {
        if index < 3 {
            continue;
        }
        if index >= count - 10 {
            continue;
        }
        if !ignore_implementation_date && backup.date < safety_floor {
            continue;
        }
        if backup.date < cutoff_time {
            delete_backup(stores, &backup.path);
        }
    }
}

/// Restaura desde un `.zip` (o carpeta antigua). Devuelve `(canal, valor)` a
/// emitir en el frontend por cada tienda restaurada.
pub fn restore_files(stores: &mut StoreManager, path: &str) -> AppResult<Vec<(String, Value)>> {
    let mut emissions: Vec<(String, Value)> = Vec::new();

    let files_to_restore: Vec<(String, String)> = if path.to_lowercase().ends_with(".zip") {
        zip::decompress_zip(Path::new(path))?
    } else {
        // Carpeta antigua: cada archivo es una entrada.
        let mut out = Vec::new();
        if let Ok(names) = files::read_folder(path) {
            for name in names {
                let content = files::read_file(Path::new(path).join(&name)).unwrap_or_default();
                out.push((name, content));
            }
        }
        out
    };

    if files_to_restore.is_empty() {
        return Ok(emissions);
    }

    let shows_folder = stores.get_data_folder_path(DataFolder::Shows, None);
    let bibles_folder = stores.get_data_folder_path(DataFolder::Scriptures, None);
    let portable_ids = stores.portable_store_ids();

    for (name, content) in files_to_restore {
        if content.is_empty() {
            continue;
        }

        if let Some(show_name) = name.strip_prefix("SHOWS/") {
            files::create_folder(&shows_folder)?;
            files::write_file(Path::new(&shows_folder).join(show_name), &content)?;
            continue;
        }

        if let Some(bible_name) = name.strip_prefix("BIBLE_") {
            files::create_folder(&bibles_folder)?;
            files::write_file(Path::new(&bibles_folder).join(bible_name), &content)?;
            continue;
        }

        let Ok(value) = serde_json::from_str::<Value>(&content) else {
            continue;
        };

        if name.contains("SETTINGS") {
            if let Value::Object(mut map) = value {
                map.remove("dataPath");
                map.remove("showsPath");
                let cleaned = Value::Object(map);
                stores.set("SETTINGS", cleaned.clone())?;
                emissions.push(("SETTINGS".to_string(), cleaned));
            }
            continue;
        }

        if let Some(store_id) = portable_ids.iter().find(|id| name.contains(id.as_str())) {
            stores.set(store_id, value.clone())?;
            emissions.push((store_id.clone(), value));
        }
    }

    Ok(emissions)
}

/// Error de restauración con contexto.
pub fn invalid_restore() -> AppError {
    AppError::new("No se pudo restaurar: archivo inválido")
}
