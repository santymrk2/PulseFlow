//! Comandos del dominio `OUTPUT`: pantallas, ventanas y monitores.
//!
//! `GET_DISPLAYS` se apoya en la API nativa de monitores de Tauri
//! (`available_monitors`). `GET_SCREENS` y `GET_WINDOWS` en Electron usan
//! `desktopCapturer`, que no tiene equivalente directo: aquí se derivan de los
//! monitores disponibles y de las ventanas de la propia app. La captura real de
//! pantalla/ventana (para salidas NDI/streaming).
//!
//! Las utilidades de rutas del sistema (`OPEN_LOG`, `OPEN_CACHE`, `OPEN_APPDATA`,
//! `OPEN_FOLDER_PATH`) quedaron implementadas en `commands/files.rs`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::render::scene::ScenePayload;
use crate::render::{IdentifyScreen, ScreenConfig};
use serde::Deserialize;
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

/// `UPDATE_BOUNDS`: reubica una pantalla abierta cuando el usuario mueve o
/// redimensiona sus bounds en "Elegir pantalla" (`Screens.svelte`). No abre la
/// pantalla si está cerrada. El payload es un `Output` de Svelte con id
/// (espejo en TypeScript: `Output` en `src/types/Output.ts`).
#[tauri::command]
pub fn UPDATE_BOUNDS(app: AppHandle, data: ScreenConfig) -> AppResult<()> {
    crate::render::reposition_screen(&app, &data)
}

