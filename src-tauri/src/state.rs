//! Estado global compartido de la aplicación (inyectado en los comandos).

use crate::domain::data::store::StoreManager;
use serde_json::Value;
use std::sync::Mutex;

/// Estado de los servidores internos (REST/websocket) y de la sincronización.
#[derive(Debug)]
pub struct ServerState {
    /// Si el servicio de servidores está activo.
    pub running: bool,
    /// Si el WebSocket/REST está activo.
    pub websocket: bool,
    /// Datos de configuración de los servidores (`SERVER_DATA`).
    pub data: Value,
    /// Puertos configurados (`START`).
    pub ports: Value,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            running: false,
            websocket: false,
            data: Value::Object(Default::default()),
            ports: Value::Object(Default::default()),
        }
    }
}

/// Estado de la app inyectado vía `tauri::State`.
pub struct AppState {
    pub stores: Mutex<StoreManager>,
    pub servers: Mutex<ServerState>,
    /// Configuración/estado activo del timecode LTC/MTC.
    pub timecode: Mutex<Value>,
}

impl AppState {
    pub fn new(stores: StoreManager) -> Self {
        Self {
            stores: Mutex::new(stores),
            servers: Mutex::new(ServerState::default()),
            timecode: Mutex::new(Value::Null),
        }
    }
}
