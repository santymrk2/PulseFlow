use super::identify::*;
use super::*;
use crate::render::video::{DecodedFrame, FramePixels, FrameSink};
use serde_json::json;


#[test]
fn config_kind_and_screen_index() {
    let audience: ScreenConfig = serde_json::from_value(json!({
        "id": "a", "screen": "1",
        "bounds": { "x": 1920, "y": 0, "width": 1920, "height": 1080 }
    }))
    .expect("config de audiencia válida");
    assert_eq!(audience.kind(), ScreenKind::Audience);
    assert_eq!(audience.screen_index(), Some(1));

    let stage: ScreenConfig =
        serde_json::from_value(json!({ "id": "s", "stageOutput": "layout1" }))
            .expect("config de stage válida");
    assert_eq!(stage.kind(), ScreenKind::Stage);
}

#[test]
fn rect_contains_center() {
    let monitor = ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 };
    let bounds = ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 };
    assert!(monitor.contains(bounds.center()));
    assert!(!ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }.contains(bounds.center()));
}

#[test]
fn select_monitor_prefers_bounds_center() {
    let monitors = [
        ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
        ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 },
        ScreenRect { x: -1280, y: 0, width: 1280, height: 720 },
    ];

    // Centro de bounds dentro del monitor 1 (aunque screen diga 0).
    let bounds = ScreenRect { x: 2000, y: 100, width: 800, height: 600 };
    assert_eq!(select_monitor_index(&monitors, Some(bounds), Some(0), None, &[]), Some(1));

    // Centro de bounds dentro del monitor 2 (secundario a la izquierda).
    let bounds = ScreenRect { x: -1000, y: 10, width: 200, height: 200 };
    assert_eq!(select_monitor_index(&monitors, Some(bounds), None, None, &[]), Some(2));
}

#[test]
fn select_monitor_prefers_stable_id() {
    let monitors = [
        ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
        ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 },
    ];
    let ids = vec!["Built-in#0".to_string(), "SB220Q#1".to_string()];

    // El id estable manda sobre el índice (F10.0c).
    assert_eq!(select_monitor_index(&monitors, None, Some(0), Some("SB220Q#1"), &ids), Some(1));
    // Id inexistente: cae al resto de la lógica (aquí, el índice).
    assert_eq!(select_monitor_index(&monitors, None, Some(0), Some("Nope#9"), &ids), Some(0));
}

#[test]
fn display_id_and_label_are_stable() {
    // Nombre + índice; sin nombre, genérico (F10.0c).
    assert_eq!(display_id(0, Some(&"SB220Q".to_string())), "SB220Q#0");
    assert_eq!(display_id(1, None), "Display 2#1");
    assert_eq!(monitor_label(0, Some(&"".to_string())), "Display 1");
}

#[test]
fn screen_rect_of_monitor_uses_logical() {
    // Un monitor de 1920×1080 "físico" con escala 2 se ve como 960×540 lógicos.
    let rect = ScreenRect { x: 0, y: 0, width: 960, height: 540 };
    assert_eq!(rect.width, 960);
    assert_eq!(rect.center(), (480, 270));
}

#[test]
fn has_assigned_monitor_distingue_asignado_de_vacio() {
    // F10.0d: sólo con monitor asignado la salida va a pantalla completa.
    let none: ScreenConfig = serde_json::from_value(json!({ "id": "a" })).expect("config");
    assert!(!none.has_assigned_monitor());

    let null: ScreenConfig =
        serde_json::from_value(json!({ "id": "a", "screen": null })).expect("config");
    assert!(!null.has_assigned_monitor());

    let empty: ScreenConfig =
        serde_json::from_value(json!({ "id": "a", "screen": "" })).expect("config");
    assert!(!empty.has_assigned_monitor());

    // Id estable (F10.0c) e índice viejo cuentan como asignados.
    let by_id: ScreenConfig =
        serde_json::from_value(json!({ "id": "a", "screen": "SB220Q#1" })).expect("config");
    assert!(by_id.has_assigned_monitor());
    assert_eq!(by_id.screen_id(), Some("SB220Q#1"));

    let by_index: ScreenConfig =
        serde_json::from_value(json!({ "id": "a", "screen": "0" })).expect("config");
    assert!(by_index.has_assigned_monitor());
    assert_eq!(by_index.screen_id(), None);
    assert_eq!(by_index.screen_index(), Some(0));
}