/// `IDENTIFY_SCREENS`: ventana temporal (3 s) por monitor con su número
/// grande, usando el mismo bucle de render. El payload es la lista de
/// `GET_DISPLAYS` (espejo en TypeScript: `IdentifyScreen` en
/// `src/types/Output.ts`); sin payload se numeran todos los monitores.
#[tauri::command]
pub fn IDENTIFY_SCREENS(app: AppHandle, data: Option<Vec<IdentifyScreen>>) -> AppResult<()> {
    crate::render::identify_screens(&app, &data.unwrap_or_default())
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

/// `TOGGLE_OUTPUTS`: abre o cierra las pantallas indicadas según el estado.
/// Cada salida del payload es un `Output` de Svelte; su `stageOutput` define el
/// tipo de pantalla. Invocado por Svelte (`src/frontend/components/helpers/output.ts`).
#[tauri::command]
pub fn TOGGLE_OUTPUTS(app: AppHandle, data: ToggleOutputsPayload) -> AppResult<bool> {
    if data.state {
        let mut any_opened = false;
        if let Some(ref outs) = data.outputs {
            let mut states: Vec<(String, bool)> = Vec::new();
            for out in outs {
                let Ok(config) = serde_json::from_value::<ScreenConfig>(out.clone()) else {
                    continue;
                };
                if !config.enabled.unwrap_or(true) {
                    continue;
                }
                crate::render::open_screen(&app, &config)?;
                states.push((config.id.clone(), true));
                any_opened = true;
            }
            if !states.is_empty() {
                crate::render::screens::emit_output_state(&app, &states);
            }
        } else {
            let config = ScreenConfig {
                id: "main".to_string(),
                name: "Audiencia".to_string(),
                always_on_top: Some(true),
                ..Default::default()
            };
            crate::render::open_screen(&app, &config)?;
            crate::render::screens::emit_output_state(&app, &[(config.id.clone(), true)]);
            any_opened = true;
        }
        Ok(any_opened)
    } else {
        let ids = crate::render::open_ids(&app);
        crate::render::close_all_screens(&app)?;
        let states: Vec<(String, bool)> = ids.into_iter().map(|id| (id, false)).collect();
        if !states.is_empty() {
            crate::render::screens::emit_output_state(&app, &states);
        }
        Ok(false)
    }
}

/// `RENDER_SCENE`: aplica el Scene Graph de una salida (`src/types/SceneGraph.ts`).
///
/// El frontend envía un comando por cada salida habilitada (audiencia y stage)
/// con su `outputId`; la escena se guarda en `ScreenManager` **por id de salida**,
/// así que persiste aunque la pantalla esté cerrada. Si `stage` es falso es
/// escena de audiencia (fondo + texto); si no, es escena de stage y se usa
/// `plainText`/`nextText`. La transición sigue siendo global hasta F3.
#[tauri::command]
pub fn RENDER_SCENE(app: AppHandle, data: ScenePayload) -> AppResult<()> {
    data.validate_version()?;

    if let Some(transition) = &data.transition {
        crate::render::set_transition_config(
            &app,
            transition.engine_name(),
            transition.duration_ms,
            transition.easing.as_deref().unwrap_or("easeInOut"),
        )?;
    }

    if data.stage {
        let next_slide = data.next_text.as_ref().map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
        return crate::render::set_stage_scene(
            &app,
            &data.output_id,
            crate::render::types::StageData {
                current_slide: data.plain_text.trim().to_string(),
                next_slide,
                ..Default::default()
            },
        );
    }

    crate::render::set_audience_scene(
        &app,
        &data.output_id,
        data.text_blocks(),
        data.background_media(),
    )?;

    Ok(())
}

/// Payload del comando de debug `RENDER_SNAPSHOT`. Espejo en TypeScript:
/// `SnapshotRequest` en `src/types/SceneGraph.ts`.
///
/// El comando existe sólo en builds de desarrollo (`debug_assertions`): no se
/// compila en `tauri build`, así que una release no expone esta superficie.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg(debug_assertions)]
pub struct SnapshotPayload {
    /// Escena a renderizar (el mismo Scene Graph que `RENDER_SCENE`).
    pub scene: ScenePayload,
    /// Ancho en píxeles del PNG (por defecto 1920).
    pub width: Option<u32>,
    /// Alto en píxeles del PNG (por defecto 1080).
    pub height: Option<u32>,
    /// Nombre simple del archivo PNG (sin ruta); queda en `<cache>/snapshots/`.
    pub file_name: String,
}

/// `RENDER_SNAPSHOT` (sólo desarrollo): renderiza una escena a un PNG
/// offscreen, sin ventana ni monitor. Es la herramienta de verificación visual
/// del engine (tests, CI y depuración desde la consola del webview). Recibe
/// sólo un nombre de archivo y devuelve la ruta completa escrita.
#[tauri::command]
#[cfg(debug_assertions)]
pub fn RENDER_SNAPSHOT(app: AppHandle, data: SnapshotPayload) -> AppResult<String> {
    data.scene.validate_version()?;
    let base_dir = app.path().app_cache_dir()?;
    let path = crate::render::snapshot::render_snapshot(
        &data.scene,
        data.width.unwrap_or(1920),
        data.height.unwrap_or(1080),
        &base_dir,
        &data.file_name,
    )?;
    Ok(path.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// Stage Display y NDI (captura de framebuffer)
// ---------------------------------------------------------------------------

/// `START_NDI_NATIVE_FEED`: activa la captura directa de Framebuffer en GPU (`copy_texture_to_buffer`)
/// para transmisión NDI en red local sin consumir CPU.
#[tauri::command]
pub fn START_NDI_NATIVE_FEED(
    app: AppHandle,
    width: Option<u32>,
    height: Option<u32>,
) -> AppResult<()> {
    crate::render::ndi_stream::start_feed(&app, width, height)
}

/// `STOP_NDI_NATIVE_FEED`: detiene la captura de Framebuffer de GPU para NDI.
#[tauri::command]
pub fn STOP_NDI_NATIVE_FEED(app: AppHandle) -> AppResult<()> {
    crate::render::ndi_stream::stop_feed(&app)
}

/// `IS_NDI_NATIVE_FEED_ACTIVE`: comprueba si la captura directa de Framebuffer NDI está activa.
#[tauri::command]
pub fn IS_NDI_NATIVE_FEED_ACTIVE(app: AppHandle) -> bool {
    crate::render::ndi_stream::is_feed_active(&app)
}

#[cfg(all(test, debug_assertions))]
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
            "fileName": "escena-manual"
        }))
        .expect("payload de snapshot válido");

        assert_eq!(payload.scene.output_id, "out1");
        assert_eq!(payload.width, Some(640));
        assert_eq!(payload.height, Some(360));
        assert_eq!(payload.file_name, "escena-manual");
        assert_eq!(payload.scene.text_blocks().len(), 1);
    }

    #[test]
    fn snapshot_payload_con_defaults_de_dimension_y_escena_minima() {
        let payload: SnapshotPayload = serde_json::from_value(json!({
            "scene": { "outputId": "out2" },
            "fileName": "s"
        }))
        .expect("payload mínimo válido");

        assert_eq!(payload.width, None);
        assert_eq!(payload.height, None);
        assert!(payload.scene.items.is_empty());
    }
}
