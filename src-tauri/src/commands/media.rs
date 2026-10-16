//! Comandos del dominio `MEDIA` (miniaturas, existencia, códecs y EXIF).
//!
//! Traducción parcial de `src/electron/data/thumbnails.ts` y de las funciones de
//! medios de `src/electron/utils/files.ts`.
//!
//! - `DOES_MEDIA_EXIST` y `GET_THUMBNAIL`: se conserva el esquema de caché por
//!   hash de ruta (`filePathHashCode`) y la invalidación por fecha.
//! - La generación de miniaturas de **imágenes** usa el crate `image`; la de
//!   **vídeo** y formatos exóticos (HEIC/AVIF) usa **FFmpeg** (sidecar/sistema).
//! - `MEDIA_CODEC`, `MEDIA_TRACKS` y `READ_AUDIO_METADATA` usan **ffprobe**/
//!   **FFmpeg** para códecs, subtítulos embebidos y etiquetas ReplayGain.
//! - `READ_EXIF`: usa el crate `kamadak-exif`, agrupando los campos por contexto
//!   (`image`, `exif`, `gps`, `interoperability`) para acercarse al paquete npm
//!   `exif`.

#![allow(non_snake_case)]

use crate::commands::files::thumbnail_folder;
use crate::error::{AppError, AppResult};
use crate::utils::ffmpeg;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const THUMBNAIL_SIZES: [u32; 4] = [900, 500, 250, 100];

/// Extensiones que el crate `image` puede abrir con las features habilitadas.
const GENERATABLE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif"];

/// Extensiones de vídeo/audio con flujo de imagen extraíble mediante FFmpeg.
const FFMPEG_VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "m4v", "webm", "ogv", "mov", "avi", "mkv", "flv", "mpeg", "mpg", "wmv", "3gp", "3g2",
];

/// Formatos de imagen que `image` no soporta pero FFmpeg sí.
const FFMPEG_IMAGE_EXTENSIONS: &[&str] = &["heic", "heif", "avif"];

/// `filePathHashCode` de `thumbnails.ts` (hash de 32 bits con desplazamiento).
fn file_path_hash_code(s: &str) -> String {
    let mut hash: i32 = 0;
    for code_unit in s.encode_utf16() {
        hash = hash.wrapping_shl(5).wrapping_sub(hash).wrapping_add(code_unit as i32);
    }
    if hash < 0 {
        let digits = hash.to_string();
        format!("i{}", &digits[1..])
    } else {
        format!("a{hash}")
    }
}

fn thumbnail_path(folder: &Path, input: &str, size: u32) -> PathBuf {
    folder.join(format!("{}-{}.png", file_path_hash_code(input), size))
}

fn delete_thumbnails(folder: &Path, input: &str) {
    for size in THUMBNAIL_SIZES {
        let _ = fs::remove_file(thumbnail_path(folder, input, size));
    }
}

fn mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// `ctimeMs`: en Unix se usa `st_ctime`; en el resto, la fecha de creación.
fn ctime_ms(meta: &fs::Metadata) -> Option<u64> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let secs = meta.ctime();
        if secs < 0 {
            return None;
        }
        Some(secs as u64 * 1000)
    }
    #[cfg(not(unix))]
    {
        meta.created()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
    }
}

