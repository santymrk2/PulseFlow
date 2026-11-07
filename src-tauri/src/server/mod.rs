//! Servidor interno REST + WebSocket (reemplazo de Express.js + Socket.io).
//!
//! Levanta uno o varios servidores Axum (uno por dominio de cliente:
//! `remote`, `stage`, `controller`, `output_stream`) que:
//!
//! - sirven los archivos estáticos del cliente correspondiente,
//! - exponen endpoints REST (`/api/status`, `/api/data`),
//! - aceptan conexiones WebSocket en `/ws`, agrupadas por *sala* (el dominio del
//!   servidor), y difunden mensajes (*broadcast*) a todos los clientes de la sala.
//!
//! El ciclo de vida (START/STOP) se controla desde `commands::servers`, que
//! guarda en este módulo un canal de apagado. Las mismas funciones de difusión
//! (`broadcast_to_room`) pueden invocarse desde cualquier comando de la app para
//! reenviar cambios (diapositiva, `STARTUP`, …) a los controles remotos.

use crate::error::{AppError, AppResult};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;
use tower_http::services::ServeDir;

/// Dominios de servidor soportados y sus puertos por defecto.
pub const DEFAULT_PORTS: &[(&str, u16)] = &[
    ("remote", 5510),
    ("stage", 5511),
    ("controller", 5512),
    ("output_stream", 5513),
];

/// Número máximo de conexiones simultáneas por defecto.
const DEFAULT_MAX: usize = 10;

/// Mensaje difundido a una sala concreta.
#[derive(Clone)]
pub struct RoomEvent {
    pub room: String,
    pub message: Value,
}

/// Estado compartido inyectado en los handlers de Axum.
#[derive(Clone)]
struct RoomShared {
    app: AppHandle,
    room: String,
    data: Arc<Value>,
    connections: Arc<AtomicUsize>,
    max: usize,
    events: broadcast::Sender<RoomEvent>,
}

/// Handle del servidor en ejecución (permite detenerlo).
struct ServerRuntime {
    shutdown: broadcast::Sender<()>,
    events: broadcast::Sender<RoomEvent>,
}

static RUNTIME: OnceLock<Mutex<Option<ServerRuntime>>> = OnceLock::new();

fn runtime_cell() -> &'static Mutex<Option<ServerRuntime>> {
    RUNTIME.get_or_init(|| Mutex::new(None))
}

/// Difunde un mensaje a todos los clientes de una sala.
pub fn broadcast_to_room(room: &str, message: Value) {
    if let Ok(guard) = runtime_cell().lock()
        && let Some(runtime) = guard.as_ref() {
            let _ = runtime.events.send(RoomEvent {
                room: room.to_string(),
                message,
            });
        }
}

/// Difunde un mensaje a todos los clientes de todas las salas.
pub fn broadcast_all(message: Value) {
    for (room, _) in DEFAULT_PORTS {
        broadcast_to_room(room, message.clone());
    }
}

/// Raíces donde buscar clientes web empaquetados: `resource_dir` y `current_dir`.
fn static_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir);
    }
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    roots
}

/// Carpeta del cliente web de una sala: `<root>/public/<room>` o `<root>/<room>`,
/// sólo si contiene `index.html`. `None` = no hay cliente empaquetado.
fn room_static_dir(roots: &[PathBuf], room: &str) -> Option<PathBuf> {
    roots.iter().find_map(|root| {
        [root.join("public").join(room), root.join(room)]
            .into_iter()
            .find(|dir| dir.join("index.html").is_file())
    })
}

/// Extrae los puertos configurados (`ports.<room>`), cayendo a los por defecto.
fn resolve_port(ports: &Value, room: &str, fallback: u16) -> u16 {
    ports
        .get(room)
        .and_then(Value::as_u64)
        .and_then(|p| u16::try_from(p).ok())
        .unwrap_or(fallback)
}

/// `true` si el servidor de la sala está deshabilitado (`disabled.<room> === true`).
fn is_disabled(disabled: &Value, room: &str) -> bool {
    matches!(disabled.get(room).and_then(Value::as_bool), Some(true))
}

/// Arranca los servidores internos. Detiene cualquier instancia previa.
pub fn start(
    app: AppHandle,
    ports: Value,
    disabled: Value,
    data: Value,
    max: usize,
) -> AppResult<()> {
    stop();

    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let (events_tx, _) = broadcast::channel::<RoomEvent>(256);

    {
        let mut guard = runtime_cell()
            .lock()
            .map_err(|_| AppError::new("Server runtime lock poisoned"))?;
        *guard = Some(ServerRuntime {
            shutdown: shutdown_tx.clone(),
            events: events_tx.clone(),
        });
    }

    let roots = static_roots(&app);
    for (room, default_port) in DEFAULT_PORTS {
        if is_disabled(&disabled, room) {
            continue;
        }
        let port = resolve_port(&ports, room, *default_port);
        let Some(dir) = room_static_dir(&roots, room) else {
            log::info!("[server] {room}: sin cliente web empaquetado, no se abre el puerto {port}");
            continue;
        };
        let room_data = data.get(room).cloned().unwrap_or(json!({}));
        let shared = RoomShared {
            app: app.clone(),
            room: room.to_string(),
            data: Arc::new(room_data),
            connections: Arc::new(AtomicUsize::new(0)),
            max,
            events: events_tx.clone(),
        };
        let shutdown_rx = shutdown_tx.subscribe();

        tauri::async_runtime::spawn(async move {
            if let Err(err) = serve_room(shared, port, dir, shutdown_rx).await {
                log::warn!("[server] {err}");
            }
        });
    }

    Ok(())
}

