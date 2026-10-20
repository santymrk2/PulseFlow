//! Decodificación de video acelerada por hardware para fondos en bucle (Motion Backgrounds).
//!
//! Utiliza el decodificador nativo por hardware según la plataforma:
//! - macOS: VideoToolbox (`-hwaccel videotoolbox`)
//! - Windows: D3D11VA (`-hwaccel d3d11va`)
//!
//! Transfiere los fotogramas decodificados en tiempo real directamente
//! a texturas en VRAM mediante `MediaStore::update_video_frame`, permitiendo que
//! múltiples salidas compartan la misma decodificación con cero consumo adicional de CPU.
//!
//! Ciclo de vida (F8.1):
//! - `stop()` mata el proceso ffmpeg (desbloquea el `read_exact` del hilo) y une el hilo.
//! - EOF o error de lectura se reportan por stderr.
//! - Si la decodificación por hardware falla a mitad de camino, se reintenta en software.

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use tauri::AppHandle;
use crate::error::{AppError, AppResult};
use crate::utils::ffmpeg;

/// Fin de una sesión de decodificación.
#[derive(PartialEq, Eq)]
enum SessionEnd {
    /// El usuario puso stop (`running == false`).
    Stopped,
    /// EOF o error de lectura con `running` todavía en true.
    Error,
}

/// Hilo de reproducción de video en bucle continuo.
pub struct VideoPlayback {
    pub running: Arc<AtomicBool>,
    /// Proceso ffmpeg vivo, compartido para que `stop()` pueda matarlo desde fuera del hilo.
    child: Arc<Mutex<Option<Child>>>,
    pub thread_handle: Option<JoinHandle<()>>,
}

impl VideoPlayback {
    /// Detiene la reproducción: mata el proceso (desbloquea la lectura del hilo) y une el hilo.
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);

        // Matar el proceso cierra el pipe de stdout, de modo que el `read_exact`
        // del hilo devuelve error y el hilo puede terminar y ser unido.
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut process) = slot.take() {
                let _ = process.kill();
            }
        }

        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

/// Inicia la reproducción en bucle de un video con decodificación acelerada por hardware.
pub fn start_video_playback<F>(
    app: &AppHandle,
    path: &str,
    id: &str,
    width: u32,
    height: u32,
    mut on_frame: F,
) -> AppResult<VideoPlayback>
where
    F: FnMut(&str, u32, u32, &[u8]) + Send + 'static,
{
    let ffmpeg_bin = ffmpeg::ffmpeg(app).to_string_lossy().into_owned();
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);
    let child = Arc::new(Mutex::new(None));
    let child_clone = Arc::clone(&child);

    let video_path = path.to_string();
    let video_id = id.to_string();
    let frame_width = if width > 0 { width } else { 1920 };
    let frame_height = if height > 0 { height } else { 1080 };
    let frame_size = (frame_width * frame_height * 4) as usize;

    // Plataformas soportadas: macOS (VideoToolbox) y Windows (D3D11VA).
    let hwaccel = if cfg!(target_os = "macos") {
        "videotoolbox"
    } else {
        "d3d11va"
    };

    let thread_handle = thread::Builder::new()
        .name(format!("PulseFlow-VideoDec-{}", video_id))
        .spawn(move || {
            // 1er intento: aceleración por hardware nativa.
            let end = run_session(
                &ffmpeg_bin,
                Some(hwaccel),
                &video_path,
                &video_id,
                frame_width,
                frame_height,
                frame_size,
                &running_clone,
                &child_clone,
                &mut on_frame,
            );

            // Si el stream HW murió a mitad de camino (running todavía true), reintentar en software.
            if end == SessionEnd::Error && running_clone.load(Ordering::Relaxed) {
                eprintln!("[VideoEngine] decodificación por hardware falló a mitad de camino, reintentando en software: {video_id}");
                run_session(
                    &ffmpeg_bin,
                    None,
                    &video_path,
                    &video_id,
                    frame_width,
                    frame_height,
                    frame_size,
                    &running_clone,
                    &child_clone,
                    &mut on_frame,
                );
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando decodificador de video: {e}")))?;

    Ok(VideoPlayback {
        running,
        child,
        thread_handle: Some(thread_handle),
    })
}

/// Ejecuta una sesión de decodificación (spawn + bucle de lectura) y devuelve cómo terminó.
#[allow(clippy::too_many_arguments)]
fn run_session<F>(
    ffmpeg_bin: &str,
    hwaccel: Option<&str>,
    video_path: &str,
    video_id: &str,
    frame_width: u32,
    frame_height: u32,
    frame_size: usize,
    running: &Arc<AtomicBool>,
    child_slot: &Arc<Mutex<Option<Child>>>,
    on_frame: &mut F,
) -> SessionEnd
where
    F: FnMut(&str, u32, u32, &[u8]),
{
    let scale_filter = format!("scale={}:{}", frame_width, frame_height);

    // `hwaccel` es una opción de entrada y debe ir antes de `-i`.
    let mut args: Vec<String> = Vec::new();
    if let Some(accel) = hwaccel {
        args.push("-hwaccel".to_string());
        args.push(accel.to_string());
    }
    args.push("-stream_loop".to_string());
    args.push("-1".to_string()); // Bucle infinito continuo
    args.push("-re".to_string()); // Tasa de refresco en tiempo real
    args.push("-i".to_string());
    args.push(video_path.to_string());
    args.push("-vf".to_string());
    args.push(scale_filter);
    args.push("-f".to_string());
    args.push("rawvideo".to_string());
    args.push("-pix_fmt".to_string());
    args.push("rgba".to_string());
    args.push("-an".to_string()); // Sin audio
    args.push("-sn".to_string()); // Sin subtítulos
    args.push("-loglevel".to_string());
    args.push("error".to_string());
    args.push("-".to_string()); // Enviar a stdout en streaming

    let process = Command::new(ffmpeg_bin)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();

    let mut process = match process {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[VideoEngine] no se pudo iniciar ffmpeg ({:?}): {e}", hwaccel);
            return SessionEnd::Error;
        }
    };

    // Tomar stdout antes de mover el proceso al slot compartido.
    let stdout = process.stdout.take();

    // Compartir el proceso para que `stop()` pueda matarlo desde otro hilo.
    if let Ok(mut slot) = child_slot.lock() {
        *slot = Some(process);
    }

    let end = if let Some(mut stdout) = stdout {
        let mut buffer = vec![0u8; frame_size];
        let mut end = SessionEnd::Stopped;

        while running.load(Ordering::Relaxed) {
            match stdout.read_exact(&mut buffer) {
                Ok(_) => on_frame(video_id, frame_width, frame_height, &buffer),
                Err(e) => {
                    // EOF o error de lectura: reportar y salir.
                    if running.load(Ordering::Relaxed) {
                        eprintln!("[VideoEngine] fin del stream ({:?}) en {video_id}: {e}", hwaccel);
                        end = SessionEnd::Error;
                    }
                    break;
                }
            }
        }

        end
    } else {
        eprintln!("[VideoEngine] ffmpeg no expuso stdout ({:?}) en {video_id}", hwaccel);
        SessionEnd::Error
    };

    // Matar el proceso (si sigue vivo) y liberar el slot.
    if let Ok(mut slot) = child_slot.lock() {
        if let Some(mut p) = slot.take() {
            let _ = p.kill();
        }
    }

    end
}