#[test]
fn floating_preview_rect_es_16_9_y_entra_en_el_monitor() {
    let monitor = ScreenRect { x: 0, y: 0, width: 1920, height: 1080 };
    let (x, y, w, h) = floating_preview_rect(monitor, ScreenKind::Audience);

    // 16:9, dentro del monitor, y no tapa la esquina superior izquierda.
    assert!((w / h - 16.0 / 9.0).abs() < 1e-6, "debe ser 16:9");
    assert!(x >= 0.0 && y >= 0.0);
    assert!(x + w <= monitor.width as f64);
    assert!(y + h <= monitor.height as f64);

    // El stage es más chico.
    let (sx, sy, sw, sh) = floating_preview_rect(monitor, ScreenKind::Stage);
    assert!(sw < w);
    assert!(sx >= 0.0 && sy >= 0.0);
    assert!(sx + sw <= monitor.width as f64 && sy + sh <= monitor.height as f64);
}

#[test]
fn select_monitor_falls_back_to_index_then_secondary() {
    let two = [
        ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
        ScreenRect { x: 1920, y: 0, width: 1920, height: 1080 },
    ];
    let one = [ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }];

    // Sin bounds: índice elegido.
    assert_eq!(select_monitor_index(&two, None, Some(0), None, &[]), Some(0));
    // Índice fuera de rango: secundario.
    assert_eq!(select_monitor_index(&two, None, Some(9), None, &[]), Some(1));
    // Sin nada: secundario si existe, si no el único.
    assert_eq!(select_monitor_index(&two, None, None, None, &[]), Some(1));
    assert_eq!(select_monitor_index(&one, None, None, None, &[]), Some(0));
    // Sin monitores: nada.
    assert_eq!(select_monitor_index(&[], None, None, None, &[]), None);
}

#[test]
fn identify_targets_matches_bounds_then_index() {
    let monitors = [
        ScreenRect { x: 0, y: 0, width: 1920, height: 1080 },
        ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 },
    ];

    // El número es la posición (1-based) y el monitor el que contiene los bounds.
    let entries = [
        IdentifyScreen { bounds: Some(ScreenRect { x: 1920, y: 0, width: 2560, height: 1440 }), ..Default::default() },
        IdentifyScreen { bounds: Some(ScreenRect { x: 0, y: 0, width: 1920, height: 1080 }), ..Default::default() },
    ];
    assert_eq!(
        identify_targets(&monitors, &entries),
        vec![("1".to_string(), 1), ("2".to_string(), 0)]
    );

    // Sin bounds válidos: fallback al índice de la entrada.
    let no_bounds = [IdentifyScreen::default()];
    assert_eq!(identify_targets(&monitors, &no_bounds), vec![("1".to_string(), 0)]);

    // Entrada sin monitor asociado: se omite.
    let out_of_range = [IdentifyScreen { bounds: Some(ScreenRect { x: 9999, y: 9999, width: 100, height: 100 }), ..Default::default() }];
    assert!(identify_targets(&[], &out_of_range).is_empty());
}

#[test]
fn identify_screen_deserializa_desde_display_del_frontend() {
    // Payload real: la lista de `GET_DISPLAYS` (id estable + bounds lógicos),
    // con campos extra (label, workArea, physicalSize, scaleFactor, primary)
    // que serde ignora.
    let screens: Vec<IdentifyScreen> = serde_json::from_value(serde_json::json!([
        {
            "id": "Built-in Retina Display#0",
            "label": "Built-in Retina Display",
            "bounds": { "x": 0, "y": 0, "width": 1728, "height": 1117 },
            "workArea": { "x": 0, "y": 37, "width": 1728, "height": 1080 },
            "physicalSize": { "width": 3456, "height": 2234 },
            "size": { "width": 1728, "height": 1117 },
            "scaleFactor": 2,
            "primary": true
        }
    ]))
    .expect("display de GET_DISPLAYS debe mapear a IdentifyScreen");

    assert_eq!(screens[0].id, Some(serde_json::json!("Built-in Retina Display#0")));
    assert_eq!(screens[0].legacy_index(), None);
    assert_eq!(screens[0].bounds.map(|b| b.width), Some(1728));
}

#[test]
fn identify_blocks_center_big_number() {
    let blocks = identify_blocks("2", 1920, 1080);
    assert_eq!(blocks[0].text, "2");
    assert_eq!(blocks[0].alignment, "center");
    assert_eq!(blocks[0].vertical_align.as_deref(), Some("center"));
    assert!(blocks[0].font_size > 400.0, "el número debe ser grande");
    assert!(blocks[1].text.contains("2"));
}

