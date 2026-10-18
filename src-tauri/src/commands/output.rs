//! Comandos del dominio `OUTPUT`: pantallas, ventanas y monitores.
//!
//! `GET_DISPLAYS` se apoya en la API nativa de monitores de Tauri
//! (`available_monitors`). `GET_SCREENS` y `GET_WINDOWS` en Electron usan
//! `desktopCapturer`, que no tiene equivalente directo: aquí se derivan de los
//! monitores disponibles y de las ventanas de la propia app. La captura real de
//! pantalla/ventana (para salidas NDI/streaming) llegará con los sidecars
//! (bloque 7).
//!
//! Las utilidades de rutas del sistema del bloque 4 (`OPEN_LOG`, `OPEN_CACHE`,
//! `OPEN_APPDATA`, `OPEN_FOLDER_PATH`) ya quedaron implementadas en
//! `commands/files.rs`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use serde::Deserialize;
use crate::render::scene::ScenePayload;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn monitor_name(index: usize, name: Option<&String>) -> String {
    match name {
        Some(n) if !n.is_empty() => n.clone(),
        _ => format!("Display {}", index + 1),
    }
}

/// `GET_DISPLAYS`: información de todos los monitores (equivalente a
/// `screen.getAllDisplays()`).
#[tauri::command]
pub fn GET_DISPLAYS(app: AppHandle) -> AppResult<Vec<Value>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::new(e.to_string()))?;

    let mut displays = Vec::new();
    for (index, monitor) in monitors.iter().enumerate() {
        let position = monitor.position();
        let size = monitor.size();
        let bounds = json!({
            "x": position.x,
            "y": position.y,
            "width": size.width,
            "height": size.height,
        });
        displays.push(json!({
            "id": index,
            "label": monitor_name(index, monitor.name()),
            "bounds": bounds,
            "workArea": bounds,
            "size": { "width": size.width, "height": size.height },
            "scaleFactor": monitor.scale_factor(),
        }));
    }
    Ok(displays)
}

/// `GET_SCREENS`: fuentes de captura de pantalla `{ name, id }`.
#[tauri::command]
pub fn GET_SCREENS(app: AppHandle) -> AppResult<Vec<Value>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::new(e.to_string()))?;

    let screens = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            json!({
                "name": monitor_name(index, monitor.name()),
                "id": format!("screen:{index}"),
            })
        })
        .collect();
    Ok(screens)
}

/// `GET_WINDOWS`: fuentes de captura de ventana `{ name, id }` (ventanas de la
/// propia app; el resto requerirá captura nativa en el bloque 7).
#[tauri::command]
pub fn GET_WINDOWS(app: AppHandle) -> AppResult<Vec<Value>> {
    let mut windows = Vec::new();
    for (label, window) in app.webview_windows() {
        let name = window.title().unwrap_or_else(|_| label.clone());
        windows.push(json!({
            "name": name,
            "id": format!("window:{label}"),
        }));
    }
    Ok(windows)
}

// ---------------------------------------------------------------------------
// Ventana nativa de audiencia (Output)
// ---------------------------------------------------------------------------

/// Opciones para abrir la ventana de audiencia.
///
/// Todas son opcionales: sin datos se elige automáticamente el monitor
/// secundario (si existe) y pantalla completa.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OutputWindowOptions {
    /// Índice del monitor donde colocar la salida (por defecto: el secundario).
    pub display: Option<usize>,
    /// Fuerza pantalla completa (`true`) o ventana (`false`). Por defecto: auto
    /// (pantalla completa solo si hay un monitor secundario).
    pub fullscreen: Option<bool>,
}

/// `OPEN_OUTPUT_WINDOW`: crea (o enfoca) la ventana nativa de audiencia, sin webview.
/// Renderiza con el engine WGPU a 60 fps con VSync; devuelve `true` si quedó en pantalla completa.
#[tauri::command]
pub fn OPEN_OUTPUT_WINDOW(app: AppHandle, data: Option<OutputWindowOptions>) -> AppResult<bool> {
    let options = data.unwrap_or_default();
    crate::render::start_native_output(&app, options.display, options.fullscreen)
}

/// `CLOSE_OUTPUT_WINDOW`: detiene el motor GPU y cierra la ventana de audiencia.
#[tauri::command]
pub fn CLOSE_OUTPUT_WINDOW(app: AppHandle) -> AppResult<()> {
    crate::render::stop_native_output(&app)
}

/// `IS_OUTPUT_WINDOW_OPEN`: indica si la ventana de audiencia GPU nativa está abierta.
#[tauri::command]
pub fn IS_OUTPUT_WINDOW_OPEN(app: AppHandle) -> AppResult<bool> {
    Ok(crate::render::is_native_output_open(&app))
}

