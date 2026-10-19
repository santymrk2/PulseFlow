//! Utilidades básicas de archivos y rutas para la capa de persistencia y comandos.
//!
//! Esta es una adaptación incremental de `src/electron/utils/files.ts` a Rust.
//! Prioriza la funcionalidad real necesaria para `stores`, evitando `unwrap()`
//! conforme a la regla del proyecto.

use crate::error::{AppError, AppResult};
use std::fs;
use std::path::{Path, PathBuf};

/// Nombres de carpetas de datos (equivalente a `dataFolderNames` en TS).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DataFolder {
    Shows,
    Backups,
    Scriptures,
    OnlineMedia,
    Media,
    Exports,
    Imports,
    Lessons,
    PlanningCenter,
    Recordings,
    Audio,
    UserData,
    Cloud,
}

impl DataFolder {
    pub fn name(&self) -> &'static str {
        match self {
            DataFolder::Shows => "Shows",
            DataFolder::Backups => "Backups",
            DataFolder::Scriptures => "Bibles",
            DataFolder::OnlineMedia => "Online",
            DataFolder::Media => "Media",
            DataFolder::Exports => "Exports",
            DataFolder::Imports => "Imports",
            DataFolder::Lessons => "Lessons",
            DataFolder::PlanningCenter => "Planning Center",
            DataFolder::Recordings => "Recordings",
            DataFolder::Audio => "Audio",
            DataFolder::UserData => "Config",
            DataFolder::Cloud => "Cloud",
        }
    }
}

/// Devuelve `true` si la ruta existe.
pub fn does_path_exist<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref().exists()
}

/// Lee un archivo como string (UTF-8 por defecto).
pub fn read_file<P: AsRef<Path>>(path: P) -> AppResult<String> {
    let p = path.as_ref();
    let bytes = fs::read(p)?;
    Ok(String::from_utf8(bytes).unwrap_or_default())
}

/// Escribe un archivo con contenido de forma **atómica** (F3.1).
///
/// Primero vuelca los bytes a un archivo temporal en la misma carpeta y luego
/// lo renombra sobre el destino. Así un fallo a mitad de escritura (disco lleno,
/// permisos, corte de energía) nunca deja el archivo original truncado: o se
/// escribe completo, o queda el original.
pub fn write_file<P: AsRef<Path>>(path: P, content: &str) -> AppResult<()> {
    let p = path.as_ref();
    let file_name = p
        .file_name()
        .ok_or_else(|| AppError::new(format!("Ruta sin nombre de archivo: {}", p.display())))?;

    let mut tmp_name = file_name.to_os_string();
    tmp_name.push(".tmp");
    let tmp = p.with_file_name(tmp_name);

    if let Err(err) = fs::write(&tmp, content.as_bytes()) {
        let _ = fs::remove_file(&tmp);
        return Err(AppError::new(format!(
            "No se pudo escribir {}: {err}",
            p.display()
        )));
    }

    if let Err(err) = fs::rename(&tmp, p) {
        let _ = fs::remove_file(&tmp);
        return Err(AppError::new(format!(
            "No se pudo guardar {}: {err}",
            p.display()
        )));
    }

    Ok(())
}

/// Lista el contenido de un directorio.
pub fn read_folder<P: AsRef<Path>>(path: P) -> AppResult<Vec<String>> {
    let p = path.as_ref();
    let mut entries = Vec::new();
    for entry in fs::read_dir(p)? {
        if let Ok(entry) = entry {
            if let Ok(file_name) = entry.file_name().into_string() {
                entries.push(file_name);
            }
        }
    }
    Ok(entries)
}

/// Elimina un archivo.
pub fn delete_file<P: AsRef<Path>>(path: P) -> AppResult<()> {
    let p = path.as_ref();
    let _ = fs::remove_file(p);
    Ok(())
}

/// Crea un directorio recursivamente y devuelve la ruta.
pub fn create_folder<P: AsRef<Path>>(path: P) -> AppResult<PathBuf> {
    let p = path.as_ref();
    fs::create_dir_all(p)?;
    Ok(p.to_path_buf())
}

/// Comprueba si la ruta es escribible.
pub fn is_writable<P: AsRef<Path>>(path: P) -> bool {
    if !does_path_exist(&path) {
        if let Some(parent) = path.as_ref().parent() {
            return is_writable(parent);
        }
        return false;
    }
    let p = path.as_ref();
    if p.is_dir() {
        let tmp = p.join(".__tauri_app_writable_check__");
        match fs::write(&tmp, b"ok") {
            Ok(_) => {
                let _ = fs::remove_file(tmp);
                true
            }
            Err(_) => false,
        }
    } else {
        match fs::OpenOptions::new().append(true).open(p) {
            Ok(_) => true,
            Err(_) => false,
        }
    }
}

/// Obtiene la extensión del archivo (minúscula).
pub fn get_extension<P: AsRef<Path>>(path: P) -> String {
    let p = path.as_ref();
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}

/// Devuelve estadísticas del archivo (simple).
pub fn get_file_stats<P: AsRef<Path>>(path: P) -> AppResult<FileStats> {
    let p = path.as_ref();
    let meta = fs::metadata(p)?;
    Ok(FileStats {
        path: p.to_path_buf(),
        is_dir: meta.is_dir(),
        len: meta.len(),
        extension: get_extension(p),
    })
}

#[derive(Debug, Clone)]
pub struct FileStats {
    pub path: PathBuf,
    pub is_dir: bool,
    pub len: u64,
    pub extension: String,
}

