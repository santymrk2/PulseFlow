//! Comando de fuentes del sistema (F19). La lógica vive en `domain::fonts`.

#![allow(non_snake_case)]

use crate::domain::fonts::{installed_fonts, SystemFont};
use crate::error::{AppError, AppResult};

/// `spawn_blocking`: la primera llamada lee las fuentes del disco y no debe bloquear el runtime.
#[tauri::command]
pub async fn LIST_SYSTEM_FONTS() -> AppResult<Vec<SystemFont>> {
    tauri::async_runtime::spawn_blocking(|| installed_fonts().to_vec())
        .await
        .map_err(|e| AppError::new(e.to_string()))
}