// ---------------------------------------------------------------------------
// DOES_MEDIA_EXIST
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DoesMediaExistData {
    pub path: String,
    #[serde(default)]
    pub creation_time: Option<i64>,
    #[serde(default)]
    pub no_cache: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoesMediaExistResult {
    pub path: String,
    pub exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creation_time: Option<u64>,
}

/// `DOES_MEDIA_EXIST`: comprueba que el archivo exista y que su cache siga vigente.
#[tauri::command]
pub fn DOES_MEDIA_EXIST(app: AppHandle, data: DoesMediaExistData) -> AppResult<DoesMediaExistResult> {
    let folder = thumbnail_folder(&app)?;
    let path = PathBuf::from(&data.path);

    let meta = match fs::metadata(&path) {
        Ok(m) => m,
        Err(_) => {
            delete_thumbnails(&folder, &data.path);
            return Ok(DoesMediaExistResult {
                path: data.path,
                exists: false,
                creation_time: None,
            });
        }
    };

    if data.no_cache.unwrap_or(false) {
        return Ok(DoesMediaExistResult {
            path: data.path,
            exists: true,
            creation_time: None,
        });
    }

    let creation_time = ctime_ms(&meta);
    if let (Some(expected), Some(actual)) = (data.creation_time, creation_time) {
        if expected as u64 != actual {
            delete_thumbnails(&folder, &data.path);
            return Ok(DoesMediaExistResult {
                path: data.path,
                exists: false,
                creation_time: None,
            });
        }
    }

    Ok(DoesMediaExistResult {
        path: data.path,
        exists: true,
        creation_time,
    })
}

// ---------------------------------------------------------------------------
// GET_THUMBNAIL
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct GetThumbnailData {
    pub input: String,
    #[serde(default)]
    pub size: Option<u32>,
}

#[derive(Serialize)]
pub struct GetThumbnailResult {
    pub input: String,
    pub size: u32,
    pub output: String,
}

/// `GET_THUMBNAIL`: devuelve (y si hace falta genera) la miniatura de un medio.
///
/// Imágenes: crate `image`. Vídeo y formatos exóticos (HEIC/AVIF): FFmpeg
/// (sidecar/sistema). El esquema de caché por hash de ruta se mantiene igual.
#[tauri::command]
pub async fn GET_THUMBNAIL(app: AppHandle, data: GetThumbnailData) -> AppResult<GetThumbnailResult> {
    let folder = thumbnail_folder(&app)?;
    let size = match data.size {
        Some(s) if s > 0 => s,
        _ => 500,
    };
    let input = data.input;

    let input_path = Path::new(&input);
    if !input_path.is_file() {
        return Ok(GetThumbnailResult {
            input,
            size,
            output: String::new(),
        });
    }

    let output_path = thumbnail_path(&folder, &input, size);
    if output_path.is_file() {
        if mtime_ms(input_path) <= mtime_ms(&output_path) {
            return Ok(GetThumbnailResult {
                input,
                size,
                output: output_path.to_string_lossy().into_owned(),
            });
        }
        // La fuente es más nueva: se descarta la miniatura antigua.
        let _ = fs::remove_file(&output_path);
    }

    let extension = input_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    let generated = if GENERATABLE_EXTENSIONS.contains(&extension.as_str()) {
        generate_image_thumbnail(input_path, &output_path, size).is_ok()
    } else if FFMPEG_VIDEO_EXTENSIONS.contains(&extension.as_str()) {
        generate_ffmpeg_thumbnail(&app, input_path, &output_path, size)
            .await
            .is_ok()
    } else if FFMPEG_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        generate_ffmpeg_thumbnail(&app, input_path, &output_path, size)
            .await
            .is_ok()
    } else {
        false
    };

    Ok(GetThumbnailResult {
        input,
        size,
        output: if generated {
            output_path.to_string_lossy().into_owned()
        } else {
            String::new()
        },
    })
}

fn generate_image_thumbnail(input: &Path, output: &Path, size: u32) -> AppResult<()> {
    let img = image::open(input)
        .map_err(|e| crate::error::AppError::new(format!("image open failed: {e}")))?;
    let resized = img.resize(size, u32::MAX, image::imageops::FilterType::Lanczos3);
    resized
        .save_with_format(output, image::ImageFormat::Png)
        .map_err(|e| crate::error::AppError::new(format!("image save failed: {e}")))?;
    Ok(())
}

