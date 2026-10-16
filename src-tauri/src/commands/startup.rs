//! Comandos de arranque (dominio `STARTUP`).
//!
//! Traducción del handshake de Electron en `src/electron/index.ts`:
//!
//! ```ts
//! window.webContents.ipc.on(STARTUP, (_event, msg) => {
//!     if (msg?.channel === "READY") {
//!         window.webContents.send(STARTUP, { channel: "TYPE", data: type, autoProfile })
//!     }
//! })
//! ```
//!
//! El frontend (`src/frontend/utils/startup.ts`) registra un receptor en el canal
//! `STARTUP` y envía `STARTUP { channel: "READY" }`. Aquí `window.api.send` se
//! traduce a `invoke("READY", ...)`, de modo que el comando `READY` responde
//! emitiendo el evento `STARTUP { channel: "TYPE", data, autoProfile }` a la
//! ventana que lo solicitó.
//!
//! La carga de las tiendas (`SETTINGS`, `SHOWS`, ...) **no** requiere push: el
//! frontend las pide con `sendMain(...)` y el puente las resuelve vía `invoke`
//! (ver `src/frontend/IPC/tauri.ts`), aplicándolas en `receiveMainGlobal`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use serde::Serialize;
use tauri::{Emitter, WebviewWindow};

/// Payload del evento `STARTUP` que espera el frontend.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupType {
    /// Sub-canal del evento (`"TYPE"`).
    pub channel: &'static str,
    /// Tipo de ventana: `null` (principal) o `"pdf"`.
    pub data: Option<&'static str>,
    /// Perfil a abrir automáticamente al arrancar (vacío = último usado).
    pub auto_profile: &'static str,
}

/// Deriva el tipo de ventana a partir de su etiqueta (`label`).
///
/// La ventana principal usa la etiqueta por defecto (`"main"`) y corresponde al
/// tipo `null`; la ventana de exportación PDF se identifica por
/// su etiqueta. Las salidas (audiencia/stage) son ventanas nativas sin webview y no pasan por aquí.
fn window_type(label: &str) -> Option<&'static str> {
    match label {
        "pdf" => Some("pdf"),
        _ => None,
    }
}

/// `READY`: el frontend avisa que está listo para recibir su tipo de ventana.
///
/// Equivale al `ipc.on(STARTUP, ...)` de Electron. Responde emitiendo el evento
/// `STARTUP` (`channel: "TYPE"`) solo a la ventana solicitante.
#[tauri::command]
pub fn READY(window: WebviewWindow) -> AppResult<()> {
    let startup = StartupType {
        channel: "TYPE",
        data: window_type(window.label()),
        auto_profile: "",
    };

    window.emit("STARTUP", startup).map_err(AppError::from)
}
