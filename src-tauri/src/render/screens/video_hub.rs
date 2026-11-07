//! Hub de decodificadores de video compartidos entre pantallas (F8.2).

use super::*;
use crate::render::media::{self, MediaStore};
use crate::render::video::{DecodedFrame, FramePixels, FrameSink};

/// Arranca, mantiene o detiene el video de fondo de una pantalla según el fondo actual.
/// Usa el hub de decodificadores compartidos (uno por archivo, F8.2).
pub(super) fn sync_video(app: &AppHandle, handle: &mut ScreenHandle, background: Option<&BackgroundMedia>) {
    let wanted = background
        .filter(|bg| is_video(bg))
        .and_then(|bg| bg.path.clone());

    if handle.video != wanted {
        // Dejar el decodificador anterior (lo detiene si era el único suscriptor).
        if let Some(old_path) = handle.video.take() {
            let _ = video_hub_release(app, &old_path, &handle.label);
        }

        if let Some(path) = wanted {
            if video_hub_acquire(app, &path, &handle.label).is_err() {
                log::warn!("[screens] no se pudo reproducir el video {path}");
            } else {
                handle.video = Some(path);
            }
        }
    }

    if let (Some(path), Some(bg)) = (&handle.video, background) {
        sync_transport(app, path, &handle.label, bg);
    }
}

/// Diferencia (ms) entre el decodificador y el transporte del webview a partir de la cual se salta.
const SYNC_THRESHOLD_MS: u64 = 300;

/// A dónde saltar para seguir al reloj maestro: `Some(wanted)` si la diferencia pasa el umbral.
/// Con `duration_ms > 0` la diferencia es circular: en el borde de la vuelta del loop 2900 y 50 están cerca.
pub fn sync_action(decoder_ms: u64, wanted_ms: Option<u64>, threshold_ms: u64, duration_ms: u64) -> Option<u64> {
    wanted_ms.filter(|wanted| {
        let diff = wanted.abs_diff(decoder_ms);
        let diff = if duration_ms > 0 && diff <= duration_ms { diff.min(duration_ms - diff) } else { diff };
        diff > threshold_ms
    })
}

/// El audio del webview es el reloj maestro: el decodificador sigue su pausa y su posición.
fn sync_transport(app: &AppHandle, path: &str, label: &str, bg: &BackgroundMedia) {
    let Ok(state) = manager(app) else { return };
    let mut hub = state.video_hub.lock_safe();
    let Some(video) = hub.get_mut(path) else { return };
    // con varias pantallas sobre el mismo archivo sólo la líder manda (si no, se pelean a seeks)
    if !video.subscribers.is_leader(label) {
        return;
    }
    video.set_paused(bg.paused);
    if let Some(ms) = sync_action(video.position_ms(), bg.position_ms, SYNC_THRESHOLD_MS, video.playback.duration_ms())
        && let Err(err) = video.seek(ms) {
            log::warn!("[screens] no se pudo sincronizar {path} a {ms} ms: {err}");
        }
}

/// Recibe los frames del decodificador de un archivo y los publica en la textura compartida
/// (clave = ruta). Es **una** publicación por frame, vea el video una pantalla o diez (F17.4).
pub(super) struct HubSink {
    pub(super) store: Arc<MediaStore>,
    pub(super) key: String,
}

impl FrameSink for HubSink {
    fn push(&self, frame: DecodedFrame<'_>) {
        match frame.pixels {
            FramePixels::Nv12Cpu { width, height, y, uv, matrix, full_range } => {
                let _ = self.store.update_video_nv12_cpu(&self.key, width, height, y, uv, matrix, full_range);
            }
            FramePixels::Native(native) => self.store.set_video_native(&self.key, native),
        }
    }
}

impl SharedVideo {
    pub(super) fn set_paused(&mut self, paused: bool) {
        self.playback.set_paused(paused);
    }

    pub(super) fn seek(&mut self, position_ms: u64) -> AppResult<()> {
        self.playback.seek(position_ms)
    }

    pub(super) fn position_ms(&self) -> u64 {
        self.playback.position_ms()
    }
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

    let sink = Arc::new(HubSink { store: media::shared_store()?, key: path.to_string() });
    let playback = video::start(app, path, sink)?;

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
    if should_stop
        && let Some(mut entry) = hub.remove(path) {
            entry.playback.stop();
            if let Ok(store) = media::shared_store() {
                store.remove_video(path);
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


#[cfg(test)]
mod tests {
    use super::{sync_action, Subscribers};

    #[test]
    fn sync_action_respeta_el_umbral() {
        assert_eq!(sync_action(1000, Some(1100), 300, 0), None);
        assert_eq!(sync_action(1000, Some(2000), 300, 0), Some(2000));
        assert_eq!(sync_action(1000, None, 300, 0), None);
    }

    #[test]
    fn sync_action_es_circular_en_el_loop() {
        assert_eq!(sync_action(2900, Some(50), 300, 3000), None);
        assert_eq!(sync_action(50, Some(2900), 300, 3000), None);
        assert_eq!(sync_action(1000, Some(2000), 300, 3000), Some(2000));
        assert_eq!(sync_action(1000, Some(9000), 300, 3000), Some(9000), "más allá de la duración: lineal");
    }

    #[test]
    fn la_lider_es_la_primera_y_pasa_a_otra_si_se_va() {
        let mut subs = Subscribers::default();
        subs.add("a");
        subs.add("b");
        assert!(subs.is_leader("a") && !subs.is_leader("b"));
        assert!(!subs.remove("a"));
        assert!(subs.is_leader("b"));
        assert!(subs.remove("b"));
        assert!(!subs.is_leader("b"));
    }
}
