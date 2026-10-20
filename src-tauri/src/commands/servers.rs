//! Comandos del dominio `SERVERS`.
//!
//! Controlan el ciclo de vida del servidor interno REST + WebSocket
//! (`crate::server`), que reemplaza a Express.js + Socket.io de la versión
//! Electron. El estado lógico (datos, puertos, conexión) se guarda en
//! `AppState::servers`, mientras que las instancias reales de Axum viven en el
//! módulo `server`.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::server;
use crate::state::AppState;
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, State};

fn as_object(value: &Value) -> Option<&serde_json::Map<String, Value>> {
    value.as_object()
}

#[derive(Deserialize)]
pub struct StartServersData {
    #[serde(default)]
    pub ports: Value,
    #[serde(default)]
    pub max: Option<u64>,
    #[serde(default)]
    pub disabled: Value,
    #[serde(default)]
    pub data: Value,
}

/// `START`: levanta los servidores REST/WebSocket de cada dominio activo.
#[tauri::command]
pub fn START(
    app: AppHandle,
    state: State<'_, AppState>,
    data: StartServersData,
) -> AppResult<()> {
    let max = data.max.unwrap_or(server::default_max() as u64) as usize;

    server::start(app, data.ports.clone(), data.disabled.clone(), data.data.clone(), max)?;

    let mut servers = state
        .servers
        .lock()
        .map_err(|_| AppError::new("Server state lock poisoned"))?;
    servers.running = true;
    servers.ports = data.ports;
    if !data.data.is_null() {
        servers.data = data.data;
    }
    Ok(())
}

/// `STOP`: detiene los servidores.
#[tauri::command]
pub fn STOP(state: State<'_, AppState>) -> AppResult<()> {
    server::stop();
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| AppError::new("Server state lock poisoned"))?;
    servers.running = false;
    servers.websocket = false;
    Ok(())
}

/// `SERVER_DATA`: actualiza los datos de configuración de los servidores.
#[tauri::command]
pub fn SERVER_DATA(state: State<'_, AppState>, data: Value) -> AppResult<()> {
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| AppError::new("Server state lock poisoned"))?;
    if let (Some(current), Some(incoming)) = (servers.data.as_object_mut(), as_object(&data)) {
        for (key, value) in incoming {
            current.insert(key.clone(), value.clone());
        }
    } else {
        servers.data = data;
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct WebSocketStartData {
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub password: Option<String>,
}

/// `WEBSOCKET_START`: arranca (si no lo está) el servidor WebSocket/REST.
#[tauri::command]
pub fn WEBSOCKET_START(
    app: AppHandle,
    state: State<'_, AppState>,
    data: WebSocketStartData,
) -> AppResult<()> {
    if !server::is_running() {
        let mut ports = server::default_ports_value();
        if let (Some(port), Some(map)) = (data.port, ports.as_object_mut()) {
            map.insert("remote".to_string(), Value::from(port));
        }
        let disabled = Value::Object(Default::default());
        let data_value = Value::Object(Default::default());
        server::start(app, ports, disabled, data_value, server::default_max())?;
    }

    let mut servers = state
        .servers
        .lock()
        .map_err(|_| AppError::new("Server state lock poisoned"))?;
    servers.websocket = true;
    Ok(())
}

/// `WEBSOCKET_STOP`: detiene el servidor WebSocket/REST.
#[tauri::command]
pub fn WEBSOCKET_STOP(state: State<'_, AppState>) -> AppResult<()> {
    server::stop();
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| AppError::new("Server state lock poisoned"))?;
    servers.websocket = false;
    Ok(())
}

/// Salas soportadas por el servidor interno (espejo de `server::DEFAULT_PORTS`).
const SERVER_ROOMS: &[&str] = &["remote", "stage", "controller", "output_stream"];

/// Normaliza el nombre del canal de servidor del frontend a su sala
/// (`REMOTE` → `remote`, `OUTPUT_STREAM` → `output_stream`). Devuelve `None`
/// para canales que no son salas del servidor.
fn server_room(channel: &str) -> Option<&'static str> {
    let lower = channel.to_ascii_lowercase();
    SERVER_ROOMS.iter().copied().find(|room| *room == lower)
}

/// Payload de `SERVER_SEND`. Espejo en TypeScript: `src/types/IPC/ServerSend.ts`.
#[derive(Deserialize)]
pub struct ServerSendData {
    pub channel: String,
    pub message: Value,
}

/// `SERVER_SEND`: difunde un mensaje a los clientes WebSocket de una sala
/// (remote/stage/controller/output_stream). En Electron estos mensajes iban por
/// socket.io hacia las apps web de control remoto y stage; acá se reenvían al
/// servidor interno (`server::broadcast_to_room`). Si el servidor no está
/// corriendo no hace nada (broadcast no-op sin runtime).
#[tauri::command]
pub fn SERVER_SEND(data: ServerSendData) -> AppResult<()> {
    let room = server_room(&data.channel)
        .ok_or_else(|| AppError::new(format!("unknown server room: {}", data.channel)))?;
    server::broadcast_to_room(room, data.message);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// JSON de ejemplo del espejo TS (`ServerSendData`).
    const SERVER_SEND_JSON: &str =
        r#"{ "channel": "remote", "message": { "channel": "SCRIPTURE", "data": { "a": 1 } } }"#;

    #[test]
    fn server_send_data_se_deserializa_desde_json() {
        let data: ServerSendData = serde_json::from_str(SERVER_SEND_JSON).unwrap();
        assert_eq!(data.channel, "remote");
        assert_eq!(data.message["channel"], json!("SCRIPTURE"));
        assert_eq!(data.message["data"]["a"], json!(1));
    }

    #[test]
    fn server_room_mapea_canales_a_salas() {
        assert_eq!(server_room("REMOTE"), Some("remote"));
        assert_eq!(server_room("remote"), Some("remote"));
        assert_eq!(server_room("STAGE"), Some("stage"));
        assert_eq!(server_room("Controller"), Some("controller"));
        assert_eq!(server_room("OUTPUT_STREAM"), Some("output_stream"));
        assert_eq!(server_room("MAIN"), None);
        assert_eq!(server_room("SCRIPTURE"), None);
    }

    #[test]
    fn server_send_con_sala_desconocida_falla_sin_difundir() {
        let data = ServerSendData {
            channel: "MAIN".to_string(),
            message: json!({"channel": "SAVE", "data": null}),
        };
        let result = SERVER_SEND(data);
        assert!(result.is_err());
    }

    #[test]
    fn server_send_sin_servidor_corriendo_es_no_op() {
        // Sin runtime no hay broadcast: no debe fallar (regla de F10.0f:
        // "no hace nada si el servidor no está corriendo").
        let data: ServerSendData = serde_json::from_str(SERVER_SEND_JSON).unwrap();
        assert!(SERVER_SEND(data).is_ok());
    }
}
