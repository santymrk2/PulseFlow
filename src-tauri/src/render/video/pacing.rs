//! Pacing por PTS para los decodificadores nativos: espera hasta el instante en que cada frame
//! debe mostrarse. El primer frame fija el cero; si un frame llega muy tarde (una pausa, el
//! equipo ocupado) el reloj se reajusta en lugar de acelerar para alcanzarlo.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Cuánto puede atrasarse un frame antes de que se reajuste el reloj.
pub const MAX_LATENESS: Duration = Duration::from_millis(200);
const SLICE: Duration = Duration::from_millis(10);

/// Sin salto pendiente.
const NO_SEEK: u64 = u64::MAX;

/// Estado de reproducción que comparten el hilo del decodificador y quien lo controla (F23.13).
#[derive(Clone)]
pub struct PlaybackState {
    paused: Arc<AtomicBool>,
    position_ms: Arc<AtomicU64>,
    seek_to: Arc<AtomicU64>,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self { paused: Arc::default(), position_ms: Arc::default(), seek_to: Arc::new(AtomicU64::new(NO_SEEK)) }
    }
}

impl PlaybackState {
    pub fn set_paused(&self, paused: bool) {
        self.paused.store(paused, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    /// PTS en ms del último frame entregado (o del destino del último salto, hasta que llegue un frame).
    pub fn position_ms(&self) -> u64 {
        self.position_ms.load(Ordering::SeqCst)
    }

    /// Lo llama el hilo del decodificador tras entregar un frame.
    pub fn set_position(&self, pts: Duration) {
        self.position_ms.store(u64::try_from(pts.as_millis()).unwrap_or(u64::MAX - 1), Ordering::SeqCst);
    }

    /// Pide un salto; el hilo del decodificador lo toma con `take_seek`.
    pub fn request_seek(&self, position_ms: u64) {
        self.position_ms.store(position_ms, Ordering::SeqCst);
        self.seek_to.store(position_ms.min(NO_SEEK - 1), Ordering::SeqCst);
    }

    pub fn seek_pending(&self) -> bool {
        self.seek_to.load(Ordering::SeqCst) != NO_SEEK
    }

    pub fn take_seek(&self) -> Option<u64> {
        Some(self.seek_to.swap(NO_SEEK, Ordering::SeqCst)).filter(|&ms| ms != NO_SEEK)
    }
}

pub struct Pacer {
    clock_start: Instant,
    base: Option<Duration>,
    state: PlaybackState,
}

impl Pacer {
    pub fn new(state: PlaybackState) -> Self {
        Self { clock_start: Instant::now(), base: None, state }
    }

    /// Tras un salto: el próximo frame vuelve a fijar el cero del reloj.
    pub fn reset(&mut self) {
        self.clock_start = Instant::now();
        self.base = None;
    }

    /// Espera mientras esté en pausa y corre el origen del reloj lo que duró (al reanudar no salta).
    fn hold_while_paused(&mut self, running: &AtomicBool) {
        let paused_at = Instant::now();
        while self.state.is_paused() && running.load(Ordering::Relaxed) {
            std::thread::sleep(SLICE);
        }
        self.clock_start += paused_at.elapsed();
    }

    /// Bloquea hasta que `pts` (en la línea de tiempo continua del video) esté a tiempo.
    /// Devuelve `false` si se pidió detener mientras esperaba (hay que descartar el frame).
    pub fn wait(&mut self, pts: Duration, running: &AtomicBool) -> bool {
        let base = *self.base.get_or_insert(pts);

        // el objetivo se recalcula en cada vuelta porque una pausa corre `clock_start`
        let target = loop {
            if !running.load(Ordering::Relaxed) {
                return false;
            }
            if self.state.is_paused() {
                self.hold_while_paused(running);
                continue;
            }
            let target = self.clock_start + pts.saturating_sub(base);
            if Instant::now() >= target {
                break target;
            }
            std::thread::sleep(target.saturating_duration_since(Instant::now()).min(SLICE));
        };

        let late = Instant::now().saturating_duration_since(target);
        if late > MAX_LATENESS {
            self.clock_start += late;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_frame_is_shown_immediately() {
        let mut pacer = Pacer::new(PlaybackState::default());
        let started = Instant::now();
        assert!(pacer.wait(Duration::from_secs(5), &AtomicBool::new(true)), "el PTS inicial no se espera");
        assert!(started.elapsed() < Duration::from_millis(50));
    }

    #[test]
    fn later_frames_wait_for_their_pts() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new(PlaybackState::default());
        pacer.wait(Duration::from_millis(1000), &running);

        let started = Instant::now();
        assert!(pacer.wait(Duration::from_millis(1060), &running));
        assert!(started.elapsed() >= Duration::from_millis(55), "esperó {:?}", started.elapsed());
    }

    #[test]
    fn a_very_late_frame_resyncs_the_clock_instead_of_racing() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new(PlaybackState::default());
        pacer.wait(Duration::ZERO, &running);
        std::thread::sleep(Duration::from_millis(400)); // pausa: el frame de 50 ms llega con 350 ms de atraso

        assert!(pacer.wait(Duration::from_millis(50), &running));

        // el siguiente frame (+33 ms) se espera de verdad: no sale disparado para "alcanzar" el atraso
        let started = Instant::now();
        assert!(pacer.wait(Duration::from_millis(83), &running));
        assert!(started.elapsed() >= Duration::from_millis(25), "esperó {:?}", started.elapsed());
    }

    #[test]
    fn pausing_shifts_the_clock_instead_of_jumping() {
        let running = AtomicBool::new(true);
        let state = PlaybackState::default();
        let mut pacer = Pacer::new(state.clone());
        pacer.wait(Duration::ZERO, &running);

        state.set_paused(true);
        std::thread::scope(|scope| {
            scope.spawn(|| {
                std::thread::sleep(Duration::from_millis(300));
                state.set_paused(false);
            });
            let started = Instant::now();
            // el frame de 50 ms sólo puede salir tras la pausa (300 ms) y sin reajustar el reloj por atraso
            assert!(pacer.wait(Duration::from_millis(50), &running));
            assert!(started.elapsed() >= Duration::from_millis(300), "esperó {:?}", started.elapsed());
        });

        // la pausa corrió el origen: el frame siguiente (+60 ms) se espera de verdad
        let started = Instant::now();
        assert!(pacer.wait(Duration::from_millis(110), &running));
        assert!(started.elapsed() >= Duration::from_millis(55), "esperó {:?}", started.elapsed());
    }

    #[test]
    fn seek_requests_are_taken_once() {
        let state = PlaybackState::default();
        assert_eq!(state.take_seek(), None);
        state.request_seek(1500);
        assert!(state.seek_pending());
        assert_eq!(state.position_ms(), 1500);
        assert_eq!(state.take_seek(), Some(1500));
        assert_eq!(state.take_seek(), None);
    }

    #[test]
    fn stop_interrupts_the_wait() {
        let running = AtomicBool::new(true);
        let mut pacer = Pacer::new(PlaybackState::default());
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
