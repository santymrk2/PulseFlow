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

/// El frontend heredado de Electron compara contra `process.platform` ("win32", "darwin"); Rust usa "windows" y "macos".
fn node_platform(rust_os: &str) -> &str {
    match rust_os {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

/// Información del sistema operativo (equivale a `Main.GET_OS`).
#[tauri::command]
pub fn GET_OS() -> AppResult<OS> {
    let name = hostname::get()
        .map_err(AppError::from)?
        .to_string_lossy()
        .into_owned();

    Ok(OS {
        platform: node_platform(std::env::consts::OS).to_string(),
        name,
        arch: std::env::consts::ARCH.to_string(),
    })
}

/// Nivel y texto de una línea que manda el frontend (`"ERROR: …"`, `"WARN: …"`); sin prefijo es `info`.
fn parse_webview_line(text: &str) -> (log::Level, &str) {
    for (prefix, level) in [("ERROR: ", log::Level::Error), ("WARN: ", log::Level::Warn)] {
        if text.len() >= prefix.len() && text.is_char_boundary(prefix.len()) && text[..prefix.len()].eq_ignore_ascii_case(prefix) {
            return (level, &text[prefix.len()..]);
        }
    }
    (log::Level::Info, text)
}

/// Log del frontend (equivale a `Main.LOG`): `IPC/tauri.ts` reenvía aquí `console.warn`/`console.error`
/// y los errores sin capturar del webview, que quedan en el archivo de registro con su nivel (F13.3).
#[tauri::command]
pub fn LOG(data: Option<serde_json::Value>) {
    match data {
        Some(serde_json::Value::String(text)) => {
            let (level, message) = parse_webview_line(&text);
            log::log!(target: "webview", level, "{message}");
        }
        Some(value) => log::info!(target: "webview", "{value}"),
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
    if let Err(err) = app.opener().open_url(&data, None::<&str>) {
        log::warn!("No se pudo abrir {data}: {err}");
    }
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

#[cfg(test)]
mod log_tests {
    use super::*;
    use log::Level;

    #[test]
    fn the_webview_level_prefix_picks_the_log_level() {
        assert_eq!(parse_webview_line("ERROR: algo se rompió"), (Level::Error, "algo se rompió"));
        assert_eq!(parse_webview_line("WARN: cuidado"), (Level::Warn, "cuidado"));
        assert_eq!(parse_webview_line("error: en minúsculas"), (Level::Error, "en minúsculas"));
    }

    #[test]
    fn a_line_without_prefix_is_info_and_keeps_its_text() {
        assert_eq!(parse_webview_line("sin prefijo"), (Level::Info, "sin prefijo"));
        assert_eq!(parse_webview_line("ERRORES: no es un nivel"), (Level::Info, "ERRORES: no es un nivel"));
    }
}


#[cfg(test)]
mod platform_tests {
    use super::node_platform;

    #[test]
    fn maps_rust_os_names_to_node_platform_names() {
        assert_eq!(node_platform("windows"), "win32");
        assert_eq!(node_platform("macos"), "darwin");
    }
}