// ---------------------------------------------------------------------------
// Ventana de Stage (monitores de retorno para músicos/operadores)
// ---------------------------------------------------------------------------

/// `OPEN_STAGE_WINDOW`: abre la ventana nativa de Stage Display en GPU con vista de alto contraste.
#[tauri::command]
pub fn OPEN_STAGE_WINDOW(app: AppHandle, data: Option<OutputWindowOptions>) -> AppResult<bool> {
    let options = data.unwrap_or_default();
    crate::render::start_native_stage(&app, options.display, options.fullscreen)
}

/// `CLOSE_STAGE_WINDOW`: detiene el Stage Display y cierra su ventana nativa.
#[tauri::command]
pub fn CLOSE_STAGE_WINDOW(app: AppHandle) -> AppResult<()> {
    crate::render::stop_native_stage(&app)
}

/// `IS_STAGE_WINDOW_OPEN`: indica si la ventana nativa de Stage está abierta.
#[tauri::command]
pub fn IS_STAGE_WINDOW_OPEN(app: AppHandle) -> AppResult<bool> {
    Ok(crate::render::is_native_stage_open(&app))
}

/// Payload para el comando `TOGGLE_OUTPUTS` de Svelte.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleOutputsPayload {
    pub outputs: Option<Vec<Value>>,
    pub state: bool,
    #[serde(default)]
    pub auto_startup: Option<bool>,
    #[serde(default)]
    pub auto_position: Option<bool>,
}

/// `TOGGLE_OUTPUTS`: abre o cierra las salidas nativas en GPU según el estado indicado.
/// Invocado directamente por Svelte (`src/frontend/components/helpers/output.ts`).
#[tauri::command]
pub fn TOGGLE_OUTPUTS(app: AppHandle, data: ToggleOutputsPayload) -> AppResult<bool> {
    if data.state {
        let mut any_opened = false;
        if let Some(ref outs) = data.outputs {
            for out in outs {
                let is_stage = out.get("stageOutput").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
                    || out.get("stageOutput").and_then(|v| v.as_bool()).unwrap_or(false);
                if is_stage {
                    let _ = crate::render::start_native_stage(&app, None, Some(false));
                } else {
                    let res = crate::render::start_native_output(&app, None, None)?;
                    any_opened = any_opened || res;
                }
            }
        } else {
            any_opened = crate::render::start_native_output(&app, None, None)?;
        }
        Ok(any_opened)
    } else {
        crate::render::stop_native_output(&app)?;
        let _ = crate::render::stop_native_stage(&app);
        Ok(false)
    }
}

/// `OUTPUTS`: comando histórico (`send(OUTPUT, ["OUTPUTS"], data)`) que recibía el store
/// `outputs` completo. Ya no se usa: el frontend envía el Scene Graph con `RENDER_SCENE`.
/// Se mantiene sólo para no fallar si llega un payload viejo; no hace nada.
#[tauri::command]
pub fn OUTPUTS(_data: Value) -> AppResult<()> {
    Ok(())
}

/// `RENDER_SCENE`: aplica el Scene Graph de una salida (`src/types/SceneGraph.ts`).
///
/// Si la salida es de tipo Stage, actualiza el Stage Display; si no, actualiza fondo,
/// texto y transición de la ventana de audiencia.
#[tauri::command]
pub fn RENDER_SCENE(app: AppHandle, data: ScenePayload) -> AppResult<()> {
    if data.stage {
        if crate::render::is_native_stage_open(&app) {
            crate::render::update_stage_data(
                &app,
                crate::render::types::StageData {
                    current_slide: data.plain_text.trim().to_string(),
                    ..Default::default()
                },
            )?;
        }
        return Ok(());
    }

    if let Some(transition) = &data.transition {
        crate::render::set_transition_config(
            &app,
            transition.engine_name(),
            transition.duration_ms,
            transition.easing.as_deref().unwrap_or("easeInOut"),
        )?;
    }

    match data.background_media() {
        Some(bg) => crate::render::apply_scene_background(&app, bg)?,
        None => crate::render::clear_scene_background(&app)?,
    }
    crate::render::update_scene_text(&app, data.text_blocks())?;

    // El Stage Display muestra el texto actual aunque llegue por la salida principal.
    if crate::render::is_native_stage_open(&app) {
        crate::render::update_stage_data(
            &app,
            crate::render::types::StageData {
                current_slide: data.plain_text.trim().to_string(),
                ..Default::default()
            },
        )?;
    }
    Ok(())
}

