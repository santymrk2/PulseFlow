//! Comandos IPC expuestos al frontend vía `#[tauri::command]`.
//!
//! Cada submódulo agrupa un dominio lógico y sus funciones corresponden a los
//! canales del enum `crate::types::main::Main`.

pub mod app;
pub mod backup;
pub mod blackmagic;
pub mod files;
pub mod media;
pub mod midi;
pub mod ndi;
pub mod output;
pub mod servers;
pub mod shows;
pub mod startup;
pub mod stores;
pub mod streaming;
pub mod sync;
pub mod timecode;
pub mod window;
