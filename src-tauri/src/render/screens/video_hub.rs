//! Hub de decodificadores de video compartidos entre pantallas (F8.2).

use super::*;

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
        let _ = video_hub_release(app, &old_path, &handle.video_frame);
    }

    if let Some(path) = wanted {
        let bg_id = background.map(|bg| bg.id.clone()).unwrap_or_default();
        if video_hub_acquire(app, &path, &bg_id, &handle.video_frame).is_err() {
            eprintln!("[screens] no se pudo reproducir el video {path}");
        } else {
            handle.video = Some(path);
        }
    }
}

/// Suscribe el slot de una pantalla al decodificador compartido de `path`.
/// Si el archivo ya se está decodificando, sólo agrega el suscriptor (sin
/// otro proceso ffmpeg); si no, inicia uno nuevo.
pub(super) fn video_hub_acquire(
    app: &AppHandle,
    path: &str,
    bg_id: &str,
    slot: &Arc<Mutex<Option<VideoFrame>>>,
) -> AppResult<()> {
    let state = manager(app)?;
    let mut hub = state.video_hub.lock_safe();

    // Ya hay un decodificador para este archivo: agregar el suscriptor.
    if let Some(existing) = hub.get_mut(path) {
        existing.subscribers.lock_safe().push(VideoSubscriber {
            bg_id: bg_id.to_string(),
            slot: Arc::clone(slot),
        });
        return Ok(());
    }

    // Nuevo decodificador: un proceso ffmpeg que difunde cada fotograma a todos
    // los suscriptores (cada uno con su propio id de fondo).
    let subscribers: Arc<Mutex<Vec<VideoSubscriber>>> = Arc::new(Mutex::new(vec![VideoSubscriber {
        bg_id: bg_id.to_string(),
        slot: Arc::clone(slot),
    }]));
    let broadcast = Arc::clone(&subscribers);

    let result = video::start_video_playback(app, path, path, 1920, 1080, move |_vid_id, w, h, bytes| {
        for sub in broadcast.lock_safe().iter() {
            *sub.slot.lock_safe() = Some((sub.bg_id.clone(), w, h, bytes.to_vec()));
        }
    });

    match result {
        Ok(playback) => {
            hub.insert(path.to_string(), SharedVideo { playback, subscribers });
            Ok(())
        }
        Err(err) => Err(err),
    }
}

/// Da de baja la suscripción de una pantalla al decodificador de `path`.
/// Si queda sin suscriptores, detiene el proceso ffmpeg y libera la entrada.
pub(super) fn video_hub_release(
    app: &AppHandle,
    path: &str,
    slot: &Arc<Mutex<Option<VideoFrame>>>,
) -> AppResult<()> {
    let state = manager(app)?;
    let mut hub = state.video_hub.lock_safe();

    let should_stop = match hub.get_mut(path) {
        Some(entry) => {
            entry
                .subscribers
                .lock_safe()
                .retain(|sub| !Arc::ptr_eq(&sub.slot, slot));
            entry.subscribers.lock_safe().is_empty()
        }
        None => false,
    };

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

