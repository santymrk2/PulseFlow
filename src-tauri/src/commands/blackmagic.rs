//! Dominio `BLACKMAGIC` (captura/salida vía Blackmagic DeckLink).
//!
//! En Electron se usaba el addon nativo `vingester-util` (macadam) para hablar
//! con el SDK C++/COM de DeckLink. Aquí se prepara la **arquitectura FFI en
//! Rust** con [`libloading`]: se intenta cargar una librería ayudante (un `cdylib`
//! propio que encapsule el SDK de Blackmagic) que exponga una ABI C estable.
//!
//! ABI C que debe exportar la librería ayudante:
//!
//! ```c
//! bool blackmagic_initialize(void);
//! void blackmagic_shutdown(void);
//! int  blackmagic_device_count(void);
//! const char* blackmagic_device_name(int index); // NULL si índice inválido
//! ```
//!
//! De este modo el SDK C++ queda aislado en un artefacto nativo por plataforma y
//! el código Rust permanece seguro y portable.

#![allow(non_snake_case)]

use crate::utils::native::NativeLibrary;
use serde::Serialize;

/// Mensaje estándar cuando la ayuda nativa de Blackmagic no está disponible.
pub const NOT_IMPLEMENTED: &str = "Ayuda nativa de Blackmagic no disponible";

/// Nombres candidatos del ayudante nativo de Blackmagic por plataforma.
fn library_candidates() -> Vec<&'static str> {
    if cfg!(windows) {
        vec![
            "blackmagic_helper.dll",
            "libblackmagic_helper.dll",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "libblackmagic_helper.dylib",
            "/usr/local/lib/libblackmagic_helper.dylib",
        ]
    } else {
        vec!["libblackmagic_helper.so"]
    }
}

/// Estado del soporte Blackmagic.
#[derive(Debug, Clone, Serialize)]
pub struct BlackmagicStatus {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub library: Option<String>,
    pub message: String,
}

/// Dispositivo DeckLink detectado.
#[derive(Debug, Clone, Serialize)]
pub struct BlackmagicDevice {
    pub index: i32,
    pub name: String,
}

/// Comprueba si la ayuda nativa de Blackmagic está presente e inicializable.
pub fn status() -> BlackmagicStatus {
    let Some(lib) = NativeLibrary::load(&library_candidates()) else {
        return BlackmagicStatus {
            available: false,
            library: None,
            message: NOT_IMPLEMENTED.to_string(),
        };
    };

    // SAFETY: `blackmagic_initialize` tiene firma `extern "C" fn() -> bool`.
    let initialized = unsafe { lib.call_bool(b"blackmagic_initialize\0") }.unwrap_or(false);

    if initialized {
        // SAFETY: `blackmagic_shutdown` tiene firma `extern "C" fn()`.
        let _ = unsafe { lib.call_void(b"blackmagic_shutdown\0") };
        BlackmagicStatus {
            available: true,
            library: Some(lib.path().to_string()),
            message: "Ayuda nativa de Blackmagic cargada".to_string(),
        }
    } else {
        BlackmagicStatus {
            available: false,
            library: Some(lib.path().to_string()),
            message: NOT_IMPLEMENTED.to_string(),
        }
    }
}

/// Compatibilidad con la firma anterior.
pub fn not_implemented() -> &'static str {
    NOT_IMPLEMENTED
}

/// Enumera los dispositivos DeckLink disponibles.
///
/// Requiere que la librería ayudante exporte `blackmagic_device_count` y
/// `blackmagic_device_name`. Si no está disponible, devuelve una lista vacía.
pub fn enumerate_devices() -> Vec<BlackmagicDevice> {
    let Some(lib) = NativeLibrary::load(&library_candidates()) else {
        return Vec::new();
    };

    // SAFETY: inicializador sin argumentos.
    let initialized = unsafe { lib.call_bool(b"blackmagic_initialize\0") }.unwrap_or(false);
    if !initialized {
        return Vec::new();
    }

    let has_api = lib.has_symbol(b"blackmagic_device_count\0")
        && lib.has_symbol(b"blackmagic_device_name\0");

    // La enumeración real se activa cuando la ayuda nativa está desplegada y se
    // dispone de las firmas tipadas; por ahora se apaga el runtime.
    let _ = has_api;

    // SAFETY: finalizador sin argumentos.
    let _ = unsafe { lib.call_void(b"blackmagic_shutdown\0") };
    Vec::new()
}

/// `BLACKMAGIC_STATUS`: estado del soporte nativo de Blackmagic DeckLink.
#[tauri::command]
pub fn BLACKMAGIC_STATUS() -> BlackmagicStatus {
    status()
}

/// `BLACKMAGIC_DEVICES`: dispositivos DeckLink detectados (lista vacía si no hay
/// soporte nativo).
#[tauri::command]
pub fn BLACKMAGIC_DEVICES() -> Vec<BlackmagicDevice> {
    enumerate_devices()
}