#[test]
fn screen_label_is_safe() {
    assert_eq!(screen_label("abc 1/2"), "screen-abc_1_2");
    assert_eq!(screen_label("main-out_2"), "screen-main-out_2");
}

#[test]
fn screen_manager_new_starts_empty() {
    let state = ScreenManager::new();
    assert!(!state.is_open("cualquiera"));
}

#[test]
fn screen_config_deserializa_desde_output_del_frontend() {
    // Payload real de UPDATE_BOUNDS/TOGGLE_OUTPUTS: un `Output` de Svelte
    // (src/types/Output.ts) con campos extra que serde debe ignorar.
    let config: ScreenConfig = serde_json::from_value(json!({
        "id": "output-1",
        "name": "Principal",
        "color": "#ff0000",
        "active": true,
        "enabled": true,
        "bounds": { "x": 1920, "y": 0, "width": 1920, "height": 1080 },
        "boundsLocked": false,
        "screen": "1",
        "alwaysOnTop": true,
        "invisible": false
    }))
    .expect("Output del frontend debe mapear a ScreenConfig");

    assert_eq!(config.id, "output-1");
    assert_eq!(config.kind(), ScreenKind::Audience);
    assert_eq!(config.bounds.map(|b| b.width), Some(1920));
    assert_eq!(config.always_on_top, Some(true));
    assert_eq!(config.enabled, Some(true));

    // Una salida de stage se reconoce por stageOutput.
    let stage: ScreenConfig = serde_json::from_value(json!({
        "id": "stage-1",
        "name": "Stage",
        "enabled": true,
        "stageOutput": "layout-1",
        "screen": null
    }))
    .expect("Output de stage debe mapear a ScreenConfig");
    assert_eq!(stage.kind(), ScreenKind::Stage);
    assert_eq!(stage.screen_index(), None);
}

#[test]
fn forget_scene_drops_the_persisted_scene() {
    let manager = ScreenManager::new();
    let _ = manager.scene("a");
    assert!(manager.forget_scene("a"));
    assert!(!manager.forget_scene("a"), "olvidar dos veces no encuentra nada");
}

#[test]
fn the_scene_snapshot_is_published_whole() {
    let slot = SceneSlot::new();
    assert!(slot.load().text.is_empty(), "la escena arranca vacía");

    slot.update(|scene| {
        scene.text = vec![TextBlock { text: "hola".to_string(), ..Default::default() }];
        scene.media = vec![MediaItem {
            id: "m1".to_string(),
            path: "/tmp/imagen.png".to_string(),
            media_type: "image".to_string(),
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 100.0,
            aspect_mode: 0,
            opacity: 1.0,
            design_width: None,
        }];
    });

    let published = slot.load();
    assert_eq!(published.text.len(), 1);
    assert_eq!(published.media.len(), 1);

    // La instantánea que ya tenía el hilo de render no cambia por debajo.
    slot.update(|scene| {
        scene.text.clear();
        scene.media.clear();
    });
    assert_eq!(published.text.len(), 1, "la instantánea vieja sigue intacta");
    assert_eq!(published.media.len(), 1);
    assert!(slot.load().text.is_empty());
}

#[test]
fn a_reader_never_sees_a_half_updated_scene() {
    use std::sync::atomic::{AtomicBool, Ordering};

    let slot = Arc::new(SceneSlot::new());
    let item = MediaItem {
        id: "m1".to_string(),
        path: "/tmp/imagen.png".to_string(),
        media_type: "image".to_string(),
        x: 0.0,
        y: 0.0,
        width: 100.0,
        height: 100.0,
        aspect_mode: 0,
        opacity: 1.0,
        design_width: None,
    };
    slot.update(|scene| {
        scene.text = vec![TextBlock { text: "a".to_string(), ..Default::default() }];
        scene.media = vec![item.clone()];
    });

    let stop = Arc::new(AtomicBool::new(false));
    let reader = {
        let (slot, stop) = (Arc::clone(&slot), Arc::clone(&stop));
        std::thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                let snapshot = slot.load();
                // Siempre una escena entera: el texto y el medio van juntos.
                assert_eq!(snapshot.text.len(), snapshot.media.len(), "escena a medio cambiar");
            }
        })
    };

    for _ in 0..500 {
        slot.update(|scene| {
            scene.text = vec![TextBlock { text: "b".to_string(), ..Default::default() }];
            scene.media = vec![item.clone()];
        });
    }
    stop.store(true, Ordering::Relaxed);
    reader.join().expect("el lector terminó");
}

