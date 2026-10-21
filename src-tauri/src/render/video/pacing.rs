//! Pacing por PTS para los decodificadores nativos: espera hasta el instante en que cada frame
//! debe mostrarse. El primer frame fija el cero; si un frame llega muy tarde (una pausa, el
//! equipo ocupado) el reloj se reajusta en lugar de acelerar para alcanzarlo.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// Cuánto puede atrasarse un frame antes de que se reajuste el reloj.
pub const MAX_LATENESS: Duration = Duration::from_millis(200);
const SLICE: Duration = Duration::from_millis(10);

pub struct Pacer {
    clock_start: Instant,
    base: Option<Duration>,
}

impl Pacer {
    pub fn new() -> Self {
        Self { clock_start: Instant::now(), base: None }
    }

    /// Bloquea hasta que `pts` (en la línea de tiempo continua del video) esté a tiempo.
    /// Devuelve `false` si se pidió detener mientras esperaba (hay que descartar el frame).
    pub fn wait(&mut self, pts: Duration, running: &AtomicBool) -> bool {
        let base = *self.base.get_or_insert(pts);
        let target = self.clock_start + pts.saturating_sub(base);

        while running.load(Ordering::Relaxed) && Instant::now() < target {
            std::thread::sleep(target.saturating_duration_since(Instant::now()).min(SLICE));
        }
        if !running.load(Ordering::Relaxed) {
            return false;
        }

        let late = Instant::now().saturating_duration_since(target);
        if late > MAX_LATENESS {
            self.clock_start += late;
        }
        true
    }
}

impl Default for Pacer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_frame_is_shown_immediately() {
        let mut pacer = Pacer::new();
        let started = Instant::now();
        assert!(pacer.wait(Duration::from_secs(5), &AtomicBool::new(true)), "el PTS inicial no se espera");
        assert!(started.elapsed() < Duration::from_millis(50));
    }

    #[test]
    fn later_frames_wait_for_their_pts() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new();
        pacer.wait(Duration::from_millis(1000), &running);

        let started = Instant::now();
        assert!(pacer.wait(Duration::from_millis(1060), &running));
        assert!(started.elapsed() >= Duration::from_millis(55), "esperó {:?}", started.elapsed());
    }

    #[test]
    fn a_very_late_frame_resyncs_the_clock_instead_of_racing() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new();
        pacer.wait(Duration::ZERO, &running);
        std::thread::sleep(Duration::from_millis(400)); // pausa: el frame de 50 ms llega con 350 ms de atraso

        assert!(pacer.wait(Duration::from_millis(50), &running));

        // el siguiente frame (+33 ms) se espera de verdad: no sale disparado para "alcanzar" el atraso
        let started = Instant::now();
        assert!(pacer.wait(Duration::from_millis(83), &running));
        assert!(started.elapsed() >= Duration::from_millis(25), "esperó {:?}", started.elapsed());
    }

    #[test]
    fn stop_interrupts_the_wait() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new();
        pacer.wait(Duration::ZERO, &running);

        std::thread::scope(|scope| {
            scope.spawn(|| {
                std::thread::sleep(Duration::from_millis(30));
                running.store(false, Ordering::SeqCst);
            });
            let started = Instant::now();
            assert!(!pacer.wait(Duration::from_secs(30), &running), "devuelve false al detener");
            assert!(started.elapsed() < Duration::from_millis(500));
        });
    }
}
