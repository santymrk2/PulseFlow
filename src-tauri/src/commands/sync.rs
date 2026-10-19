//! Comandos del dominio `SYNC` (sincronización en la nube).
//!
//! Fase autónoma: se devuelven respuestas mockeadas de éxito/estado inicial para
//! que el frontend pueda arrancar. La integración real con proveedores
//! (ChurchApps, etc.) se implementará más adelante.

#![allow(non_snake_case)]

use crate::error::AppResult;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
pub struct SyncProviderData {
    #[serde(default)]
    pub id: Option<String>,
}

/// `CAN_SYNC`: indica si el proveedor de sincronización está disponible.
#[tauri::command]
pub fn CAN_SYNC(_data: SyncProviderData) -> AppResult<bool> {
    Ok(true)
}

#[derive(Deserialize)]
pub struct CloudDataRequest {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub church_id: Option<String>,
    #[serde(default)]
    pub team_id: Option<String>,
}

/// `GET_TEAMS`: equipos disponibles para sincronizar (vacío en esta fase).
#[tauri::command]
pub fn GET_TEAMS(_data: SyncProviderData) -> AppResult<Vec<Value>> {
    Ok(Vec::new())
}

/// `CLOUD_DATA`: si existe datos en la nube para el equipo (falso en esta fase).
#[tauri::command]
pub fn CLOUD_DATA(_data: CloudDataRequest) -> AppResult<bool> {
    Ok(false)
}

/// Utilidad interna reutilizable para construir respuestas de sincronización.
#[allow(dead_code)]
pub fn success<T: serde::Serialize>(value: T) -> Value {
    json!({ "success": true, "data": value })
}