/// Payload del comando de debug `RENDER_SNAPSHOT`. Espejo en TypeScript:
/// `SnapshotRequest` en `src/types/SceneGraph.ts`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPayload {
    /// Escena a renderizar (el mismo Scene Graph que `RENDER_SCENE`).
    pub scene: ScenePayload,
    /// Ancho en píxeles del PNG (por defecto 1920).
    pub width: Option<u32>,
    /// Alto en píxeles del PNG (por defecto 1080).
    pub height: Option<u32>,
    /// Ruta absoluta donde guardar el PNG.
    pub path: String,
}

/// `RENDER_SNAPSHOT`: renderiza una escena a un PNG offscreen, sin ventana ni
/// monitor. Es la herramienta de verificación visual del engine (tests, CI y
/// depuración desde la consola del webview).
#[tauri::command]
pub fn RENDER_SNAPSHOT(data: SnapshotPayload) -> AppResult<()> {
    crate::render::snapshot::render_snapshot(
        &data.scene,
        data.width.unwrap_or(1920),
        data.height.unwrap_or(1080),
        std::path::Path::new(&data.path),
    )
}

// ---------------------------------------------------------------------------
// Scene Graph: texto, fondo, overlays y transiciones del engine WGPU
// ---------------------------------------------------------------------------

/// `UPDATE_SCENE_TEXT`: actualiza los bloques de texto de la salida nativa en GPU en <1ms.
#[tauri::command]
pub fn UPDATE_SCENE_TEXT(
    app: AppHandle,
    blocks: Vec<crate::render::types::TextBlock>,
) -> AppResult<()> {
    crate::render::update_scene_text(&app, blocks)
}

/// `CLEAR_SCENE_TEXT`: limpia todo el texto proyectado en el motor de GPU.
#[tauri::command]
pub fn CLEAR_SCENE_TEXT(app: AppHandle) -> AppResult<()> {
    crate::render::clear_scene_text(&app)
}

/// `SELECT_SLIDE`: evento de cambio de diapositiva que actualiza el búfer de texto de la GPU en <1ms.
#[tauri::command]
pub fn SELECT_SLIDE(app: AppHandle, data: serde_json::Value) -> AppResult<()> {
    if let Ok(payload) =
        serde_json::from_value::<crate::render::types::SelectSlidePayload>(data.clone())
    {
        if let Some(bg) = payload.background {
            let _ = crate::render::set_scene_background(&app, bg);
        }
        return crate::render::update_scene_text(&app, payload.text_blocks);
    }

    let blocks: Vec<crate::render::types::TextBlock> = if let Ok(b) =
        serde_json::from_value::<Vec<crate::render::types::TextBlock>>(data.clone())
    {
        b
    } else if let Some(arr) = data.get("textBlocks").or_else(|| data.get("items")) {
        serde_json::from_value(arr.clone()).unwrap_or_default()
    } else if let Some(text_str) = data.get("text").and_then(|t| t.as_str()) {
        vec![crate::render::types::TextBlock {
            text: text_str.to_string(),
            font_family: None,
            font_size: 56.0,
            font_weight: 700,
            font_style: None,
            color: [1.0, 1.0, 1.0, 1.0],
            alignment: "center".to_string(),
            x: 100.0,
            y: 200.0,
            width: 1720.0,
            height: 700.0,
            line_height_ratio: 1.25,
            outline_color: Some([0.0, 0.0, 0.0, 1.0]),
            outline_width: Some(2.0),
            shadow_color: Some([0.0, 0.0, 0.0, 0.75]),
            shadow_offset: Some([4.0, 4.0]),
            ..Default::default()
        }]
    } else {
        Vec::new()
    };

    if crate::render::is_native_stage_open(&app) {
        let full_text = blocks.iter().map(|b| b.text.as_str()).collect::<Vec<_>>().join("\n");
        let _ = crate::render::update_stage_data(&app, crate::render::types::StageData {
            current_slide: full_text,
            ..Default::default()
        });
    }

    crate::render::update_scene_text(&app, blocks)
}

/// `SET_BACKGROUND_IMAGE`: establece una imagen de fondo en VRAM para la GPU.
#[tauri::command]
pub fn SET_BACKGROUND_IMAGE(
    app: AppHandle,
    path: String,
    mode: Option<String>,
    opacity: Option<f32>,
) -> AppResult<()> {
    let aspect_mode = match mode.as_deref() {
        Some("contain") => 1,
        Some("stretch") => 2,
        _ => 0, // cover por defecto
    };

    let bg = crate::render::types::BackgroundMedia {
        id: path.clone(),
        path: Some(path),
        media_type: "image".to_string(),
        opacity: opacity.unwrap_or(1.0),
        aspect_mode,
    };

    crate::render::set_scene_background(&app, bg)
}

