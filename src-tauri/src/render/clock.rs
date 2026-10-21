//! Reloj del show: un único "ahora" del que cuelgan video, letra y clic.
//!
//! Hoy sólo existe `WallClock` (reloj de pared). Cuando haya un motor de audio en Rust, un
//! `AudioClock` basado en el contador de muestras de la tarjeta de sonido lo reemplazará sin
//! tocar a los consumidores (el audio manda: el oído nota 10–20 ms de desfase; el ojo perdona
//! un frame). Los frames de video ya llevan su PTS para poder presentarse contra este reloj.

use std::time::{Duration, Instant};

pub trait ShowClock: Send + Sync {
    /// Tiempo transcurrido del show, monótono y que sólo avanza.
    fn now(&self) -> Duration;
}

/// Reloj de pared: cuenta desde que se creó.
pub struct WallClock {
    start: Instant,
}

impl WallClock {
    pub fn new() -> Self {
        Self { start: Instant::now() }
    }
}

impl Default for WallClock {
    fn default() -> Self {
        Self::new()
    }
}

impl ShowClock for WallClock {
    fn now(&self) -> Duration {
        self.start.elapsed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wall_clock_is_monotonic() {
        let clock = WallClock::new();
        let mut last = clock.now();
        for _ in 0..1000 {
            let now = clock.now();
            assert!(now >= last);
            last = now;
        }
    }

    #[test]
    fn wall_clock_advances() {
        let clock = WallClock::new();
        let before = clock.now();
        std::thread::sleep(Duration::from_millis(20));
        assert!(clock.now() - before >= Duration::from_millis(20));
    }

    #[test]
    fn a_clock_can_be_used_behind_the_trait() {
        let clock: Box<dyn ShowClock> = Box::new(WallClock::new());
        assert!(clock.now() < Duration::from_secs(5));
    }
}
