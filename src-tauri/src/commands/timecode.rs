//! Comandos del dominio `TIMECODE` (LTC/MTC).
//!
//! Fase autónoma: no se envía/recibe timecode nativo (requiere audio/OSC y
//! procesamiento de señal). Los comandos registran la configuración activa en
//! `AppState::timecode` para que el estado sea consultable.

#![allow(non_snake_case)]

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::{Value, json};
use tauri::State;

#[derive(Deserialize)]
pub struct TimecodeStartData {
    #[serde(rename = "type")]
    pub kind: String,
    pub mode: Option<String>,
    #[serde(default)]
    pub framerate: Option<f64>,
    #[serde(default)]
    pub data: Value,
}

/// `TIMECODE_START`: registra la configuración de envío/recepción de timecode.
#[tauri::command]
pub fn TIMECODE_START(state: State<'_, AppState>, data: TimecodeStartData) -> AppResult<()> {
    let mut timecode = state
        .timecode
        .lock()
        .map_err(|_| AppError::new("Timecode state lock poisoned"))?;
    *timecode = json!({
        "active": true,
        "type": data.kind,
        "mode": data.mode,
        "framerate": data.framerate,
    });
    Ok(())
}

/// `TIMECODE_STOP`: detiene el timecode.
#[tauri::command]
pub fn TIMECODE_STOP(state: State<'_, AppState>) -> AppResult<()> {
    let mut timecode = state
        .timecode
        .lock()
        .map_err(|_| AppError::new("Timecode state lock poisoned"))?;
    *timecode = json!({ "active": false });
    Ok(())
}

/// `TIMECODE_VALUE`: en Electron envía el valor actual por LTC/MTC. Devuelve el
/// valor recibido (eco) para mantener el contrato `number | void`.
#[tauri::command]
pub fn TIMECODE_VALUE(data: Value) -> AppResult<Value> {
    Ok(data)
}
