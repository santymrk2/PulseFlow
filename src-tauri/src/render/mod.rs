//! PulseFlow Native Render Engine (WGPU)
//!
//! Este módulo implementa la renderización en GPU nativa sin Webview,
//! utilizando WGPU para macOS (Metal) y Windows (DirectX 12/Vulkan).
//!
//! **Fachada**: declara los módulos del engine y re-exporta su API pública.
//! El ciclo de vida de las ventanas y escenas vive en `screens`
//! (`ScreenManager`, una pantalla por salida); el layout de stage en `stage`;
//! texto, media, video y transiciones en sus propios módulos.

pub mod gpu;
pub mod media;
pub mod scene;
pub mod screens;
pub mod snapshot;
pub mod stage;
pub mod sync;
pub mod text;
pub mod transition;
pub mod types;
pub mod video;

// F4.2: tests del contrato Scene Graph contra los fixtures del frontend.
#[cfg(test)]
mod scene_contract;

// F4.3: golden tests visuales del engine contra PNG de referencia.
#[cfg(test)]
mod golden;

pub use screens::{
    close_all_screens, close_screen, emit_output_state, identify_screens, open_ids, open_screen,
    remove_screen, reposition_screen, set_audience_scene, set_scene_background, set_scene_media, set_scene_text,
    set_stage_scene, set_transition_config, IdentifyScreen, ScreenConfig, ScreenKind, ScreenManager,
    ScreenRect,
};
pub use types::{BackgroundMedia, MediaItem, OverlayItem, StageData, TextBlock};

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn test_wgpu_instance_and_adapter() {
        let gpu = gpu::shared().expect("Debe existir al menos un adaptador GPU disponible");
        let info = gpu.adapter.get_info();
        println!("GPU detectada para PulseFlow: {} ({:?})", info.name, info.backend);
        assert!(!info.name.is_empty());
    }

    #[test]
    fn test_font_atlas_and_text_block() {
        let atlas = text::FontAtlas::new();
        assert!(atlas.font_system.db().len() > 0, "Debe cargar fuentes del sistema");

        let block = TextBlock {
            text: "Dios es amor y gracia eterna".to_string(),
            font_family: Some("Inter".to_string()),
            font_size: 64.0,
            font_weight: 700,
            font_style: None,
            color: [1.0, 1.0, 1.0, 1.0],
            alignment: "center".to_string(),
            x: 100.0,
            y: 200.0,
            width: 1720.0,
            height: 800.0,
            line_height_ratio: 1.3,
            outline_color: Some([0.0, 0.0, 0.0, 1.0]),
            outline_width: Some(2.0),
            shadow_color: Some([0.0, 0.0, 0.0, 0.7]),
            shadow_offset: Some([4.0, 4.0]),
            ..Default::default()
        };

        assert_eq!(block.font_size, 64.0);
        assert_eq!(block.outline_width, Some(2.0));
    }

    #[test]
    fn test_media_store_reuses_video_texture() {
        let store = media::MediaStore::new(gpu::shared().unwrap());

        // Crear una textura sintética de prueba 64x64 RGBA en VRAM
        let width = 64;
        let height = 64;
        let rgba_data = vec![255u8; (width * height * 4) as usize];

        let tex1 = store.update_video_frame("test_video_bg", width, height, &rgba_data).unwrap();

        // Verificar que una segunda consulta reutilice el mismo Arc en VRAM sin duplicar
        let tex2 = store.get("test_video_bg").unwrap();
        assert_eq!(Arc::as_ptr(&tex1), Arc::as_ptr(&tex2), "Ambas referencias deben apuntar al mismo recurso VRAM");
    }

    #[test]
    fn test_transition_engine_and_curves() {
        let gpu = gpu::shared().unwrap();

        let mut engine = transition::TransitionEngine::new(
            &gpu.device,
            wgpu::TextureFormat::Bgra8UnormSrgb,
            1920,
            1080,
        );

        // Crossfade con duración: hay que animar y copiar el fotograma anterior.
        assert!(engine.trigger(transition::TransitionType::Crossfade, 500, transition::EasingType::EaseInOut));
        assert!(engine.active_transition.is_active);
        assert_eq!(engine.active_transition.transition_type, transition::TransitionType::Crossfade);

        // Corte: no hay nada que copiar ni animar, el resultado ya es el buffer nuevo.
        assert!(!engine.trigger(transition::TransitionType::None, 500, transition::EasingType::EaseInOut));
        assert!(!engine.active_transition.is_active);
    }

    #[test]
    fn test_stage_display_data_and_layout() {
        let stage_data = StageData {
            current_slide: "Sublime gracia del Señor\nQue a un pecador salvó".to_string(),
            next_slide: Some("Fui ciego mas hoy veo yo\nPerdido y Él me halló".to_string()),
            clock: Some("11:45 AM".to_string()),
            message: Some("Pastor listo para predicar".to_string()),
        };

        let blocks = stage::stage_blocks(&stage_data, 1920.0, 1080.0);
        assert_eq!(blocks.len(), 4);
        assert_eq!(blocks[0].text, "11:45 AM");
        assert_eq!(blocks[1].text, stage_data.current_slide);
        assert_eq!(blocks[3].text, "Pastor listo para predicar");
    }
}