/// Información del archivo para comandos FILE_INFO.
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileInfo {
    pub path: String,
    pub stat: FileInfoStat,
    pub extension: String,
    pub folder: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[allow(non_snake_case)]
pub struct FileInfoStat {
    pub size: u64,
    pub isFile: bool,
    pub isDirectory: bool,
    pub isSymbolicLink: bool,
    pub atimeMs: Option<u64>,
    pub mtimeMs: Option<u64>,
    pub ctimeMs: Option<u64>,
    pub birthtimeMs: Option<u64>,
}

/// Obtiene información del archivo en formato compatible con Electron's stats.
pub fn get_file_info<P: AsRef<Path>>(path: P) -> AppResult<FileInfo> {
    let p = path.as_ref();
    let meta = fs::metadata(p)?;
    let modified = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
    let accessed = meta.accessed().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
    let created = meta.created().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());

    Ok(FileInfo {
        path: p.to_string_lossy().into_owned(),
        extension: get_extension(p),
        folder: meta.is_dir(),
        stat: FileInfoStat {
            size: meta.len(),
            isFile: meta.is_file(),
            isDirectory: meta.is_dir(),
            isSymbolicLink: meta.file_type().is_symlink(),
            atimeMs: accessed.map(|d| d.as_millis() as u64),
            mtimeMs: modified.map(|d| d.as_millis() as u64),
            ctimeMs: None,
            birthtimeMs: created.map(|d| d.as_millis() as u64),
        },
    })
}

/// Obtiene rutas de carpetas base típicas (documents/pictures/videos/music).
pub fn get_media_folder_path(base: &str) -> AppResult<PathBuf> {
    match base {
        "documents" | "pictures" | "videos" | "music" | "downloads" | "home" | "desktop" => {
            match base {
                "home" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home));
                    }
                    if let Ok(home) = std::env::var("USERPROFILE") {
                        return Ok(PathBuf::from(home));
                    }
                }
                "documents" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Documents"));
                    }
                    if let Ok(doc) = std::env::var("DOCUMENTS") {
                        return Ok(PathBuf::from(doc));
                    }
                }
                "downloads" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Downloads"));
                    }
                }
                "desktop" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Desktop"));
                    }
                }
                "pictures" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Pictures"));
                    }
                }
                "videos" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Movies"));
                    }
                }
                "music" => {
                    if let Ok(home) = std::env::var("HOME") {
                        return Ok(PathBuf::from(home).join("Music"));
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
    // Fallback
    let temp = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    Ok(temp)
}

/// Sanitiza nombre de archivo.
pub fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .filter(|c| !c.is_control() && *c != '<' && *c != '>' && *c != ':' && *c != '\"' && *c != '/' && *c != '\\' && *c != '|' && *c != '?' && *c != '*')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(|c: char| c == '.' || c.is_whitespace())
        .to_string()
}

/// Valida/corrige nombre de archivo.
pub fn get_valid_file_name(name: &str) -> String {
    sanitize_file_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Carpeta temporal limpia para un test (los nombres no se solapan entre
    /// tests, que corren en paralelo).
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pulseflow-files-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("carpeta temporal");
        dir
    }

    /// Nombres de archivo que quedan en la carpeta (para detectar temporales
    /// abandonados).
    fn file_names(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .expect("leer carpeta")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn write_file_escribe_y_no_deja_archivos_temporales() {
        let dir = temp_dir("atomico");
        let path = dir.join("data.json");

        write_file(&path, "{\"a\":1}").expect("primera escritura");
        assert_eq!(fs::read_to_string(&path).expect("leer"), "{\"a\":1}");

        // Reescribe por encima: el temporal debe quedar renombrado, no suelto.
        write_file(&path, "{\"a\":2}").expect("reescritura");
        assert_eq!(fs::read_to_string(&path).expect("leer"), "{\"a\":2}");
        assert_eq!(file_names(&dir), vec!["data.json".to_string()]);

        let _ = fs::remove_dir_all(&dir);
    }

    /// Carpeta de sólo lectura: la escritura falla antes de tocar el destino
    /// y el archivo original queda intacto (F3.1).
    #[cfg(unix)]
    #[test]
    fn write_file_en_carpeta_sin_permisos_falla_y_conserva_el_original() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("sin-permisos");
        let path = dir.join("data.json");
        fs::write(&path, "original").expect("archivo original");

        fs::set_permissions(&dir, fs::Permissions::from_mode(0o555)).expect("chmod 555");
        let result = write_file(&path, "nuevo");
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).expect("chmod 755");

        assert!(result.is_err(), "debe devolver error en una carpeta sin permisos");
        assert!(
            result.unwrap_err().message().contains("data.json"),
            "el error debe indicar el archivo que falló"
        );
        assert_eq!(fs::read_to_string(&path).expect("leer original"), "original");
        assert_eq!(file_names(&dir), vec!["data.json".to_string()], "no debe quedar ningún temporal");

        let _ = fs::remove_dir_all(&dir);
    }

    /// En Windows no hay chmod de carpeta equivalente: se simula un destino
    /// no escribible con una carpeta donde debería ir el archivo. El renombre
    /// atómico falla y el original (la carpeta) queda intacto.
    #[cfg(windows)]
    #[test]
    fn write_file_en_destino_no_escribible_falla_y_conserva_el_original() {
        let dir = temp_dir("no-escribible");
        let path = dir.join("data.json");
        fs::create_dir(&path).expect("destino no escribible");
        fs::write(path.join("dentro.txt"), "original").expect("contenido original");

        let result = write_file(&path, "nuevo");

        assert!(result.is_err(), "debe devolver error en un destino no escribible");
        assert_eq!(
            fs::read_to_string(path.join("dentro.txt")).expect("leer original"),
            "original"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}
