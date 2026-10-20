//! F10.7 — Menú nativo de la barra de menús de macOS.
//!
//! En macOS la app no muestra `MenuBar.svelte` (es sólo para Windows), así que
//! las acciones de Pantallas (audiencia, stage, looks) viven acá, junto con el
//! menú de la aplicación (F14.1b: Configuración…, Ocultar, Salir). El primer
//! submenú es el de la app: macOS le pone el nombre de la app como título.
//! El menú se construye con textos en español literal: se arma desde Rust antes
//! de que el frontend esté listo.
//!
//! Los items "En vivo" (looks) se cargan después con [`update_live_menu`],
//! que el frontend invoca cuando cambian `$looks` / `$activeLook`.
//! Cada item emite al frontend `menu-action` con `{ id }`, y el handler vive
//! en `src/frontend/utils/shortcuts.ts`.

#![cfg(target_os = "macos")]

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Wry,
};

/// Item del submenu "En vivo" (un look de la paleta Pantallas).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LiveMenuItem {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub active: bool,
}

fn emit_action(app: &AppHandle<Wry>, id: &str) {
    // Un fallo acá no puede romper la app: sólo significa que aún no hay
    // frontend escuchando.
    let _ = app.emit("menu-action", id.to_string());
}

/// Menú de la aplicación (el primero de la barra en macOS).
///
/// "Configuración…" y "Salir" emiten `app.settings` / `app.quit`: Salir pasa por el
/// flujo de cierre del frontend (guardado) en vez del `quit` predefinido.
fn app_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
    let menu = Submenu::with_id(app, "app", "PulseFlow", true)?;
    menu.append(&PredefinedMenuItem::about(app, Some("Acerca de PulseFlow"), None)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        "app.settings",
        "Configuración…",
        true,
        Some("CmdOrCtrl+,"),
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&PredefinedMenuItem::services(app, None)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&PredefinedMenuItem::hide(app, None)?)?;
    menu.append(&PredefinedMenuItem::hide_others(app, None)?)?;
    menu.append(&PredefinedMenuItem::show_all(app, None)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        "app.quit",
        "Salir de PulseFlow",
        true,
        Some("CmdOrCtrl+Q"),
    )?)?;
    Ok(menu)
}

/// Construye el menú nativo de macOS y lo instala en la app.
///
/// Sólo se llama una vez, al arrancar (`lib.rs`, rama `cfg(target_os =
/// "macos")`).
pub fn install(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let app_submenu = app_menu(app)?;
    let screens = Submenu::with_id(app, "screens", "Pantallas", true)?;
    screens.append(&MenuItem::with_id(
        app,
        "screens.toggle_audience",
        "Mostrar pantallas de audiencia",
        true,
        Some("CmdOrCtrl+1"),
    )?)?;
    screens.append(&MenuItem::with_id(
        app,
        "screens.toggle_stage",
        "Mostrar pantallas de stage",
        true,
        Some("CmdOrCtrl+2"),
    )?)?;
    screens.append(&PredefinedMenuItem::separator(app)?)?;
    screens.append(&MenuItem::with_id(
        app,
        "screens.configure",
        "Configurar pantallas…",
        true,
        Some("CmdOrCtrl+Shift+1"),
    )?)?;
    screens.append(&MenuItem::with_id(
        app,
        "screens.looks",
        "Gestionar looks…",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?)?;
    screens.append(&PredefinedMenuItem::separator(app)?)?;
    let live = Submenu::with_id(app, "screens.live", "En vivo", true)?;
    screens.append(&live)?;

    let menu = Menu::with_items(app, &[&app_submenu, &screens])?;
    app.set_menu(menu)?;
    app.on_menu_event(|app_handle, event| {
        emit_action(app_handle, event.id().as_ref());
    });
    Ok(())
}

/// Reemplaza el contenido del submenu "En vivo" con los looks actuales.
#[tauri::command]
pub fn update_live_menu(app: AppHandle<Wry>, items: Vec<LiveMenuItem>) -> Result<(), String> {
    let menu = app.menu().ok_or("menú nativo no instalado")?;
    let screens = menu
        .items()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|i| i.id() == "screens")
        .and_then(|i| i.as_submenu().cloned())
        .ok_or("'Pantallas' no es un submenu")?;
    let live = screens
        .items()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|i| i.id() == "screens.live")
        .and_then(|i| i.as_submenu().cloned())
        .ok_or("submenu 'En vivo' no encontrado")?;

    // Limpiar los items viejos (hacia atrás para no desplazar índices).
    let old = live.items().map_err(|e| e.to_string())?;
    for item in old.into_iter().rev() {
        live.remove(&item).map_err(|e| e.to_string())?;
    }

    if items.is_empty() {
        live.append(&MenuItem::with_id(
            &app,
            "screens.live.empty",
            "(sin looks todavía)",
            false,
            None::<&str>,
        ).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    for item in items {
        let id = format!("screens.look.{}", item.id);
        use tauri::menu::CheckMenuItem;
        live.append(&CheckMenuItem::with_id(
            &app,
            id,
            item.name,
            true,
            item.active,
            None::<&str>,
        ).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_menu_item_se_deserializa_desde_json() {
        let item: LiveMenuItem =
            serde_json::from_str(r#"{"id":"look-1","name":"Sábado","active":true}"#).unwrap();
        assert_eq!(
            item,
            LiveMenuItem {
                id: "look-1".into(),
                name: "Sábado".into(),
                active: true
            }
        );
    }

    #[test]
    fn live_menu_item_active_es_opcional() {
        let item: LiveMenuItem = serde_json::from_str(r#"{"id":"a","name":"A"}"#).unwrap();
        assert!(!item.active);
    }

    #[test]
    fn live_menu_item_se_serializa_a_json() {
        let item = LiveMenuItem {
            id: "look-2".into(),
            name: "Domingo".into(),
            active: false,
        };
        let json = serde_json::to_string(&item).unwrap();
        assert_eq!(json, r#"{"id":"look-2","name":"Domingo","active":false}"#);
    }
}
