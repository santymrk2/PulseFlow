//! Entry point de la librería de PulseFlow (Tauri).
//!
//! Comandos IPC (`commands/`), persistencia (STORES), servidores locales y el
//! engine de render nativo WGPU (`render/`), que es la única salida del programa.

// Los literales `json!` de `defaults.rs` son muy profundos y superan el límite
// de recursión por defecto de los macros.
#![recursion_limit = "512"]

pub mod commands;
pub mod domain;
pub mod error;
#[cfg(target_os = "macos")]
pub mod menu;
pub mod render;
pub mod server;
pub mod state;
pub mod types;
pub mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Inicializar el gestor de tiendas con el directorio de config de la app.
            let config_dir = app.path().app_config_dir()?;
            std::fs::create_dir_all(&config_dir)?;
            let stores = crate::domain::data::store::StoreManager::new(config_dir);
            app.manage(crate::state::AppState::new(stores));
            app.manage(crate::render::ScreenManager::new());
            // F10.7 — menú nativo (sólo macOS; en Windows lo hace MenuBar.svelte).
            #[cfg(target_os = "macos")]
            crate::menu::install(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // APP
            commands::app::VERSION,
            commands::app::IS_DEV,
            commands::app::GET_OS,
            commands::app::LOG,
            commands::app::URL,
            commands::app::IP,
            // STARTUP
            commands::startup::READY,
            // WINDOW
            commands::window::CLOSE,
            commands::window::MAXIMIZE,
            commands::window::MAXIMIZED,
            commands::import::IMPORT,
            commands::import::IMPORT_FILES,
            commands::window::MINIMIZE,
            commands::window::FULLSCREEN,
            // STORES
            commands::stores::SETTINGS,
            commands::stores::SYNCED_SETTINGS,
            commands::stores::STAGE,
            commands::stores::PROJECTS,
            commands::stores::OVERLAYS,
            commands::stores::TEMPLATES,
            commands::stores::EVENTS,
            commands::stores::MEDIA,
            commands::stores::THEMES,
            commands::stores::DRIVE_API_KEY,
            commands::stores::HISTORY,
            commands::stores::USAGE,
            commands::stores::CACHE,
            commands::stores::GET_STORE_VALUE,
            commands::stores::SET_STORE_VALUE,
            commands::stores::DATA_PATH,
            commands::stores::UPDATE_DATA_PATH,
            commands::stores::GET_PATHS,
            // FILES
            commands::files::READ_FILE,
            commands::files::READ_FOLDER,
            commands::files::FILE_INFO,
            commands::files::OPEN_FOLDER,
            commands::files::OPEN_FILE,
            commands::files::SYSTEM_OPEN,
            commands::files::OPEN_FOLDER_PATH,
            commands::files::OPEN_LOG,
            commands::files::OPEN_CACHE,
            commands::files::OPEN_APPDATA,
            commands::files::GET_CACHE_PATH,
            commands::files::READ_BIBLES_FOLDER,
            commands::files::GET_MEDIA_FOLDER_PATH,
            commands::files::SET_MEDIA_FOLDER_PATH,
            commands::files::SAVE_IMAGE,
            commands::files::PDF_TO_IMAGE,
            commands::files::LOCATE_MEDIA_FILE,
            commands::files::BUNDLE_MEDIA_FILES,
            // SHOWS
            commands::shows::SAVE,
            commands::shows::SHOW,
            commands::shows::SHOWS,
            commands::shows::REFRESH_SHOWS,
            commands::shows::FULL_SHOWS_LIST,
            commands::shows::BIBLE,
            commands::shows::DELETE_SHOWS,
            commands::shows::DELETE_SHOWS_NI,
            commands::shows::GET_EMPTY_SHOWS,
            // MEDIA
            commands::media::DOES_MEDIA_EXIST,
            commands::media::GET_THUMBNAIL,
            commands::media::MEDIA_CODEC,
            commands::media::READ_EXIF,
            commands::media::MEDIA_TRACKS,
            commands::media::READ_AUDIO_METADATA,
            // OUTPUT
            commands::output::GET_DISPLAYS,
            commands::output::GET_SCREENS,
            commands::output::GET_WINDOWS,
            commands::output::TOGGLE_OUTPUTS,
            commands::output::RENDER_SCENE,
            #[cfg(debug_assertions)]
            commands::output::RENDER_SNAPSHOT,
            commands::output::UPDATE_BOUNDS,
            commands::output::IDENTIFY_SCREENS,
            commands::output::REMOVE_SCREEN,
            commands::output::RENDER_PREFETCH,
            // SERVERS
            commands::servers::START,
            commands::servers::STOP,
            commands::servers::SERVER_DATA,
            commands::servers::WEBSOCKET_START,
            commands::servers::WEBSOCKET_STOP,
            commands::servers::SERVER_SEND,
            // MENU (macOS)
            #[cfg(target_os = "macos")]
            menu::update_live_menu,
            // BACKUP
            commands::backup::BACKUPS,
            commands::backup::DELETE_BACKUP,
            commands::backup::RESTORE,
            // SYNC
            commands::sync::CAN_SYNC,
            commands::sync::GET_TEAMS,
            commands::sync::CLOUD_DATA,
            // TIMECODE
            commands::timecode::TIMECODE_START,
            commands::timecode::TIMECODE_STOP,
            commands::timecode::TIMECODE_VALUE,
            // MIDI
            commands::midi::GET_MIDI_OUTPUTS,
            commands::midi::GET_MIDI_INPUTS,
            // NDI
            commands::ndi::NDI_STATUS,
            commands::ndi::NDI_SOURCES,
            // BLACKMAGIC
            commands::blackmagic::BLACKMAGIC_STATUS,
            commands::blackmagic::BLACKMAGIC_DEVICES,
            // STREAMING
            commands::streaming::FFMPEG_CHECK,
        ])
        .run(tauri::generate_context!());

    // Regla del proyecto: no usar `.expect()` en producción; reportar y salir.
    if let Err(err) = result {
        eprintln!("PulseFlow no pudo iniciarse: {err}");
        std::process::exit(1);
    }
}