/// Detiene los servidores internos en ejecución.
pub fn stop() {
    if let Ok(mut guard) = runtime_cell().lock()
        && let Some(runtime) = guard.take() {
            let _ = runtime.shutdown.send(());
        }
}

/// `true` si hay servidores en ejecución.
pub fn is_running() -> bool {
    runtime_cell()
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false)
}

async fn serve_room(
    shared: RoomShared,
    port: u16,
    dir: PathBuf,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> AppResult<()> {
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/api/status", get(api_status))
        .route("/api/data", get(api_data))
        .fallback_service(ServeDir::new(dir))
        .with_state(shared);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .map_err(|e| AppError::new(format!("No se pudo enlazar el puerto {port}: {e}")))?;

    let shutdown = async move {
        let _ = shutdown_rx.recv().await;
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await
        .map_err(|e| AppError::new(format!("Error en el servidor {port}: {e}")))
}

async fn api_status(State(shared): State<RoomShared>) -> impl IntoResponse {
    Json(json!({
        "room": shared.room,
        "running": true,
        "connections": shared.connections.load(Ordering::Relaxed),
        "max": shared.max,
    }))
}

async fn api_data(State(shared): State<RoomShared>) -> impl IntoResponse {
    Json(public_room_data(&shared.data))
}

/// Datos que se exponen por la API pública: sin `password` en el primer nivel.
fn public_room_data(data: &Value) -> Value {
    let mut out = data.clone();
    if let Some(map) = out.as_object_mut() {
        map.remove("password");
    }
    out
}

async fn ws_handler(ws: WebSocketUpgrade, State(shared): State<RoomShared>) -> Response {
    if shared.connections.load(Ordering::Relaxed) >= shared.max {
        return (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "connection limit reached",
        )
            .into_response();
    }
    ws.on_upgrade(move |socket| handle_socket(socket, shared))
}

async fn handle_socket(socket: WebSocket, shared: RoomShared) {
    shared.connections.fetch_add(1, Ordering::Relaxed);
    let mut events = shared.events.subscribe();
    let (mut sender, mut receiver) = socket.split();

    // Estado inicial al conectarse.
    let hello = json!({
        "channel": "CONNECTION",
        "data": { "room": shared.room, "max": shared.max }
    });
    if sender.send(Message::Text(hello.to_string().into())).await.is_err() {
        shared.connections.fetch_sub(1, Ordering::Relaxed);
        return;
    }

    let room = shared.room.clone();
    let app = shared.app.clone();

    // App → cliente: reenvía los mensajes difundidos a esta sala.
    let mut send_task = tokio::spawn(async move {
        loop {
            match events.recv().await {
                Ok(event) if event.room == room => {
                    let text = event.message.to_string();
                    if sender.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                Ok(_) => {}
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    // Cliente → app: emite un evento Tauri que el frontend puede escuchar.
    let room_recv = shared.room.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(value) = serde_json::from_str::<Value>(&text) {
                        let _ = app.emit("SERVER_MESSAGE", json!({ "room": room_recv, "message": value }));
                    }
                }
                Message::Binary(_) => {}
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    shared.connections.fetch_sub(1, Ordering::Relaxed);
}

/// Utilidad interna: mapa de puertos por defecto como `Value`.
pub fn default_ports_value() -> Value {
    let mut map = serde_json::Map::new();
    for (room, port) in DEFAULT_PORTS {
        map.insert(room.to_string(), json!(port));
    }
    Value::Object(map)
}

/// Utilidad interna: `max` por defecto.
pub fn default_max() -> usize {
    DEFAULT_MAX
}

/// Códigos de cliente disponibles (para logs/diagnóstico).
pub fn room_list() -> HashMap<String, u16> {
    DEFAULT_PORTS.iter().map(|(r, p)| (r.to_string(), *p)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn is_disabled_trata_true_como_deshabilitado() {
        let d = json!({ "remote": false, "stage": false, "controller": true, "output_stream": true });
        assert!(!is_disabled(&d, "remote"));
        assert!(!is_disabled(&d, "stage"));
        assert!(is_disabled(&d, "controller"));
        assert!(is_disabled(&d, "output_stream"));
        assert!(!is_disabled(&d, "sala_sin_configurar"));
    }

    #[test]
    fn room_static_dir_exige_index_html_de_la_sala() {
        let root = std::env::temp_dir().join("pulseflow-server-static");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("public/remote")).expect("public/remote");
        std::fs::write(root.join("public/remote/index.html"), "<html></html>").expect("index remote");
        std::fs::create_dir_all(root.join("stage")).expect("stage vacío");
        std::fs::write(root.join("index.html"), "<html></html>").expect("index raíz");
        let roots = vec![root.clone()];
        assert_eq!(room_static_dir(&roots, "remote"), Some(root.join("public/remote")));
        assert_eq!(room_static_dir(&roots, "stage"), None);
        assert_eq!(room_static_dir(&roots, "controller"), None);
    }

    #[test]
    fn public_room_data_no_expone_password() {
        assert_eq!(public_room_data(&json!({ "password": "1234", "name": "Iglesia" })), json!({ "name": "Iglesia" }));
        assert_eq!(public_room_data(&json!(null)), json!(null));
    }
}
