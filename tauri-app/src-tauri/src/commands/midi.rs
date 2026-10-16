//! Comandos del dominio `MIDI`.
//!
//! Fase autónoma: la enumeración y el envío/recepción de MIDI nativos (JZZ en
//! Electron) se implementarán con un crate/FFI dedicado más adelante. Por ahora
//! se devuelven listas vacías con el formato esperado `{ name }[]`.

#![allow(non_snake_case)]

use crate::error::AppResult;
use serde::Serialize;

#[derive(Serialize)]
pub struct MidiPort {
    pub name: String,
}

/// `GET_MIDI_OUTPUTS`: puertos de salida MIDI (vacío en esta fase).
#[tauri::command]
pub fn GET_MIDI_OUTPUTS() -> AppResult<Vec<MidiPort>> {
    Ok(Vec::new())
}

/// `GET_MIDI_INPUTS`: puertos de entrada MIDI (vacío en esta fase).
#[tauri::command]
pub fn GET_MIDI_INPUTS() -> AppResult<Vec<MidiPort>> {
    Ok(Vec::new())
}
