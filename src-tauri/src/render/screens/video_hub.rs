//! Hub de decodificadores de video compartidos entre pantallas (F8.2).

use super::*;
use crate::render::media::{self, MediaStore};

/// Arranca, mantiene o detiene el video de fondo de una pantalla según el fondo actual.
/// Usa el hub de decodificadores compartidos (uno por archivo, F8.2).
pub(super) fn sync_video(app: &AppHandle, handle: &mut ScreenHandle, background: Option<&BackgroundMedia>) {
    let wanted = background
        .filter(|bg| is_video(bg))
        .and_then(|bg| bg.path.clone());

    if handle.video == wanted {
        return;
    }

    // Dejar el decodificador anterior (lo detiene si era el único suscriptor).
    if let Some(old_path) = handle.video.take() {
        let _ = video_hub_release(app, &old_path, &handle.label);
    }

    if let Some(path) = wanted {
        if video_hub_acquire(app, &path, &handle.label).is_err() {
            eprintln!("[screens] no se pudo reproducir el video {path}");
        } else {
            handle.video = Some(path);
        }
    }
}

/// Sube un fotograma decodificado a la textura compartida del archivo. Es **una**
/// subida por frame, vea el video una pantalla o diez (F17.4).
pub(super) fn publish_frame(store: &MediaStore, path: &str, width: u32, height: u32, rgba: &[u8]) {
    let _ = store.update_video_frame(path, width, height, rgba);
}

/// Suscribe una pantalla (`subscriber` = etiqueta de su ventana) al decodificador
/// compartido de `path`. Si el archivo ya se decodifica, sólo suma el suscriptor;
/// si no, inicia uno nuevo.
pub(super) fn video_hub_acquire(app: &AppHandle, path: &str, subscriber: &str) -> AppResult<()> {
    let state = manager(app)?;
    let mut hub = state.video_hub.lock_safe();

    if let Some(existing) = hub.get_mut(path) {
        existing.subscribers.add(subscriber);
        return Ok(());
    }

    let store = media::shared_store()?;
    let key = path.to_string();
    let playback = video::start_video_playback(app, path, path, 1920, 1080, move |_vid_id, w, h, bytes| {
        publish_frame(&store, &key, w, h, bytes);
    })?;

    let mut subscribers = Subscribers::default();
    subscribers.add(subscriber);
    hub.insert(path.to_string(), SharedVideo { playback, subscribers });
    Ok(())
}

/// Da de baja la suscripción de una pantalla. Si era la última, detiene el
/// decodificador y libera la entrada.
pub(super) fn video_hub_release(app: &AppHandle, path: &str, subscriber: &str) -> AppResult<()> {
    let state = manager(app)?;
    let mut hub = state.video_hub.lock_safe();

    let should_stop = hub.get_mut(path).is_some_and(|entry| entry.subscribers.remove(subscriber));
    if should_stop {
        if let Some(mut entry) = hub.remove(path) {
            entry.playback.stop();
        }
    }
    Ok(())
}

pub(super) fn is_video(bg: &BackgroundMedia) -> bool {
    if bg.media_type == "video" {
        return true;
    }
    let lower = bg.path.as_deref().unwrap_or("").to_lowercase();
    [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

