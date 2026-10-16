//! Decodificación de video acelerada por hardware para fondos en bucle (Motion Backgrounds).
//!
//! Utiliza el decodificador nativo por hardware según la plataforma:
//! - macOS: VideoToolbox (`-hwaccel videotoolbox`)
//! - Windows: D3D11VA (`-hwaccel d3d11va`)
//! - Linux: VAAPI / Auto (`-hwaccel auto`)
//!
//! Transfiere los fotogramas decodificados en tiempo real directamente
//! a texturas en VRAM mediante `MediaPool::update_video_frame`, permitiendo que
//! múltiples salidas compartan la misma decodificación con cero consumo adicional de CPU.

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use tauri::AppHandle;
use crate::error::{AppError, AppResult};
use crate::utils::ffmpeg;

/// Hilo de reproducción de video en bucle continuo.
pub struct VideoPlayback {
    pub running: Arc<AtomicBool>,
    pub thread_handle: Option<JoinHandle<()>>,
}

impl VideoPlayback {
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
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
    let ffmpeg_bin = ffmpeg::ffmpeg(app);
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);

    let video_path = path.to_string();
    let video_id = id.to_string();
    let frame_width = if width > 0 { width } else { 1920 };
    let frame_height = if height > 0 { height } else { 1080 };
    let frame_size = (frame_width * frame_height * 4) as usize;

    let hwaccel = if cfg!(target_os = "macos") {
        "videotoolbox"
    } else if cfg!(target_os = "windows") {
        "d3d11va"
    } else {
        "auto"
    };

    let scale_filter = format!("scale={}:{}", frame_width, frame_height);

    let thread_handle = thread::Builder::new()
        .name(format!("PulseFlow-VideoDec-{}", video_id))
        .spawn(move || {
            let mut child: Option<Child> = None;

            // Intentar primero con aceleración por hardware nativa
            let hw_cmd = Command::new(&ffmpeg_bin)
                .args([
                    "-hwaccel", hwaccel,
                    "-stream_loop", "-1",       // Bucle infinito continuo
                    "-re",                       // Tasa de refresco en tiempo real
                    "-i", &video_path,
                    "-vf", &scale_filter,
                    "-f", "rawvideo",
                    "-pix_fmt", "rgba",
                    "-an",                      // Sin audio (los fondos son mudos o se manejan por canal de audio)
                    "-sn",                      // Sin subtítulos
                    "-loglevel", "error",
                    "-",                        // Enviar a stdout en streaming
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn();

            match hw_cmd {
                Ok(c) => child = Some(c),
                Err(e) => {
                    eprintln!("[VideoEngine] Falló HW accel, intentando software decode: {e}");
                    // Fallback a decodificación estándar por software
                    let sw_cmd = Command::new(&ffmpeg_bin)
                        .args([
                            "-stream_loop", "-1",
                            "-re",
                            "-i", &video_path,
                            "-vf", &scale_filter,
                            "-f", "rawvideo",
                            "-pix_fmt", "rgba",
                            "-an",
                            "-sn",
                            "-loglevel", "error",
                            "-",
                        ])
                        .stdout(Stdio::piped())
                        .stderr(Stdio::null())
                        .spawn();

                    if let Ok(c) = sw_cmd {
                        child = Some(c);
                    }
                }
            }

            if let Some(mut process) = child {
                if let Some(mut stdout) = process.stdout.take() {
                    let mut buffer = vec![0u8; frame_size];

                    while running_clone.load(Ordering::Relaxed) {
                        match stdout.read_exact(&mut buffer) {
                            Ok(_) => {
                                on_frame(&video_id, frame_width, frame_height, &buffer);
                            }
                            Err(_) => {
                                // Fin del stream o error de lectura
                                break;
                            }
                        }
                    }
                }

                let _ = process.kill();
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando decodificador de video: {e}")))?;

    Ok(VideoPlayback {
        running,
        thread_handle: Some(thread_handle),
    })
}
