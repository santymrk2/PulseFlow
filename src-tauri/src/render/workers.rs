//! Workers de I/O del engine (F19): un pequeño pool de hilos para trabajo que no puede bloquear ni
//! al hilo de render ni al de comandos (decodificar imágenes, leer disco, generar miniaturas).

use super::sync::MutexExt;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;

struct Pool {
    sender: mpsc::Sender<Job>,
}

static POOL: OnceLock<Pool> = OnceLock::new();

/// Mitad de los núcleos (mínimo 2, máximo 8): deja aire al hilo de render y a los de la app.
fn worker_count() -> usize {
    thread::available_parallelism().map(|n| n.get() / 2).unwrap_or(2).clamp(2, 8)
}

fn pool() -> &'static Pool {
    POOL.get_or_init(|| {
        let (sender, receiver) = mpsc::channel::<Job>();
        let receiver = Arc::new(Mutex::new(receiver));
        for index in 0..worker_count() {
            let receiver = Arc::clone(&receiver);
            let spawned = thread::Builder::new().name(format!("PulseFlow-IO-{index}")).spawn(move || loop {
                // el lock sólo se sostiene mientras se espera el próximo job, no mientras se ejecuta
                let job = receiver.lock_safe().recv();
                let Ok(job) = job else { break };
                // un job que hace panic no puede matar al trabajador
                if catch_unwind(AssertUnwindSafe(job)).is_err() {
                    log::warn!("[workers] un job de I/O terminó en panic");
                }
            });
            if let Err(e) = spawned {
                log::warn!("[workers] no se pudo iniciar el trabajador {index}: {e}");
            }
        }
        Pool { sender }
    })
}

/// Ejecuta `job` en un hilo del pool y devuelve de inmediato.
pub fn submit(job: impl FnOnce() + Send + 'static) {
    if pool().sender.send(Box::new(job)).is_err() {
        log::warn!("[workers] el pool de I/O no está disponible");
    }
}

/// Ejecuta `job` en el pool y espera su resultado **sin bloquear el hilo** que lo pide: pensado para
/// comandos `async` de Tauri, que no pueden hacer trabajo pesado (decodificar, redimensionar, leer
/// disco) dentro de su cuerpo porque ocuparían un hilo del runtime. `None` si el job hizo panic.
pub async fn run<T: Send + 'static>(job: impl FnOnce() -> T + Send + 'static) -> Option<T> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    submit(move || {
        let _ = sender.send(job());
    });
    receiver.await.ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{mpsc, Arc};
    use std::time::Duration;

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
