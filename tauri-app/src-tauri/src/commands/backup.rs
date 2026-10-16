//! Comandos del dominio de copias de seguridad (`BACKUPS`, `DELETE_BACKUP`,
//! `RESTORE`) y el disparador de backup usado por `SAVE`.

#![allow(non_snake_case)]

use crate::domain::data::backup::{self, BackupInfo, BackupPlan};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// `BACKUPS`: lista las copias de seguridad disponibles.
#[tauri::command]
pub fn BACKUPS(state: State<'_, AppState>) -> AppResult<Vec<BackupInfo>> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    Ok(backup::get_backups(&stores))
}

#[derive(Deserialize)]
pub struct DeleteBackupData {
    pub path: String,
}

/// `DELETE_BACKUP`: elimina un backup concreto.
#[tauri::command]
pub fn DELETE_BACKUP(state: State<'_, AppState>, data: DeleteBackupData) -> AppResult<()> {
    let stores = state
        .stores
        .lock()
        .map_err(|_| AppError::new("Store manager lock poisoned"))?;
    backup::delete_backup(&stores, &data.path);
    Ok(())
}

#[derive(Deserialize)]
pub struct RestoreData {
    #[serde(default)]
    pub path: Option<String>,
}

/// `RESTORE`: restaura una copia de seguridad (por ruta o eligiéndola en el
/// diálogo nativo) y emite los cambios al frontend.
#[tauri::command]
pub async fn RESTORE(
    app: AppHandle,
    state: State<'_, AppState>,
    data: Option<RestoreData>,
) -> AppResult<()> {
    let chosen = match data.and_then(|d| d.path) {
        Some(path) if !path.is_empty() => Some(path),
        _ => pick_backup_file(&app).await?,
    };

    let Some(path) = chosen else {
        emit_restore(&app, json!({ "finished": false }));
        return Ok(());
    };

    emit_restore(&app, json!({ "starting": true }));

    let emissions = {
        let mut stores = state
            .stores
            .lock()
            .map_err(|_| AppError::new("Store manager lock poisoned"))?;
        match backup::restore_files(&mut stores, &path) {
            Ok(emissions) => emissions,
            Err(_) => {
                emit_restore(&app, json!({ "finished": false }));
                return Ok(());
            }
        }
    };

    for (channel, value) in emissions {
        let _ = app.emit("MAIN", json!({ "channel": channel, "data": value }));
    }

    emit_restore(&app, json!({ "finished": true }));
    Ok(())
}

async fn pick_backup_file(app: &AppHandle) -> AppResult<Option<String>> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    app.dialog()
        .file()
        .add_filter("FreeShow Backup Files", &["json", "zip"])
        .pick_file(move |selected| {
            let _ = tx.send(selected.map(|p| p.to_string()));
        });
    rx.await.map_err(|_| AppError::new("File dialog cancelled"))
}

fn emit_restore(app: &AppHandle, data: serde_json::Value) {
    let _ = app.emit("MAIN", json!({ "channel": "RESTORE2", "data": data }));
}

fn emit_backup(app: &AppHandle, finished: bool, path: &str) {
    let _ = app.emit(
        "MAIN",
        json!({ "channel": "BACKUP", "data": { "finished": finished, "path": path } }),
    );
}

/// Lanza en segundo plano la creación del backup descrito por `plan`.
///
/// Al terminar emite `ToMain.BACKUP` y, si no es automático, abre la carpeta.
pub fn spawn_backup(app: AppHandle, plan: BackupPlan) {
    tauri::async_runtime::spawn_blocking(move || {
        let path = match backup::write_backup(&plan) {
            Ok(path) => path,
            Err(_) => {
                emit_backup(&app, false, "");
                return;
            }
        };

        emit_backup(&app, true, &path);

        if plan.is_auto {
            if let Ok(stores) = app.state::<AppState>().stores.lock() {
                backup::prune_auto_backups(&stores, false);
            }
        } else {
            let _ = app.opener().open_path(path, None::<&str>);
        }
    });
}