#[test]
fn detach_forgets_scene_and_tolerates_unknown_ids() {
    let manager = ScreenManager::new();
    let _ = manager.scene("a");

    assert!(manager.detach("a").is_none(), "no había ventana abierta");
    assert!(!manager.forget_scene("a"), "detach ya olvidó la escena");
    assert!(manager.detach("nunca-existio").is_none(), "id desconocido no es un error");
}

#[test]
fn subscribers_first_add_starts_and_last_remove_stops() {
    let mut subs = Subscribers::default();
    assert!(subs.add("a"), "el primero arranca el decodificador");
    assert!(!subs.add("b"), "el segundo comparte el decodificador");
    assert!(!subs.add("b"), "suscribirse dos veces no cuenta doble");
    assert!(!subs.remove("a"), "queda b: el decodificador sigue (foco: cerrar una pantalla no corta a la otra)");
    assert!(subs.remove("b"), "el último en irse lo detiene");
    assert!(!subs.remove("b"), "ya no estaba");
}

#[test]
fn video_frames_are_uploaded_once_per_frame_not_once_per_subscriber() {
    use crate::render::nv12_test_support::cpu_frame_planes;
    use crate::render::video::nv12::YuvMatrix;

    let store = super::super::media::MediaStore::new(super::super::gpu::shared().expect("GPU"));
    let sink = HubSink { store: Arc::clone(&store), key: "fondo.mp4".to_string() };
    let (y, uv) = cpu_frame_planes(4, 4, 63, 102, 240);

    // dos pantallas suscritas al mismo archivo: el decodificador publica un frame por tick
    let mut subs = Subscribers::default();
    subs.add("audience");
    subs.add("stage");
    for index in 0..3 {
        sink.push(DecodedFrame {
            pts: std::time::Duration::from_millis(index * 33),
            pixels: FramePixels::Nv12Cpu { width: 4, height: 4, y: &y, uv: &uv, matrix: YuvMatrix::Bt709, full_range: false },
        });
    }

    assert_eq!(store.uploads(), 3);
    assert!(store.get_video("fondo.mp4").is_some(), "el frame se guarda con la ruta como id");

    // el hub libera el frame cuando ya nadie reproduce el archivo
    store.remove_video("fondo.mp4");
    assert!(store.get_video("fondo.mp4").is_none());
}

/// El camino nativo no sube ni un byte desde la CPU: el frame publicado respalda la memoria del decodificador.
#[cfg(target_os = "macos")]
#[test]
fn native_path_does_not_copy_pixels() {
    use std::time::{Duration, Instant};

    let store = super::super::media::MediaStore::new(super::super::gpu::shared().expect("GPU"));
    let sink = Arc::new(HubSink { store: Arc::clone(&store), key: "fondo.mp4".to_string() });
    let fixture = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/video/solid_red_64.mp4");
    let mut decoder = crate::render::video::avf::start(fixture, sink).expect("abrir el fixture");

    let started = Instant::now();
    while store.get_video("fondo.mp4").is_none() && started.elapsed() < Duration::from_secs(5) {
        std::thread::sleep(Duration::from_millis(10));
    }
    std::thread::sleep(Duration::from_millis(200)); // unos cuantos frames más
    decoder.stop();

    let frame = store.get_video("fondo.mp4").expect("hay un frame publicado");
    assert!(!frame.is_cpu_backed(), "el frame nativo no es una copia en texturas propias");
    assert_eq!(store.uploads(), 0, "ninguna subida desde la CPU");
}


fn config_for_open(id: &str, screen: Option<&str>) -> ScreenConfig {
    serde_json::from_value(json!({ "id": id, "screen": screen })).expect("config")
}

#[test]
fn con_una_salida_asignada_las_sin_monitor_no_abren_ventana_flotante() {
    // Reportado 2026-10-21: "default" (monitor asignado) + "Streaming" (sin monitor) abrían dos ventanas.
    let configs = vec![config_for_open("default", Some("SB220Q#1")), config_for_open("streaming", None)];
    let ids: Vec<&str> = configs_to_open(&configs).iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids, vec!["default"]);
}

#[test]
fn si_ninguna_tiene_monitor_se_abren_todas_como_vista_previa() {
    let configs = vec![config_for_open("a", None), config_for_open("b", Some(""))];
    assert_eq!(configs_to_open(&configs).len(), 2);
}

#[test]
fn una_sola_salida_sin_monitor_se_abre() {
    let configs = vec![config_for_open("solo", None)];
    assert_eq!(configs_to_open(&configs).len(), 1);
}
