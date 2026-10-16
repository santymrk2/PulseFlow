//! Dominio `NDI` (salida/captura de red NDI).
//!
//! En Electron se usaba el SDK nativo de NDI a través de `vingester-util`.
//! Aquí se prepara la **arquitectura FFI en Rust** con [`libloading`], lista para
//! inyectar el runtime de NDI cuando esté disponible en el sistema.
//!
//! Funciones NDI relevantes (SDK `Processing.NDI.Lib`), declaradas para su uso
//! una vez cargada la librería:
//!
//! ```c
//! bool NDIlib_initialize(void);
//! void NDIlib_destroy(void);
//! const NDIlib_v5* NDIlib_v5_load(void);
//! NDIlib_find_instance_t NDIlib_find_create_v2(const NDIlib_find_create_t*);
//! bool NDIlib_find_wait_for_sources(NDIlib_find_instance_t, uint32_t timeout_ms);
//! const NDIlib_source_t* NDIlib_find_get_current_sources(NDIlib_find_instance_t, uint32_t* n);
//! void NDIlib_find_destroy(NDIlib_find_instance_t);
//! ```
//!
//! La estructura `NDIlib_source_t` es `{ const char* p_ndi_name; const char* p_url_address; }`.

#![allow(non_snake_case)]

use crate::utils::native::NativeLibrary;
use serde::Serialize;

/// Mensaje estándar cuando el runtime de NDI no está disponible.
pub const NOT_IMPLEMENTED: &str = "Runtime NDI no disponible en el sistema";

/// Nombres candidatos del runtime NDI por plataforma.
fn library_candidates() -> Vec<&'static str> {
    if cfg!(windows) {
        vec![
            "Processing.NDI.Lib.x64.dll",
            "Processing.NDI.Lib.x86.dll",
            "ndi.dll",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "/usr/local/lib/libndi.dylib",
            "/opt/homebrew/lib/libndi.dylib",
            "libndi.dylib",
        ]
    } else {
        vec!["libndi.so.6", "libndi.so.5", "libndi.so"]
    }
}

/// Estado del soporte NDI.
#[derive(Debug, Clone, Serialize)]
pub struct NdiStatus {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub library: Option<String>,
    pub message: String,
}

/// Fuente NDI descubierta en la red local.
#[derive(Debug, Clone, Serialize)]
pub struct NdiSource {
    pub name: String,
    pub url: String,
}

/// Estructura C equivalente a `NDIlib_source_t` (dos punteros a `char`).
#[repr(C)]
struct NdiSourceRaw {
    p_ndi_name: *const std::os::raw::c_char,
    p_url_address: *const std::os::raw::c_char,
}

/// Comprueba si el runtime de NDI está presente e inicializable.
pub fn status() -> NdiStatus {
    let Some(lib) = NativeLibrary::load(&library_candidates()) else {
        return NdiStatus {
            available: false,
            library: None,
            message: NOT_IMPLEMENTED.to_string(),
        };
    };

    // SAFETY: `NDIlib_initialize` tiene firma `extern "C" fn() -> bool`.
    let initialized = unsafe { lib.call_bool(b"NDIlib_initialize\0") }.unwrap_or(false);

    if initialized {
        // SAFETY: `NDIlib_destroy` tiene firma `extern "C" fn()`.
        let _ = unsafe { lib.call_void(b"NDIlib_destroy\0") };
        NdiStatus {
            available: true,
            library: Some(lib.path().to_string()),
            message: "Runtime NDI cargado".to_string(),
        }
    } else {
        NdiStatus {
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

/// Descubre fuentes NDI en la red local.
///
/// Se mantiene conservador: solo se ejecuta la secuencia de descubrimiento si el
/// runtime está inicializable; en caso contrario devuelve una lista vacía. La
/// invocación completa de `NDIlib_find_*` queda preparada para su activación
/// cuando se incluya el binding generado del SDK.
pub fn discover_sources() -> Vec<NdiSource> {
    let Some(lib) = NativeLibrary::load(&library_candidates()) else {
        return Vec::new();
    };

    // SAFETY: inicializador sin argumentos.
    let initialized = unsafe { lib.call_bool(b"NDIlib_initialize\0") }.unwrap_or(false);
    if !initialized {
        return Vec::new();
    }

    let has_find = lib.has_symbol(b"NDIlib_find_create_v2\0")
        && lib.has_symbol(b"NDIlib_find_get_current_sources\0")
        && lib.has_symbol(b"NDIlib_find_destroy\0");

    // La extracción real de fuentes se activa cuando `has_find` es verdadero y se
    // dispone del binding tipado; por ahora se destruye el runtime y se devuelve
    // vacío para no invocar firmas no verificadas.
    let _ = has_find;

    // SAFETY: finalizador sin argumentos.
    let _ = unsafe { lib.call_void(b"NDIlib_destroy\0") };
    Vec::new()
}

/// Reservado para el binding tipado de `NDIlib_source_t`.
#[allow(dead_code)]
fn _source_from_raw(_raw: &NdiSourceRaw) {}

/// `NDI_STATUS`: informa si el runtime de NDI está disponible.
#[tauri::command]
pub fn NDI_STATUS() -> NdiStatus {
    status()
}

/// `NDI_SOURCES`: descubre las fuentes NDI de la red local.
#[tauri::command]
pub fn NDI_SOURCES() -> Vec<NdiSource> {
    discover_sources()
}
