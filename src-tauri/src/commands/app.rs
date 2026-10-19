//! Comandos estáticos de la aplicación (dominio `APP`).
//!
//! Traducción de los canales `Main.VERSION`, `Main.IS_DEV` y `Main.GET_OS`
//! de `src/electron/IPC/responsesMain.ts`.
//!
//! Los nombres de función coinciden con los canales del enum `Main`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::types::main::OS;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// Versión de la aplicación (equivale a `Main.VERSION` → `app.getVersion()`).
#[tauri::command]
pub fn VERSION(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Indica si la app corre en modo desarrollo (equivale a `Main.IS_DEV`).
#[tauri::command]
pub fn IS_DEV() -> bool {
    cfg!(debug_assertions)
}

/// Información del sistema operativo (equivale a `Main.GET_OS`).
#[tauri::command]
pub fn GET_OS() -> AppResult<OS> {
    let name = hostname::get()
        .map_err(AppError::from)?
        .to_string_lossy()
        .into_owned();

    Ok(OS {
        platform: std::env::consts::OS.to_string(),
        name,
        arch: std::env::consts::ARCH.to_string(),
    })
}

/// Log del frontend (equivale a `Main.LOG`): imprime en la terminal de Tauri.
/// En desarrollo, `IPC/tauri.ts` reenvía aquí `console.warn`/`console.error`
/// del webview para poder verlos sin abrir el inspector.
#[tauri::command]
pub fn LOG(data: Option<serde_json::Value>) {
    match data {
        Some(serde_json::Value::String(text)) => eprintln!("[webview] {text}"),
        Some(value) => eprintln!("[webview] {value}"),
        None => {}
    }
}

/// `URL`: abre una URL (o un esquema del sistema) en el navegador/aplicación
/// predeterminada del sistema (equivale a `Main.URL`).
#[tauri::command]
pub fn URL(app: AppHandle, data: String) -> AppResult<()> {
    if data.trim().is_empty() {
        return Ok(());
    }
    let _ = app.opener().open_url(data, None::<&str>);
    Ok(())
}

/// `IP`: direcciones IP locales del equipo (equivale a `Main.IP`).
#[tauri::command]
pub fn IP() -> Vec<String> {
    let mut ips = Vec::new();
    // Truco estándar: conectar un socket UDP a una dirección pública (sin enviar
    // datos) y leer la dirección local asignada por el SO.
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if !ip.is_empty() && ip != "0.0.0.0" {
                    ips.push(ip);
                }
            }
        }
    }
    if ips.is_empty() {
        ips.push("localhost".to_string());
    }
    ips
}
