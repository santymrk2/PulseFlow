//! Lógica de negocio de dominio, independiente de Tauri.
//!
//! Aquí vive la lógica reutilizable (data, output, capture, streaming,
//! timecode, audio, ndi, omt, blackmagic, cloud, providers, ai) separada de la
//! capa IPC de `crate::commands`.

pub mod data;