/// Genera una miniatura con FFmpeg extrayendo el primer fotograma útil.
///
/// Se intenta primero a los 0.5 s (evita fotogramas negros iniciales) y, si el
/// medio es más corto, se reintenta desde el inicio.
async fn generate_ffmpeg_thumbnail(
    app: &AppHandle,
    input: &Path,
    output: &Path,
    size: u32,
) -> AppResult<()> {
    let bin = ffmpeg::ffmpeg(app);
    let out = output.to_string_lossy().into_owned();
    let inp = input.to_string_lossy().into_owned();

    let attempt = |ss: &str| {
        let args: Vec<String> = vec![
            "-y".into(),
            "-ss".into(),
            ss.into(),
            "-i".into(),
            inp.clone(),
            "-frames:v".into(),
            "1".into(),
            "-vf".into(),
            format!("scale={size}:-2"),
            out.clone(),
        ];
        let bin = bin.clone();
        async move { ffmpeg::run(&bin, &args).await }
    };

    let first = attempt("0.5").await?;
    if first.status.success() && output.is_file() {
        return Ok(());
    }

    let second = attempt("0").await?;
    if second.status.success() && output.is_file() {
        return Ok(());
    }

    Err(AppError::new("No se pudo generar la miniatura con FFmpeg"))
}

// ---------------------------------------------------------------------------
// MEDIA_CODEC
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct MediaCodecData {
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCodecResult {
    pub path: String,
    pub codecs: Vec<String>,
    pub mime_type: String,
    pub mime_codec: String,
}

/// `MEDIA_CODEC`: tipo MIME del medio y códigos de códec detectados con ffprobe.
#[tauri::command]
pub async fn MEDIA_CODEC(app: AppHandle, data: MediaCodecData) -> AppResult<MediaCodecResult> {
    let mime_type = get_mime_type(&data.path);
    let mut codecs: Vec<String> = Vec::new();

    if let Ok(probe) = ffmpeg::probe(&app, &data.path).await {
        if let Some(streams) = probe.get("streams").and_then(|s| s.as_array()) {
            for stream in streams {
                if let Some(name) = stream.get("codec_name").and_then(|n| n.as_str()) {
                    if !name.is_empty() && !codecs.iter().any(|c| c == name) {
                        codecs.push(name.to_string());
                    }
                }
            }
        }
    }

    let mime_codec = if codecs.is_empty() {
        String::new()
    } else {
        format!("{mime_type}; codecs=\"{}\"", codecs.join(", "))
    };

    Ok(MediaCodecResult {
        path: data.path,
        codecs,
        mime_type,
        mime_codec,
    })
}

// ---------------------------------------------------------------------------
// MEDIA_TRACKS (subtítulos embebidos → WebVTT)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    pub lang: String,
    pub name: String,
    pub vtt: String,
    pub embedded: bool,
}

#[derive(Serialize)]
pub struct MediaTracksResult {
    pub path: String,
    pub tracks: Vec<SubtitleTrack>,
}

/// `MEDIA_TRACKS`: extrae los subtítulos embebidos del vídeo con FFmpeg.
#[tauri::command]
pub async fn MEDIA_TRACKS(app: AppHandle, data: MediaCodecData) -> AppResult<MediaTracksResult> {
    let mut tracks: Vec<SubtitleTrack> = Vec::new();

    let probe = match ffmpeg::probe(&app, &data.path).await {
        Ok(p) => p,
        Err(_) => return Ok(MediaTracksResult { path: data.path, tracks }),
    };

    let streams = match probe.get("streams").and_then(|s| s.as_array()) {
        Some(s) => s,
        None => return Ok(MediaTracksResult { path: data.path, tracks }),
    };

    for stream in streams {
        let codec_type = stream.get("codec_type").and_then(|t| t.as_str()).unwrap_or("");
        if codec_type != "subtitle" {
            continue;
        }
        let index = match stream.get("index").and_then(|i| i.as_i64()) {
            Some(i) => i,
            None => continue,
        };

        let tags = stream.get("tags");
        let language = tags
            .and_then(|t| t.get("language"))
            .and_then(|l| l.as_str())
            .unwrap_or("und")
            .to_string();
        let title = tags
            .and_then(|t| t.get("title"))
            .and_then(|t| t.as_str())
            .unwrap_or(&language)
            .to_string();

        if let Ok(vtt) = extract_subtitle_vtt(&app, &data.path, index).await {
            if !vtt.trim().is_empty() {
                let lang_code = language.chars().take(2).collect::<String>();
                tracks.push(SubtitleTrack {
                    lang: if lang_code.is_empty() { "und".into() } else { lang_code },
                    name: title,
                    vtt,
                    embedded: true,
                });
            }
        }
    }

    Ok(MediaTracksResult { path: data.path, tracks })
}

