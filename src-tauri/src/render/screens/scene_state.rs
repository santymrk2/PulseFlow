//! Escena de cada salida: setters que llama `RENDER_SCENE` y pedido de transición.

use super::*;

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

/// Reemplaza la escena de audiencia de una salida (texto + medios + fondo).
pub fn set_audience_scene(
    app: &AppHandle,
    id: &str,
    text: Vec<TextBlock>,
    media: Vec<MediaItem>,
    background: Option<BackgroundMedia>,
    overlay_text: Vec<TextBlock>,
    overlay_media: Vec<MediaItem>,
) -> AppResult<()> {
    let state = manager(app)?;
    // El frontend reenvía la escena ante cualquier cambio de `outputs`, no sólo al
    // cambiar de diapositiva; por eso sólo se pide transición si el contenido visible
    // cambió de verdad (F4.4).
    let changed = {
        let scene = state.scene(id);
        let current = scene.read_safe();
        current.text != text
            || current.media != media
            || current.background != background
            || current.overlay_text != overlay_text
            || current.overlay_media != overlay_media
    };

    set_scene_text(app, id, text)?;
    set_scene_media(app, id, media)?;
    set_scene_background(app, id, background)?;
    // Overlays del Scene Graph (F4.6): capa propia encima de la slide.
    {
        let scene = state.scene(id);
        let mut scene = scene.write_safe();
        scene.overlay_text = overlay_text;
        scene.overlay_media = overlay_media;
    }

    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Reemplaza sólo el texto de la escena de una salida.
pub fn set_scene_text(app: &AppHandle, id: &str, text: Vec<TextBlock>) -> AppResult<()> {
    let scene = manager(app)?.scene(id);
    scene.write_safe().text = text;
    Ok(())
}

/// Reemplaza sólo los items de medio (imágenes) de la escena de una salida.
pub fn set_scene_media(app: &AppHandle, id: &str, media: Vec<MediaItem>) -> AppResult<()> {
    let scene = manager(app)?.scene(id);
    scene.write_safe().media = media;
    Ok(())
}

/// Reemplaza sólo el fondo de la escena de una salida y sincroniza el video.
pub fn set_scene_background(
    app: &AppHandle,
    id: &str,
    background: Option<BackgroundMedia>,
) -> AppResult<()> {
    let state = manager(app)?;
    let scene = state.scene(id);
    {
        let mut scene = scene.write_safe();
        scene.background = background.clone();
    }

    let mut screens = state.screens.lock_safe();
    if let Some(handle) = screens.get_mut(id) {
        sync_video(app, handle, background.as_ref());
    }
    Ok(())
}

/// Reemplaza los datos de una pantalla de stage.
pub fn set_stage_scene(app: &AppHandle, id: &str, data: StageData) -> AppResult<()> {
    let state = manager(app)?;
    let scene = state.scene(id);
    let changed = scene.read_safe().stage != data;
    scene.write_safe().stage = data;

    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Configura la transición global del engine (se aplica por pantalla desde F3).
pub fn set_transition_config(
    app: &AppHandle,
    trans_type_str: &str,
    duration_ms: u64,
    easing_str: &str,
) -> AppResult<()> {
    let state = manager(app)?;
    let mut cfg = state.transition_config.lock_safe();
    let trans_type = crate::render::transition::TransitionType::from_str(trans_type_str);
    let easing = match easing_str.to_lowercase().as_str() {
        "easeout" | "ease_out" => crate::render::transition::EasingType::EaseOut,
        "linear" => crate::render::transition::EasingType::Linear,
        _ => crate::render::transition::EasingType::EaseInOut,
    };
    *cfg = (trans_type, duration_ms, easing);
    Ok(())
}

/// Pide al bucle de la pantalla `id` una transición con la config global actual.
/// Sólo se llama cuando el contenido renderizable cambió (ver `set_audience_scene`).
pub(super) fn request_transition(state: &ScreenManager, id: &str) {
    let (transition_type, duration_ms, easing) = *state.transition_config.lock_safe();
    if let Some(handle) = state.screens.lock_safe().get(id) {
        *handle.transition.lock_safe() = Some(TransitionRequest {
            transition_type,
            duration_ms,
            easing,
        });
    }
}