/// `CLEAR_BACKGROUND`: limpia el fondo de la GPU (vuelve a negro puro).
#[tauri::command]
pub fn CLEAR_BACKGROUND(app: AppHandle) -> AppResult<()> {
    crate::render::clear_scene_background(&app)
}

/// `FEED_VIDEO_FRAME`: transfiere un fotograma de video decodificado a VRAM.
#[tauri::command]
pub fn FEED_VIDEO_FRAME(
    app: AppHandle,
    id: String,
    width: u32,
    height: u32,
    data: Vec<u8>,
) -> AppResult<()> {
    crate::render::feed_video_frame(&app, id, width, height, data)
}

/// `UPDATE_SCENE_OVERLAYS`: actualiza los overlays (relojes, avisos, tercios inferiores).
#[tauri::command]
pub fn UPDATE_SCENE_OVERLAYS(
    app: AppHandle,
    overlays: Vec<crate::render::types::OverlayItem>,
) -> AppResult<()> {
    crate::render::update_scene_overlays(&app, overlays)
}

/// `SET_TRANSITION`: configura la transición activa por GPU (Crossfade, DipToBlack, Wipe, Push) y su duración.
#[tauri::command]
pub fn SET_TRANSITION(
    app: AppHandle,
    transition_type: String,
    duration_ms: Option<u64>,
    easing: Option<String>,
) -> AppResult<()> {
    crate::render::set_transition_config(
        &app,
        &transition_type,
        duration_ms.unwrap_or(300),
        easing.as_deref().unwrap_or("easeInOut"),
    )
}

// ---------------------------------------------------------------------------
// Stage Display y NDI (captura de framebuffer)
// ---------------------------------------------------------------------------

/// `UPDATE_STAGE_DATA`: actualiza la diapositiva actual, siguiente, reloj y mensaje del Stage Display.
#[tauri::command]
pub fn UPDATE_STAGE_DATA(
    app: AppHandle,
    stage_data: crate::render::types::StageData,
) -> AppResult<()> {
    crate::render::update_stage_data(&app, stage_data)
}

/// `START_NDI_NATIVE_FEED`: activa la captura directa de Framebuffer en GPU (`copy_texture_to_buffer`)
/// para transmisión NDI en red local sin consumir CPU.
#[tauri::command]
pub fn START_NDI_NATIVE_FEED(
    app: AppHandle,
    width: Option<u32>,
    height: Option<u32>,
) -> AppResult<()> {
    crate::render::start_ndi_native_feed(&app, width, height)
}

/// `STOP_NDI_NATIVE_FEED`: detiene la captura de Framebuffer de GPU para NDI.
#[tauri::command]
pub fn STOP_NDI_NATIVE_FEED(app: AppHandle) -> AppResult<()> {
    crate::render::stop_ndi_native_feed(&app)
}

/// `IS_NDI_NATIVE_FEED_ACTIVE`: comprueba si la captura directa de Framebuffer NDI está activa.
#[tauri::command]
pub fn IS_NDI_NATIVE_FEED_ACTIVE(app: AppHandle) -> bool {
    crate::render::is_ndi_native_feed_active(&app)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn snapshot_payload_deserializa_desde_json_de_ejemplo() {
        let payload: SnapshotPayload = serde_json::from_value(json!({
            "scene": {
                "outputId": "out1",
                "stage": false,
                "width": 1920,
                "height": 1080,
                "background": null,
                "items": [
                    { "type": "text", "x": 100, "y": 200, "width": 1720, "height": 700,
                      "align": "center", "verticalAlign": "top", "lineHeight": 1.25,
                      "fontSize": 56, "fontWeight": 700, "color": [1, 1, 1, 1],
                      "text": "Hola PulseFlow", "spans": [] }
                ],
                "transition": null,
                "plainText": "Hola PulseFlow"
            },
            "width": 640,
            "height": 360,
            "path": "/tmp/pulseflow-snapshot.png"
        }))
        .expect("payload de snapshot válido");

        assert_eq!(payload.scene.output_id, "out1");
        assert_eq!(payload.width, Some(640));
        assert_eq!(payload.height, Some(360));
        assert_eq!(payload.path, "/tmp/pulseflow-snapshot.png");
        assert_eq!(payload.scene.text_blocks().len(), 1);
    }

    #[test]
    fn snapshot_payload_con_defaults_de_dimension_y_escena_minima() {
        let payload: SnapshotPayload = serde_json::from_value(json!({
            "scene": { "outputId": "out2" },
            "path": "/tmp/s.png"
        }))
        .expect("payload mínimo válido");

        assert_eq!(payload.width, None);
        assert_eq!(payload.height, None);
        assert!(payload.scene.items.is_empty());
    }
}
