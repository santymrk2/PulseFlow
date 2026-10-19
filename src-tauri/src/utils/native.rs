//! Carga dinámica de librerías nativas (FFI) con `libloading`.
//!
//! Base común para los módulos de hardware (NDI, Blackmagic). Permite intentar
//! cargar una serie de nombres de librería por plataforma y resolver símbolos
//! sin caer en `unwrap()`/`expect()`: si la librería no está presente, se
//! devuelve `None` y el llamador degrada con elegancia.

use libloading::Library;

/// Envoltura segura sobre una librería cargada dinámicamente.
pub struct NativeLibrary {
    inner: Library,
    path: String,
}

impl NativeLibrary {
    /// Intenta cargar la primera librería disponible de `candidates`.
    ///
    /// # Safety
    /// `Library::new` ejecuta código de inicialización de la librería cargada.
    /// Solo se pasan nombres de librerías de confianza del sistema.
    pub fn load(candidates: &[&str]) -> Option<Self> {
        for candidate in candidates {
            match unsafe { Library::new(candidate) } {
                Ok(inner) => {
                    return Some(Self {
                        inner,
                        path: (*candidate).to_string(),
                    });
                }
                Err(_) => continue,
            }
        }
        None
    }

    /// Ruta/nombre con el que se cargó la librería.
    pub fn path(&self) -> &str {
        &self.path
    }

    /// `true` si la librería exporta el símbolo indicado.
    pub fn has_symbol(&self, name: &[u8]) -> bool {
        // SAFETY: solo se comprueba la existencia del símbolo, no se invoca.
        unsafe { self.inner.get::<*const ()>(name).is_ok() }
    }

    /// Invoca una función `extern "C" fn() -> bool` (p. ej. inicializadores).
    ///
    /// # Safety
    /// La firma del símbolo debe coincidir con `extern "C" fn() -> bool`.
    pub unsafe fn call_bool(&self, name: &[u8]) -> Option<bool> {
        // SAFETY: el llamador garantiza la firma del símbolo.
        let symbol: libloading::Symbol<unsafe extern "C" fn() -> bool> =
            unsafe { self.inner.get(name).ok()? };
        Some(unsafe { symbol() })
    }

    /// Invoca una función `extern "C" fn()` (p. ej. finalizadores).
    ///
    /// # Safety
    /// La firma del símbolo debe coincidir con `extern "C" fn()`.
    pub unsafe fn call_void(&self, name: &[u8]) -> bool {
        // SAFETY: el llamador garantiza la firma del símbolo.
        match unsafe { self.inner.get::<unsafe extern "C" fn()>(name) } {
            Ok(symbol) => {
                unsafe { symbol() };
                true
            }
            Err(_) => false,
        }
    }
}
