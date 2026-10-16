//! Tipos de error de la aplicación.
//!
//! Regla del proyecto (`.opencode-rules.md`, punto 2): prohibido usar `.unwrap()`
//! o `.expect()` en el código de producción. Todos los comandos devuelven
//! `AppResult<T>` y convierten sus errores a `AppError`, que implementa
//! `serde::Serialize` para poder enviarse al frontend como un `string`.

use serde::ser::{Serialize, Serializer};

/// Error genérico de la aplicación.
///
/// Envuelve cualquier error de sistema (`std::io::Error`, errores de parseo,
/// errores de Tauri, ...) normalizándolos a un mensaje de texto plano que el
/// frontend puede consumir directamente.
#[derive(Debug, Clone)]
pub struct AppError {
    message: String,
}

impl AppError {
    /// Crea un `AppError` a partir de cualquier valor convertible en `String`.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    /// Devuelve el mensaje de error subyacente.
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.message)
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::new(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::new(err.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        Self::new(err.to_string())
    }
}

impl From<String> for AppError {
    fn from(err: String) -> Self {
        Self::new(err)
    }
}

impl From<&str> for AppError {
    fn from(err: &str) -> Self {
        Self::new(err)
    }
}

impl From<std::num::ParseIntError> for AppError {
    fn from(err: std::num::ParseIntError) -> Self {
        Self::new(err.to_string())
    }
}

impl From<std::num::ParseFloatError> for AppError {
    fn from(err: std::num::ParseFloatError) -> Self {
        Self::new(err.to_string())
    }
}

impl From<std::str::Utf8Error> for AppError {
    fn from(err: std::str::Utf8Error) -> Self {
        Self::new(err.to_string())
    }
}

/// Alias de conveniencia para los comandos y la lógica de dominio.
pub type AppResult<T> = Result<T, AppError>;
