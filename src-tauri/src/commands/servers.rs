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
pub fn START(app: AppHandle, state: State<'_, AppState>, data: StartServersData) -> AppResult<()> {
    let max = data.max.unwrap_or(server::default_max() as u64) as usize;

    server::start(
        app,
        data.ports.clone(),
        data.disabled.clone(),
        data.data.clone(),
        max,
    )?;

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
