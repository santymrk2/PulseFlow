//! Comandos del dominio `STREAMING`.
//!
//! `FFMPEG_CHECK` usa el resolutor compartido (`utils::ffmpeg`) que busca el
//! binario junto al ejecutable (sidecar), en los recursos de la app, en la
//! carpeta `bin` de datos y, por último, en el `PATH`/rutas de sistema.

#![allow(non_snake_case)]

use crate::error::AppResult;
use crate::utils::ffmpeg;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct FfmpegCheck {
    pub installed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// `FFMPEG_CHECK`: devuelve si hay un FFmpeg usable y su ruta.
#[tauri::command]
pub async fn FFMPEG_CHECK(app: AppHandle) -> AppResult<FfmpegCheck> {
    let bin = ffmpeg::ffmpeg(&app);
    let available = ffmpeg::run(&bin, &["-version".to_string()])
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    if available {
        Ok(FfmpegCheck {
            installed: true,
            path: Some(bin.to_string_lossy().into_owned()),
        })
    } else {
        Ok(FfmpegCheck {
            installed: false,
            path: None,
        })
    }
}
