//! Cierre de la app (F23.8): botón rojo / ✕, Cmd+Q, Dock y apagado del sistema pasan siempre por el
//! guardado del frontend (`initializeClosing`), y al salir se detienen las salidas y los decodificadores.

use crate::render::sync::MutexExt;
use crate::state::AppState;
use serde_json::json;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Window, WindowEvent};

/// Tiempo en el que se asume que el frontend sigue guardando o mostrando el popup.
const WAIT_FOR_FRONTEND: Duration = Duration::from_secs(10);
/// Pasado este tiempo, un pedido de cierre anterior ya no cuenta.
const CLOSE_REQUEST_EXPIRES: Duration = Duration::from_secs(60);

#[derive(Debug, PartialEq, Eq)]
pub enum CloseDecision {
    AskFrontend,
    Wait,
    AllowNow,
}

/// Decide qué hacer ante un pedido de cierre. Un segundo pedido (doble clic) mientras el frontend guarda
/// no debe cortar la escritura: se espera 10 s; si el frontend no cerró, se sale igual (salida de emergencia).
pub fn close_decision(now: Instant, last_request: Option<Instant>) -> CloseDecision {
    let Some(last) = last_request else {
        return CloseDecision::AskFrontend;
    };
    let elapsed = now.saturating_duration_since(last);
    if elapsed < WAIT_FOR_FRONTEND {
        CloseDecision::Wait
    } else if elapsed < CLOSE_REQUEST_EXPIRES {
        CloseDecision::AllowNow
    } else {
        CloseDecision::AskFrontend
    }
}

/// Sólo la ventana de `tauri.conf.json` pasa por el guardado; las salidas no se interceptan.
pub fn is_main_window(label: &str) -> bool {
    label == "main"
}

/// Detiene decodificadores y cierra las salidas; sale aunque eso falle.
pub fn exit_now(app: &AppHandle) {
    if let Err(err) = crate::render::close_all_screens(app) {
        log::error!("no se pudieron cerrar las salidas al salir: {err}");
    }
    app.exit(0);
}

/// Aplica la decisión. Devuelve `true` si hay que cancelar el cierre/salida.
fn handle_close_request(app: &AppHandle) -> bool {
    let now = Instant::now();
    let decision = {
        let state = app.state::<AppState>();
        let mut last = state.close_requested_at.lock_safe();
        let decision = close_decision(now, *last);
        if decision == CloseDecision::AskFrontend {
            *last = Some(now);
        }
        decision
    };
    match decision {
        CloseDecision::AskFrontend => {
            if let Err(err) = app.emit("MAIN", json!({ "channel": "CLOSE", "data": false })) {
                log::error!("no se pudo pedir el cierre al frontend: {err}");
            }
            true
        }
        CloseDecision::Wait => true,
        CloseDecision::AllowNow => {
            exit_now(app);
            true
        }
    }
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event
        && is_main_window(window.label())
    {
        api.prevent_close();
        handle_close_request(window.app_handle());
    }
}

pub fn on_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::ExitRequested {
        code: None, api, ..
    } = event
    {
        api.prevent_exit();
        handle_close_request(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ago(now: Instant, secs: u64) -> Instant {
        now.checked_sub(Duration::from_secs(secs)).expect("reloj")
    }

    #[test]
    fn primer_pedido_pregunta_al_frontend() {
        assert_eq!(
            close_decision(Instant::now(), None),
            CloseDecision::AskFrontend
        );
    }

    #[test]
    fn segundo_pedido_cercano_espera() {
        let now = Instant::now();
        assert_eq!(close_decision(now, Some(ago(now, 3))), CloseDecision::Wait);
    }

    #[test]
    fn segundo_pedido_tras_10s_cierra() {
        let now = Instant::now();
        assert_eq!(
            close_decision(now, Some(ago(now, 10))),
            CloseDecision::AllowNow
        );
        assert_eq!(
            close_decision(now, Some(ago(now, 15))),
            CloseDecision::AllowNow
        );
    }

    #[test]
    fn pedido_vencido_vuelve_a_preguntar() {
        let now = Instant::now();
        assert_eq!(
            close_decision(now, Some(ago(now, 60))),
            CloseDecision::AskFrontend
        );
        assert_eq!(
            close_decision(now, Some(ago(now, 90))),
            CloseDecision::AskFrontend
        );
    }

    #[test]
    fn solo_la_ventana_principal() {
        assert!(is_main_window("main"));
        assert!(!is_main_window("native-output-abc"));
    }
}
