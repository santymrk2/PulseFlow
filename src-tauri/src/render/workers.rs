//! Workers de I/O del engine (F19): un pequeño pool de hilos para trabajo que no puede bloquear ni
//! al hilo de render ni al de comandos (decodificar imágenes, leer disco, generar miniaturas).
//!
//! La cola es **acotada** (`crossbeam-channel`): si llegan más peticiones de las que el pool
//! puede atender, el trabajo nuevo se descarta en vez de acumularse en memoria (precargar miles
//! de assets no puede disparar el uso de RAM). Los canales de crossbeam son MPMC: cada
//! trabajador tiene su propio `Receiver` clonado, así que no hace falta ningún `Mutex`.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use crossbeam_channel::{bounded, Receiver, Sender, TrySendError};

type Job = Box<dyn FnOnce() + Send + 'static>;

/// Jobs que pueden esperar en la cola antes de que el trabajo se descarte.
const QUEUE_CAPACITY: usize = 512;

/// Cuánto espera un comando async a que haya lugar en la cola antes de rendirse.
const QUEUE_WAIT: Duration = Duration::from_secs(30);

struct Pool {
    sender: Sender<Job>,
}

static POOL: OnceLock<Pool> = OnceLock::new();

/// Mitad de los núcleos (mínimo 2, máximo 8): deja aire al hilo de render y a los de la app.
fn worker_count() -> usize {
    thread::available_parallelism().map(|n| n.get() / 2).unwrap_or(2).clamp(2, 8)
}

/// Crea un pool con `capacity` trabajos en cola y `workers` hilos consumidores.
fn build_pool(capacity: usize, workers: usize) -> Pool {
    let (sender, receiver) = bounded::<Job>(capacity);
    for index in 0..workers {
        // Cada trabajador tiene su propio receptor (MPMC): el lock del `std::sync::mpsc` no hace falta.
        let receiver: Receiver<Job> = receiver.clone();
        let spawned = thread::Builder::new().name(format!("PulseFlow-IO-{index}")).spawn(move || {
            while let Ok(job) = receiver.recv() {
                // un job que hace panic no puede matar al trabajador
                if catch_unwind(AssertUnwindSafe(job)).is_err() {
                    log::warn!("[workers] un job de I/O terminó en panic");
                }
            }
        });
        if let Err(e) = spawned {
            log::warn!("[workers] no se pudo iniciar el trabajador {index}: {e}");
        }
    }
    Pool { sender }
}

/// Pool de I/O del proceso.
fn pool() -> &'static Pool {
    POOL.get_or_init(|| build_pool(QUEUE_CAPACITY, worker_count()))
}

/// Encola `job` **sin bloquear**: si la cola está llena, el trabajo se descarta (queda registrado
/// en el log). `true` si el job entró en la cola.
fn enqueue(pool: &Pool, job: Job) -> bool {
    match pool.sender.try_send(job) {
        Ok(()) => true,
        Err(TrySendError::Full(_)) => {
            log::warn!("[workers] cola de I/O llena: se descarta el trabajo");
            false
        }
        Err(TrySendError::Disconnected(_)) => {
            log::warn!("[workers] el pool de I/O no está disponible");
            false
        }
    }
}

/// Ejecuta `job` en un hilo del pool y devuelve de inmediato.
pub fn submit(job: impl FnOnce() + Send + 'static) {
    enqueue(pool(), Box::new(job));
}

