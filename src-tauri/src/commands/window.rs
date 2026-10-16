//! Comandos de ventana (dominio `WINDOW`).
//!
//! Traducción de los canales `Main.CLOSE`, `Main.MAXIMIZE`, `Main.MINIMIZE` y
//! `Main.FULLSCREEN` de `src/electron/IPC/responsesMain.ts`. En Electron se
//! operaba sobre `getMainWindow()`; aquí Tauri inyecta la `WebviewWindow` que
//! realizó la llamada.
//!
//! Los nombres de función coinciden deliberadamente con los canales del enum
//! `Main` para que `invoke("CLOSE")`, `invoke("MAXIMIZE")`, ... se resuelvan
//! 1:1 con el frontend existente.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use tauri::WebviewWindow;

/// Cierra la ventana actual (equivale a `Main.CLOSE`).
#[tauri::command]
pub fn CLOSE(window: WebviewWindow) -> AppResult<()> {
    window.close().map_err(AppError::from)
}

/// Maximiza la ventana actual (equivale a `Main.MAXIMIZE`).
#[tauri::command]
pub fn MAXIMIZE(window: WebviewWindow) -> AppResult<()> {
    window.maximize().map_err(AppError::from)
}

/// Minimiza la ventana actual (equivale a `Main.MINIMIZE`).
#[tauri::command]
pub fn MINIMIZE(window: WebviewWindow) -> AppResult<()> {
    window.minimize().map_err(AppError::from)
}

/// Alterna el modo pantalla completa y devuelve el nuevo estado
/// (equivale a `Main.FULLSCREEN`).
#[tauri::command]
pub fn FULLSCREEN(window: WebviewWindow) -> AppResult<bool> {
    let is_fullscreen = window.is_fullscreen().map_err(AppError::from)?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(AppError::from)?;
    Ok(!is_fullscreen)
}
