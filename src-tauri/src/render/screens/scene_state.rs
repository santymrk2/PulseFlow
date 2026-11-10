//! Escena de cada salida: setters que llama `RENDER_SCENE` y pedido de transición.

use super::*;

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

/// Reemplaza la escena de audiencia de una salida (texto + medios + fondo).
#[allow(clippy::too_many_arguments)] // espeja el payload de RENDER_SCENE: un argumento por capa de la escena, que el comando pasa 1:1
pub fn set_audience_scene(
    app: &AppHandle,
    id: &str,
    text: Vec<TextBlock>,
    media: Vec<MediaItem>,
    background: Option<BackgroundMedia>,
    overlay_text: Vec<TextBlock>,
    overlay_media: Vec<MediaItem>,
    content: Option<crate::render::frame::ContentFrame>,
) -> AppResult<()> {
    let state = manager(app)?;
    // los videos de la slide se sincronizan con el hub abajo (la escena se lleva `media`)
    let videos: Vec<MediaItem> = media.iter().filter(|m| m.media_type == "video").cloned().collect();
    let changed = publish_audience_scene(
        &state.scene(id),
        text,
        media,
        &background,
        overlay_text,
        overlay_media,
        content,
    );

    // El video de fondo se sincroniza aparte (toca el hub de decodificadores).
    {
        let mut screens = state.screens.lock_safe();
        if let Some(handle) = screens.get_mut(id) {
            sync_video(app, handle, background.as_ref());
            sync_item_videos(app, handle, &item_videos(&handle.label, &videos));
        }
    }

    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Publica la escena de audiencia en `slot` y devuelve si el contenido visible cambió de verdad.
/// El frontend reenvía la escena ante cualquier cambio de `outputs` (y cada segundo con un reloj),
/// así que sólo cuenta como cambio lo que no es texto `live`: ese se aplica sin transición (F4.4).
fn publish_audience_scene(
    slot: &SceneSlot,
    text: Vec<TextBlock>,
    media: Vec<MediaItem>,
    background: &Option<BackgroundMedia>,
    overlay_text: Vec<TextBlock>,
    overlay_media: Vec<MediaItem>,
    content: Option<crate::render::frame::ContentFrame>,
) -> bool {
    let changed = {
        let current = slot.load();
        !same_blocks(&current.text, &text)
            || !same_media(&current.media, &media)
            || current.background.as_ref().map(BackgroundMedia::without_transport) != background.as_ref().map(BackgroundMedia::without_transport)
            || !same_blocks(&current.overlay_text, &overlay_text)
            || !same_media(&current.overlay_media, &overlay_media)
            || current.content != content
    };

    // Una sola publicación: el hilo de render nunca ve la escena a medio cambiar.
    slot.update(|scene| {
        scene.text = text;
        scene.media = media;
        scene.background = background.clone();
        scene.overlay_text = overlay_text;
        scene.overlay_media = overlay_media;
        scene.content = content;
    });
    changed
}

/// Igual que `==`, salvo la pausa y la posición de los videos: cambian cada segundo y no son un cambio de escena (F23.20).
fn same_media(current: &[MediaItem], next: &[MediaItem]) -> bool {
    current.len() == next.len() && current.iter().zip(next).all(|(a, b)| a.without_transport() == b.without_transport())
}

// Regla: `live` = todo contenido que cambia solo con el tiempo (reloj, timers, eventos, variables, valores
// dinámicos de tiempo); su TEXTO no cuenta como cambio de escena. El transporte de video (pausa/posición)
// tampoco. Todo lo demás sí.
/// Igual que `==` por bloque, salvo el texto y los tramos de los bloques `live`: esos cambian
/// cada segundo y no son un cambio de escena (posición, estilo o cantidad sí lo son).
fn same_blocks(current: &[TextBlock], next: &[TextBlock]) -> bool {
    current.len() == next.len()
        && current.iter().zip(next).all(|(a, b)| {
            if a.live && b.live {
                TextBlock { text: b.text.clone(), spans: b.spans.clone(), ..a.clone() } == *b
            } else {
                a == b
            }
        })
}

/// Reemplaza sólo el texto de la escena de una salida.
pub fn set_scene_text(app: &AppHandle, id: &str, text: Vec<TextBlock>) -> AppResult<()> {
    manager(app)?
        .scene(id)
        .update(|scene| scene.text = text);
    Ok(())
}

/// Reemplaza sólo los items de medio (imágenes) de la escena de una salida.
pub fn set_scene_media(app: &AppHandle, id: &str, media: Vec<MediaItem>) -> AppResult<()> {
    manager(app)?
        .scene(id)
        .update(|scene| scene.media = media);
    Ok(())
}

/// Reemplaza sólo el fondo de la escena de una salida y sincroniza el video.
pub fn set_scene_background(
    app: &AppHandle,
    id: &str,
    background: Option<BackgroundMedia>,
) -> AppResult<()> {
    let state = manager(app)?;
    state
        .scene(id)
        .update(|scene| scene.background = background.clone());

    let mut screens = state.screens.lock_safe();
    if let Some(handle) = screens.get_mut(id) {
        sync_video(app, handle, background.as_ref());
    }
    Ok(())
}

/// Reemplaza los datos de una pantalla de stage. `text`/`media` son los ítems del layout del usuario (F23.19);
/// vacíos, el stage dibuja `stage_blocks` como siempre.
pub fn set_stage_scene(app: &AppHandle, id: &str, data: StageData, text: Vec<TextBlock>, media: Vec<MediaItem>) -> AppResult<()> {
    let state = manager(app)?;
    let videos: Vec<MediaItem> = media.iter().filter(|m| m.media_type == "video").cloned().collect();
    let changed = publish_stage_scene(&state.scene(id), data, text, media);
    if let Some(handle) = state.screens.lock_safe().get_mut(id) {
        sync_item_videos(app, handle, &item_videos(&handle.label, &videos));
    }
    if changed {
        request_transition(&state, id);
    }
    Ok(())
}

/// Publica la escena de stage y devuelve si el contenido visible cambió (el texto `live` no cuenta, como en audiencia).
fn publish_stage_scene(slot: &SceneSlot, data: StageData, text: Vec<TextBlock>, media: Vec<MediaItem>) -> bool {
    let changed = {
        let current = slot.load();
        current.stage != data || !same_blocks(&current.text, &text) || !same_media(&current.media, &media)
    };
    slot.update(|scene| {
        scene.stage = data;
        scene.background = None; // el stage no dibuja fondo: no hereda el de la audiencia
        scene.text = text;
        scene.media = media;
    });
    changed
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

#[cfg(test)]
mod tests {
    use super::*;

    fn bloque(text: &str, live: bool) -> TextBlock {
        TextBlock { text: text.into(), live, ..TextBlock::default() }
    }

    /// Publica sólo bloques de texto; devuelve si cambió la escena.
    fn publicar(slot: &SceneSlot, text: Vec<TextBlock>) -> bool {
        publish_audience_scene(slot, text, Vec::new(), &None, Vec::new(), Vec::new(), None)
    }

    #[test]
    fn texto_live_nuevo_se_aplica_sin_pedir_transicion() {
        let slot = SceneSlot::new();
        publicar(&slot, vec![bloque("10:00", true)]);
        assert!(!publicar(&slot, vec![bloque("10:01", true)]));
        assert_eq!(slot.load().text[0].text, "10:01");
    }

    #[test]
    fn texto_no_live_que_cambia_pide_transicion() {
        let slot = SceneSlot::new();
        publicar(&slot, vec![bloque("hola", false)]);
        assert!(publicar(&slot, vec![bloque("chau", false)]));
    }

    #[test]
    fn bloque_live_que_cambia_de_posicion_pide_transicion() {
        let slot = SceneSlot::new();
        publicar(&slot, vec![bloque("10:00", true)]);
        let movido = TextBlock { x: 40.0, ..bloque("10:01", true) };
        assert!(publicar(&slot, vec![movido]));
    }

    #[test]
    fn bloque_live_nuevo_pide_transicion() {
        let slot = SceneSlot::new();
        publicar(&slot, vec![bloque("hola", false)]);
        assert!(publicar(&slot, vec![bloque("hola", false), bloque("10:00", true)]));
    }

    fn video_item(position_ms: Option<u64>, paused: bool) -> MediaItem {
        MediaItem {
            id: "/m/clip.mp4".into(),
            item_id: Some("v1".into()),
            path: "/m/clip.mp4".into(),
            media_type: "video".into(),
            x: 0.0,
            y: 0.0,
            width: 480.0,
            height: 270.0,
            aspect_mode: 0,
            opacity: 1.0,
            design_width: Some(1920.0),
            box_style: None,
            paused,
            position_ms,
        }
    }

    /// F23.20: el transporte de un video de la slide cambia cada segundo y no es un cambio de escena.
    #[test]
    fn la_posicion_de_un_video_de_la_slide_no_pide_transicion() {
        let slot = SceneSlot::new();
        let publicar = |m: MediaItem| publish_audience_scene(&slot, Vec::new(), vec![m], &None, Vec::new(), Vec::new(), None);
        assert!(publicar(video_item(Some(1000), false)), "el ítem nuevo sí");
        assert!(!publicar(video_item(Some(2000), false)), "sólo cambia la posición");
        assert!(!publicar(video_item(Some(2000), true)), "sólo cambia la pausa");
        assert_eq!(slot.load().media[0].position_ms, Some(2000), "pero la escena publicada lleva el transporte nuevo");
        let movido = MediaItem { x: 10.0, ..video_item(Some(2000), true) };
        assert!(publicar(movido), "mover el ítem sí");
    }

    #[test]
    fn el_transporte_de_un_video_de_overlay_no_pide_transicion() {
        let slot = SceneSlot::new();
        let publicar = |m: MediaItem| publish_audience_scene(&slot, Vec::new(), Vec::new(), &None, Vec::new(), vec![m], None);
        assert!(publicar(video_item(Some(1000), false)), "el ítem nuevo sí");
        assert!(!publicar(video_item(Some(2000), true)), "sólo cambia el transporte");
        let movido = MediaItem { x: 10.0, ..video_item(Some(2000), true) };
        assert!(publicar(movido), "mover el ítem sí");
    }

    #[test]
    fn el_stage_no_hereda_el_fondo_de_la_audiencia() {
        let slot = SceneSlot::new();
        let fondo = BackgroundMedia { id: "f".into(), path: Some("/m/f.png".into()), media_type: "image".into(), opacity: 1.0, aspect_mode: 0, paused: false, position_ms: None };
        publish_audience_scene(&slot, Vec::new(), Vec::new(), &Some(fondo), Vec::new(), Vec::new(), None);
        publish_stage_scene(&slot, StageData::default(), Vec::new(), Vec::new());
        assert!(slot.load().background.is_none());
    }

    #[test]
    fn stage_con_items_no_usa_stage_blocks() {
        let slot = SceneSlot::new();
        let datos = StageData { current_slide: "plano".into(), ..StageData::default() };

        // sin ítems del layout: sigue el stage de siempre (`stage_blocks`)
        publish_stage_scene(&slot, datos.clone(), Vec::new(), Vec::new());
        assert!(!slot.load().stage_draws_items());

        // con ítems: el render los dibuja por el camino de la audiencia
        assert!(publish_stage_scene(&slot, datos.clone(), vec![bloque("10:00", true)], Vec::new()));
        assert!(slot.load().stage_draws_items());
        assert_eq!(slot.load().text[0].text, "10:00");

        // el reloj del layout cambia cada segundo y no pide transición
        assert!(!publish_stage_scene(&slot, datos.clone(), vec![bloque("10:01", true)], Vec::new()));

        // un layout sin ítems vuelve a `stage_blocks` y no deja texto viejo
        assert!(publish_stage_scene(&slot, datos, Vec::new(), Vec::new()));
        assert!(!slot.load().stage_draws_items());
        assert!(slot.load().text.is_empty());
    }
}