/// Extrae un flujo de subtítulos concreto a formato WebVTT usando FFmpeg.
async fn extract_subtitle_vtt(app: &AppHandle, input: &str, index: i64) -> AppResult<String> {
    let bin = ffmpeg::ffmpeg(app);
    let args: Vec<String> = vec![
        "-v".into(),
        "quiet".into(),
        "-i".into(),
        input.into(),
        "-map".into(),
        format!("0:{index}"),
        "-f".into(),
        "webvtt".into(),
        "-".into(),
    ];
    let raw = ffmpeg::run_capture(&bin, &args).await?;
    Ok(normalize_webvtt(&raw))
}

/// Asegura que el texto empiece por la cabecera `WEBVTT`.
fn normalize_webvtt(raw: &str) -> String {
    let trimmed = raw.trim_start_matches('\u{feff}');
    if trimmed.trim_start().starts_with("WEBVTT") {
        trimmed.to_string()
    } else {
        format!("WEBVTT\n\n{trimmed}")
    }
}

// ---------------------------------------------------------------------------
// READ_AUDIO_METADATA (ReplayGain para normalización de volumen)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadataResult {
    pub common: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replay_gain_multiplier: Option<f64>,
}

/// `READ_AUDIO_METADATA`: etiquetas de audio y multiplicador ReplayGain.
#[tauri::command]
pub async fn READ_AUDIO_METADATA(
    app: AppHandle,
    data: ReadAudioMetadataData,
) -> AppResult<Option<AudioMetadataResult>> {
    if data.file_path.is_empty() {
        return Ok(None);
    }

    let probe = match ffmpeg::probe(&app, &data.file_path).await {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };

    let mut tags = Map::new();
    if let Some(format) = probe.get("format") {
        if let Some(format_tags) = format.get("tags").and_then(|t| t.as_object()) {
            for (k, v) in format_tags {
                tags.insert(k.clone(), v.clone());
            }
        }
    }
    if let Some(streams) = probe.get("streams").and_then(|s| s.as_array()) {
        for stream in streams {
            if let Some(stream_tags) = stream.get("tags").and_then(|t| t.as_object()) {
                for (k, v) in stream_tags {
                    tags.entry(k.clone()).or_insert_with(|| v.clone());
                }
            }
        }
    }

    let (gain_db, peak) = find_replay_gain(&Value::Object(tags.clone()));
    let replay_gain_multiplier = gain_db.map(|db| {
        let mut multiplier = 10_f64.powf(db / 20.0);
        if let Some(peak) = peak {
            if peak > 0.0 {
                let max = 1.0 / peak;
                if multiplier > max {
                    multiplier = max;
                }
            }
        }
        multiplier
    });

    Ok(Some(AudioMetadataResult {
        common: Value::Object(tags),
        replay_gain_multiplier,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadAudioMetadataData {
    #[serde(default)]
    pub file_path: String,
}

/// Busca recursivamente las claves ReplayGain (`…Gain` en dB y `…Peak` en ratio).
fn find_replay_gain(value: &Value) -> (Option<f64>, Option<f64>) {
    let mut gain: Option<f64> = None;
    let mut peak: Option<f64> = None;
    walk_replay_gain(value, &mut gain, &mut peak);
    (gain, peak)
}

fn walk_replay_gain(value: &Value, gain: &mut Option<f64>, peak: &mut Option<f64>) {
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                let clean: String = key
                    .to_lowercase()
                    .chars()
                    .filter(|c| !c.is_whitespace() && *c != '_')
                    .collect();
                if gain.is_none()
                    && (clean == "replaygaintrackgain" || clean == "replaygainalbumgain")
                {
                    *gain = parse_replay_value(val);
                } else if peak.is_none()
                    && (clean == "replaygaintrackpeak" || clean == "replaygainalbumpeak")
                {
                    *peak = parse_replay_value(val);
                } else if val.is_object() || val.is_array() {
                    walk_replay_gain(val, gain, peak);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                if item.is_object() || item.is_array() {
                    walk_replay_gain(item, gain, peak);
                }
            }
        }
        _ => {}
    }
}

fn parse_replay_value(val: &Value) -> Option<f64> {
    if let Some(n) = val.as_f64() {
        return Some(n);
    }
    if let Some(s) = val.as_str() {
        let cleaned: String = s
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
            .collect();
        return cleaned.parse::<f64>().ok();
    }
    if let Some(obj) = val.as_object() {
        for key in ["dB", "ratio", "db"] {
            if let Some(n) = obj.get(key).and_then(|v| v.as_f64()) {
                return Some(n);
            }
        }
    }
    None
}

/// `getMimeType` (subconjunto de la tabla de `files.ts`).
fn get_mime_type(file_path: &str) -> String {
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    let mime = match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "ogv" => "video/ogg",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "flv" => "video/x-flv",
        "mpeg" | "mpg" => "video/mpeg",
        "wmv" => "video/x-ms-wmv",
        "3gp" => "video/3gpp",
        "3g2" => "video/3gpp2",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "opus" => "audio/opus",
        "webm_audio" => "audio/webm",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    };
    mime.to_string()
}

// ---------------------------------------------------------------------------
// READ_EXIF
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ReadExifData {
    pub id: String,
}

#[derive(Serialize)]
pub struct ReadExifResult {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exif: Option<Value>,
}

/// `READ_EXIF`: metadatos EXIF de una imagen.
#[tauri::command]
pub fn READ_EXIF(data: ReadExifData) -> AppResult<ReadExifResult> {
    let exif = read_exif(&data.id).ok().flatten();
    Ok(ReadExifResult { id: data.id, exif })
}

fn read_exif(path: &str) -> AppResult<Option<Value>> {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Ok(None),
    };
    let mut reader = BufReader::new(file);
    let exif = match exif::Reader::new().read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };

    let mut image = Map::new();
    let mut exif_map = Map::new();
    let mut gps = Map::new();
    let mut interop = Map::new();

    for field in exif.fields() {
        let key = field.tag.to_string();
        let value = Value::String(field.display_value().to_string());
        match field.tag.context() {
            exif::Context::Tiff => {
                image.insert(key, value);
            }
            exif::Context::Gps => {
                gps.insert(key, value);
            }
            exif::Context::Interop => {
                interop.insert(key, value);
            }
            exif::Context::Exif => {
                exif_map.insert(key, value);
            }
            _ => {}
        }
    }

    let mut root = Map::new();
    if !image.is_empty() {
        root.insert("image".to_string(), Value::Object(image));
    }
    if !exif_map.is_empty() {
        root.insert("exif".to_string(), Value::Object(exif_map));
    }
    if !gps.is_empty() {
        root.insert("gps".to_string(), Value::Object(gps));
    }
    if !interop.is_empty() {
        root.insert("interoperability".to_string(), Value::Object(interop));
    }

    if root.is_empty() {
        return Ok(None);
    }
    Ok(Some(Value::Object(root)))
}