/// Ejecuta `job` en el pool y espera su resultado **sin bloquear el hilo** que lo pide: pensado para
/// comandos `async` de Tauri, que no pueden hacer trabajo pesado (decodificar, redimensionar, leer
/// disco) dentro de su cuerpo porque ocuparían un hilo del runtime. `None` si el job hizo panic.
pub async fn run<T: Send + 'static>(job: impl FnOnce() -> T + Send + 'static) -> Option<T> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    // Encolar puede bloquear si la cola está llena: se hace en un hilo de apoyo para no
    // ocupar el runtime async (y para que el comando espere a que haya lugar en vez de
    // perder el trabajo).
    let queued = tokio::task::spawn_blocking(move || {
        let job: Job = Box::new(move || {
            let _ = sender.send(job());
        });
        pool().sender.send_timeout(job, QUEUE_WAIT)
    })
    .await;

    match queued {
        Ok(Ok(())) => receiver.await.ok(),
        Ok(Err(_)) => {
            log::warn!("[workers] la cola de I/O no se vació a tiempo: el trabajo no se encola");
            None
        }
        Err(e) => {
            log::warn!("[workers] no se pudo encolar el trabajo: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::mpsc;
    use std::sync::Arc;

    #[test]
    fn submit_runs_the_job_off_the_calling_thread() {
        let (tx, rx) = mpsc::channel();
        submit(move || {
            let _ = tx.send(std::thread::current().id());
        });
        let worker = rx.recv_timeout(Duration::from_secs(2)).expect("el job corrió");
        assert_ne!(worker, std::thread::current().id());
    }

    #[test]
    fn every_submitted_job_runs() {
        let counter = Arc::new(AtomicUsize::new(0));
        let (tx, rx) = mpsc::channel();
        for _ in 0..200 {
            let (counter, tx) = (Arc::clone(&counter), tx.clone());
            submit(move || {
                counter.fetch_add(1, Ordering::SeqCst);
                let _ = tx.send(());
            });
        }
        for _ in 0..200 {
            rx.recv_timeout(Duration::from_secs(5)).expect("terminó cada job");
        }
        assert_eq!(counter.load(Ordering::SeqCst), 200);
    }

    #[test]
    fn a_panicking_job_does_not_kill_the_pool() {
        submit(|| panic!("job que falla a propósito"));
        let (tx, rx) = mpsc::channel();
        // sobran trabajadores sanos o el hilo se recupera: igual tiene que correr el siguiente job
        for _ in 0..16 {
            let tx = tx.clone();
            submit(move || {
                let _ = tx.send(());
            });
        }
        for _ in 0..16 {
            rx.recv_timeout(Duration::from_secs(5)).expect("el pool sigue vivo");
        }
    }

    #[test]
    fn the_queue_is_bounded_and_enqueue_never_blocks() {
        // Pool propio (cola de 2, un solo trabajador): no toca el pool del proceso.
        let pool = build_pool(2, 1);
        let release = Arc::new(AtomicBool::new(false));
        let (started_tx, started_rx) = mpsc::channel();

        // El primer job ocupa al trabajador (no termina hasta que se suelta).
        let flag = Arc::clone(&release);
        assert!(enqueue(&pool, Box::new(move || {
            let _ = started_tx.send(());
            while !flag.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_millis(1));
            }
        })));
        // Se espera a que el trabajador lo tome: recién ahí la cola está vacía y el
        // trabajador no puede tomar nada más.
        started_rx.recv_timeout(Duration::from_secs(5)).expect("el trabajador tomó el job");

        // Los dos siguientes llenan la cola.
        assert!(enqueue(&pool, Box::new(|| {})));
        assert!(enqueue(&pool, Box::new(|| {})));

        // El cuarto no entra: se descarta y el llamante no espera.
        let started = std::time::Instant::now();
        assert!(!enqueue(&pool, Box::new(|| {})), "la cola debería estar llena");
        assert!(started.elapsed() < Duration::from_millis(100), "encolar bloqueó: {:?}", started.elapsed());

        release.store(true, Ordering::SeqCst);
    }

    #[test]
    fn run_returns_the_job_result_without_blocking_the_async_runtime() {
        let runtime = tokio::runtime::Builder::new_current_thread().enable_time().build().expect("runtime");
        runtime.block_on(async {
            // una tarea que sólo corre si el runtime async sigue libre mientras el job duerme:
            // el primer poll del ticker ocurre mientras se espera el resultado del job
            let ticked = Arc::new(AtomicBool::new(false));
            let ticker = {
                let ticked = Arc::clone(&ticked);
                tokio::spawn(async move {
                    ticked.store(true, Ordering::SeqCst);
                    loop {
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                })
            };

            let value = run(|| {
                std::thread::sleep(Duration::from_millis(300));
                42
            })
            .await;
            ticker.abort();

            assert_eq!(value, Some(42));
            // el ticker corrió mientras se esperaba al job: el runtime no estaba bloqueado
            assert!(ticked.load(Ordering::SeqCst), "el runtime se bloqueó: el ticker no corrió durante el job");
        });
    }

    #[test]
    fn run_gives_none_when_the_job_panics() {
        let runtime = tokio::runtime::Builder::new_current_thread().build().expect("runtime");
        let value: Option<u32> = runtime.block_on(run(|| panic!("job que falla a propósito")));
        assert_eq!(value, None);
    }
}
