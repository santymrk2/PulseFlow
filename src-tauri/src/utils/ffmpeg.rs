//! Resolución e invocación de binarios multimedia (FFmpeg / FFprobe).
//!
//! Reemplaza `resolveFfmpegPath`/`execFileAsync(ffmpegPath, …)` de la versión
//! Electron (`src/electron/streaming/*`).
//!
//! La lógica de resolución está preparada para binarios empaquetados como
//! *sidecars* de Tauri: se buscan primero junto al ejecutable y en el directorio
//! de recursos, y si no aparecen se recurre al `PATH` del sistema. Se evita
//! `unwrap()`/`expect()` conforme a las reglas del proyecto; cualquier fallo se
//! propaga como `AppError`.

use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};
use std::process::Output;
use tauri::{AppHandle, Manager};

/// Devuelve el nombre del ejecutable según la plataforma.
pub fn bin_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

/// Rutas habituales donde puede encontrarse FFmpeg según el sistema operativo.
fn system_candidates(base: &str) -> Vec<PathBuf> {
    let name = bin_name(base);
    let mut candidates: Vec<PathBuf> = Vec::new();

    if cfg!(windows) {
        candidates.push(PathBuf::from(format!("C:\\ffmpeg\\bin\\{name}")));
        candidates.push(PathBuf::from(format!(
            "C:\\Program Files\\ffmpeg\\bin\\{name}"
        )));
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                PathBuf::from(local)
                    .join("Programs")
                    .join("ffmpeg")
                    .join("bin")
                    .join(&name),
            );
        }
    } else if cfg!(target_os = "macos") {
        candidates.push(PathBuf::from(format!("/opt/homebrew/bin/{name}")));
        candidates.push(PathBuf::from(format!("/usr/local/bin/{name}")));
        candidates.push(PathBuf::from(format!("/opt/local/bin/{name}")));
        candidates.push(PathBuf::from(format!("/usr/bin/{name}")));
    } else {
        candidates.push(PathBuf::from(format!("/usr/bin/{name}")));
        candidates.push(PathBuf::from(format!("/usr/local/bin/{name}")));
        candidates.push(PathBuf::from(format!("/snap/bin/{name}")));
    }

    candidates
}

/// Resuelve la ruta del binario `base` (`ffmpeg`/`ffprobe`).
///
/// Orden de búsqueda: directorio del ejecutable (sidecar) → recursos de la app →
/// carpetas `bin` de datos de la app → rutas del sistema. Si no se encuentra
/// ninguna, devuelve el nombre "pelado" para que el SO lo resuelva vía `PATH`.
pub fn resolve(app: &AppHandle, base: &str) -> PathBuf {
    let name = bin_name(base);
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(&name));
            candidates.push(dir.join("bin").join(&name));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(&name));
        candidates.push(resource_dir.join("bin").join(&name));
    }
    if let Ok(data_dir) = app.path().app_data_dir() {
        candidates.push(data_dir.join("bin").join(&name));
    }

    candidates.extend(system_candidates(base));

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from(name)
}

/// Resuelve `ffmpeg`.
pub fn ffmpeg(app: &AppHandle) -> PathBuf {
    resolve(app, "ffmpeg")
}

/// Resuelve `ffprobe`.
pub fn ffprobe(app: &AppHandle) -> PathBuf {
    resolve(app, "ffprobe")
}

/// Ejecuta un binario multimedia con los argumentos dados y devuelve la salida.
pub async fn run(bin: &Path, args: &[String]) -> AppResult<Output> {
    let output = tokio::process::Command::new(bin)
        .args(args)
        .output()
        .await
        .map_err(|e| AppError::new(format!("No se pudo ejecutar {}: {e}", bin.display())))?;
    Ok(output)
}

/// Ejecuta un binario y devuelve `stdout` como `String`.
pub async fn run_capture(bin: &Path, args: &[String]) -> AppResult<String> {
    let output = run(bin, args).await?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(format!(
            "El proceso terminó con error ({}): {}",
            output.status,
            stderr.trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Comprueba si `base` está disponible en el sistema.
pub async fn is_available(app: &AppHandle, base: &str) -> bool {
    let bin = resolve(app, base);
    run(&bin, &["-version".to_string()])
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Comprueba si FFmpeg está disponible (equivalente a `FFMPEG_CHECK`).
pub async fn ffmpeg_available(app: &AppHandle) -> bool {
    is_available(app, "ffmpeg").await
}

/// Ejecuta `ffprobe` sobre `path` y devuelve las secciones `streams`/`format`
/// ya parseadas como JSON.
pub async fn probe(app: &AppHandle, path: &str) -> AppResult<serde_json::Value> {
    let bin = ffprobe(app);
    let args: Vec<String> = vec![
        "-v".into(),
        "quiet".into(),
        "-print_format".into(),
        "json".into(),
        "-show_format".into(),
        "-show_streams".into(),
        path.into(),
    ];
    let stdout = run_capture(&bin, &args).await?;
    let value: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| AppError::new(format!("Salida JSON de ffprobe inválida: {e}")))?;
    Ok(value)
}
