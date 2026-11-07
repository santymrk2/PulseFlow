//! Protección del engine: los errores de la GPU y los pánicos del hilo de render
//! se registran en vez de cerrar la app.

use std::panic::{AssertUnwindSafe, catch_unwind};

/// `true` para los primeros 20 eventos y después uno de cada 100: un error que se
/// repite cada cuadro no inunda el log.
pub fn should_log(count: u64) -> bool {
    count <= 20 || count.is_multiple_of(100)
}

/// Corre `body` atrapando pánicos. Devuelve `false` si hubo pánico (queda en el log).
pub fn run_guarded(name: &str, body: impl FnOnce()) -> bool {
    match catch_unwind(AssertUnwindSafe(body)) {
        Ok(()) => true,
        Err(payload) => {
            let msg = payload
                .downcast_ref::<&str>()
                .map(|s| (*s).to_string())
                .or_else(|| payload.downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "sin mensaje".to_string());
            log::error!("[render] pánico en {name}: {msg}");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_log_limita_la_repeticion() {
        assert!((1..=20).all(should_log));
        assert!(!should_log(21));
        assert!(should_log(100));
        assert!(!should_log(150));
        assert!(should_log(200));
    }

    #[test]
    fn run_guarded_atrapa_el_panico() {
        assert!(run_guarded("test", || {}));
        assert!(!run_guarded("test", || panic!("boom")));
    }
}
