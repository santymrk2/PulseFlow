//! Traducción de `src/types/IPC/Main.ts` (Electron) a Rust.
//!
//! Cada variante del enum `Main` corresponde a un canal IPC de Electron que,
//! en Tauri, se expone como un `#[tauri::command]`. Los nombres de las variantes
//! se mantienen idénticos a los del enum de TypeScript para que la serialización
//! (`serde`) coincida 1:1 con los canales existentes del frontend.
//!
//! Regla del proyecto (`.opencode-rules.md`, punto 4): toda interfaz que viaje
//! entre el frontend y el backend debe tener su equivalente `struct`/`enum` en
//! Rust con `#[derive(Serialize, Deserialize)]`.

use serde::{Deserialize, Serialize};

/// Canal IPC central de PulseFlow. Ver `src/types/IPC/Main.ts` en Electron.
///
/// Los nombres se mantienen en `SCREAMING_SNAKE_CASE` a propósito para coincidir
/// con los canales de TypeScript, de ahí el `allow(non_camel_case_types)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[allow(non_camel_case_types)]
pub enum Main {
    // DEV
    LOG,
    IS_DEV,
    GET_CACHE_PATH,
    // APP
    VERSION,
    GET_OS,
    DEVICE_ID,
    GET_DEVICE_NAME,
    IP,
    CHECK_RAM_USAGE,
    // STORES
    SETTINGS,
    SYNCED_SETTINGS,
    STAGE,
    PROJECTS,
    OVERLAYS,
    TEMPLATES,
    EVENTS,
    MEDIA,
    THEMES,
    DRIVE_API_KEY,
    HISTORY,
    USAGE,
    CACHE,
    // WINDOW
    CLOSE,
    MAXIMIZE,
    MAXIMIZED,
    MINIMIZE,
    FULLSCREEN,
    // IMPORT / SAVE
    IMPORT,
    IMPORT_FILES,
    BIBLE,
    SHOW,
    SAVE,
    BACKUPS,
    DELETE_BACKUP,
    // SPELLCHECK
    SPELLCHECK,
    // APP / FILES
    SHOWS,
    AUTO_UPDATE,
    URL,
    LANGUAGE,
    GET_PATHS,
    DATA_PATH,
    UPDATE_DATA_PATH,
    LOG_ERROR,
    OPEN_LOG,
    OPEN_CACHE,
    OPEN_APPDATA,
    OPEN_FOLDER_PATH,
    OPEN_NOW_PLAYING,
    GET_STORE_VALUE,
    SET_STORE_VALUE,
    DELETE_SHOWS,
    DELETE_SHOWS_NI,
    REFRESH_SHOWS,
    GET_EMPTY_SHOWS,
    FULL_SHOWS_LIST,
    // OUTPUT
    GET_SCREENS,
    GET_WINDOWS,
    GET_DISPLAYS,
    GET_GRAPHICS_DEVICES,
    OUTPUT,
    // MEDIA
    DOES_MEDIA_EXIST,
    GET_THUMBNAIL,
    SAVE_IMAGE,
    PDF_TO_IMAGE,
    READ_EXIF,
    MEDIA_CODEC,
    MEDIA_TRACKS,
    DOWNLOAD_LESSONS_MEDIA,
    MEDIA_DOWNLOAD,
    MEDIA_IS_DOWNLOADED,
    NOW_PLAYING,
    NOW_PLAYING_UNSET,
    READ_AUDIO_METADATA,
    CAPTURE_SLIDE,
    ACCESS_CAMERA_PERMISSION,
    ACCESS_MICROPHONE_PERMISSION,
    ACCESS_SCREEN_PERMISSION,
    // PPT
    PPT_TO_PDF,
    SLIDESHOW_GET_APPS,
    START_SLIDESHOW,
    PRESENTATION_CONTROL,
    // SERVERS
    START,
    STOP,
    SERVER_DATA,
    // WebSocket / REST / OSC
    WEBSOCKET_START,
    WEBSOCKET_STOP,
    API_TRIGGER,
    EMIT_OSC,
    // MIDI
    GET_MIDI_OUTPUTS,
    GET_MIDI_INPUTS,
    SEND_MIDI,
    RECEIVE_MIDI,
    CLOSE_MIDI,
    // LYRICS
    GET_LYRICS,
    SEARCH_LYRICS,
    // FILES
    RECORDER,
    RESTORE,
    SYSTEM_OPEN,
    LOCATE_MEDIA_FILE,
    GET_MEDIA_FOLDER_PATH,
    SET_MEDIA_FOLDER_PATH,
    GET_SIMILAR,
    BUNDLE_MEDIA_FILES,
    MEDIA_FOLDER_COPY,
    READ_BIBLES_FOLDER,
    FILE_INFO,
    READ_FOLDER,
    READ_FILE,
    OPEN_FOLDER,
    OPEN_FILE,
    // SYNC
    CAN_SYNC,
    GET_TEAMS,
    CLOUD_DATA,
    CLOUD_SYNC,
    RESTORE_CLOUD_BACKUP,
    GET_CONVERSATION_ID,
    SEND_SOCKET_MESSAGE,
    // Provider-based routing
    PROVIDER_LOAD_SERVICES,
    PROVIDER_CONNECTIONS,
    PROVIDER_DISCONNECT,
    PROVIDER_STARTUP_LOAD,
    PROVIDER_FETCH_FOLDERS,
    PCO_LIVE_GET,
    PCO_PUSHER_AUTH,
    PCO_FETCH_SERVICE_TREE,
    PCO_LOAD_PLAN,
    ONSTAGE_LOAD_SERVICE,
    ONSTAGE_GET_TEAMS,
    ONSTAGE_SWITCH_TEAM,
    // Content Library
    GET_CONTENT_PROVIDERS,
    GET_CONTENT_LIBRARY,
    GET_PROVIDER_CONTENT,
    CHECK_MEDIA_LICENSE,
    // Timecode
    TIMECODE_START,
    TIMECODE_STOP,
    TIMECODE_VALUE,
    TIMECODE_AUDIO_DATA,
    TIMECODE_STATUS,
    // Spotify
    SPOTIFY_GET_STATE,
    SPOTIFY_COMMAND,
    // FFmpeg
    FFMPEG_CHECK,
    FFMPEG_DOWNLOAD,
    // Streaming encoder
    ENCODER_DETECT,
    SET_RTMP_ENCODER,
    // AI
    AI_GET_MODELS,
    AI_GET_BIN,
    AI_LISTEN_START,
    AI_LISTEN_STOP,
    AI_AUDIO_DATA,
    AI_GET_STATUS,
    AI_SETUP,
    AI_SET_KEY,
    AI_LLM_COMPLETE,
}

/// Nombre del canal IPC central (equivale a `export const MAIN = "MAIN"`).
pub const MAIN: &str = "MAIN";

/// Información del sistema operativo. Equivale a la interfaz `OS`
/// de `src/types/Main.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OS {
    /// `std::env::consts::OS` (p. ej. "macos", "windows", "linux").
    pub platform: String,
    /// Nombre del host (`os.hostname()` en Electron).
    pub name: String,
    /// Arquitectura (`std::env::consts::ARCH`, p. ej. "aarch64", "x86_64").
    pub arch: String,
}
