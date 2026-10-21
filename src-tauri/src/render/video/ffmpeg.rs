//! Backend ffmpeg: decodifica con aceleración por hardware cuando puede y entrega NV12 por un pipe.
//!
//! - macOS: VideoToolbox (`-hwaccel videotoolbox`). Windows: D3D11VA (`-hwaccel d3d11va`).
//! - Si la decodificación por hardware muere a mitad de camino, se reintenta en software.
//! - `-stream_loop -1` reproduce en bucle; el PTS sale del contador de frames (no se reinicia al
//!   dar la vuelta) y de la tasa de cuadros que informa `ffprobe`.
//! - El video se escala para entrar en 1920×1080 **conservando la proporción** (antes se estiraba a
//!   16:9 y el modo Cover/Contain del compositor trabajaba con una proporción falsa).

use super::nv12::{guess_matrix, YuvMatrix};
use super::{DecodedFrame, FramePixels, FrameSink, VideoDecoder};
use crate::error::{AppError, AppResult};
use crate::utils::ffmpeg as ffmpeg_bin;
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::AppHandle;

const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;
const FALLBACK_FPS: (u32, u32) = (30, 1);

/// Tamaño de un frame NV12: Y (`w*h`) + CbCr (`ceil(w/2) * ceil(h/2) * 2`).
pub(super) fn nv12_frame_size(width: u32, height: u32) -> usize {
    (width * height + width.div_ceil(2) * height.div_ceil(2) * 2) as usize
}

/// PTS del frame `index` a `fps` (numerador, denominador), sin deriva acumulada.
pub(super) fn pts_for_frame(index: u64, fps: (u32, u32)) -> Duration {
    let (num, den) = (u128::from(fps.0.max(1)), u128::from(fps.1.max(1)));
    Duration::from_nanos((u128::from(index) * den * 1_000_000_000 / num) as u64)
}

/// `"30000/1001"` o `"25"` → (numerador, denominador). `None` si no es una tasa válida.
pub(super) fn parse_frame_rate(text: &str) -> Option<(u32, u32)> {
    let (num, den) = match text.split_once('/') {
        Some((n, d)) => (n.trim().parse::<u32>().ok()?, d.trim().parse::<u32>().ok()?),
        None => (text.trim().parse::<u32>().ok()?, 1),
    };
    (num > 0 && den > 0).then_some((num, den))
}

pub(super) struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub fps: (u32, u32),
    /// Matriz de color declarada por el archivo (`color_space` de ffprobe); `None` si no la trae.
    pub matrix: Option<YuvMatrix>,
}

/// `color_space` de ffprobe → matriz de conversión YCbCr→RGB. `None` para lo desconocido o no-YCbCr.
pub(super) fn matrix_from_color_space(name: &str) -> Option<YuvMatrix> {
    match name.trim().to_ascii_lowercase().as_str() {
        "bt709" => Some(YuvMatrix::Bt709),
        "bt470bg" | "smpte170m" | "bt470m" | "smpte240m" => Some(YuvMatrix::Bt601),
        "bt2020nc" | "bt2020c" | "bt2020_ncl" | "bt2020_cl" => Some(YuvMatrix::Bt2020),
        _ => None,
    }
}

/// Lee tamaño y tasa de cuadros del primer stream de video del JSON de `ffprobe`.
pub(super) fn video_info_from_probe(probe: &serde_json::Value) -> Option<VideoInfo> {
    let stream = probe["streams"].as_array()?.iter().find(|s| s["codec_type"] == "video")?;
    let width = u32::try_from(stream["width"].as_u64()?).ok()?;
    let height = u32::try_from(stream["height"].as_u64()?).ok()?;
    let fps = ["avg_frame_rate", "r_frame_rate"].iter().find_map(|key| parse_frame_rate(stream[key].as_str()?)).unwrap_or(FALLBACK_FPS);
    let matrix = stream["color_space"].as_str().and_then(matrix_from_color_space);
    Some(VideoInfo { width, height, fps, matrix })
}

/// Tamaño de salida: entra en `max_w × max_h` sin agrandar, conserva la proporción y es par
/// (NV12 submuestrea el color de a 2 píxeles).
pub(super) fn fit_even(width: u32, height: u32, max_w: u32, max_h: u32) -> (u32, u32) {
    let (width, height) = (width.max(2), height.max(2));
    let scale = f64::min(1.0, f64::min(f64::from(max_w) / f64::from(width), f64::from(max_h) / f64::from(height)));
    let even = |value: f64| ((value.floor() as u32) & !1).max(2);
    (even(f64::from(width) * scale), even(f64::from(height) * scale))
}

/// Fin de una sesión de decodificación.
#[derive(PartialEq, Eq)]
enum SessionEnd {
    /// El usuario puso stop (`running == false`).
    Stopped,
    /// EOF o error de lectura con `running` todavía en true.
    Error,
}

/// Decodificador ffmpeg en su propio hilo.
pub struct FfmpegDecoder {
    running: Arc<AtomicBool>,
    /// Proceso vivo, compartido para que `stop()` pueda matarlo desde fuera del hilo.
    child: Arc<Mutex<Option<Child>>>,
    thread: Option<JoinHandle<()>>,
}

impl VideoDecoder for FfmpegDecoder {
    fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);

        // Matar el proceso cierra el pipe de stdout: el `read_exact` del hilo devuelve error y el
        // hilo puede terminar y ser unido.
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut process) = slot.take() {
                let _ = process.kill();
            }
        }

        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

impl FfmpegDecoder {
    pub fn start(app: &AppHandle, path: &str, sink: Arc<dyn FrameSink>) -> AppResult<Self> {
        let ffmpeg = ffmpeg_bin::ffmpeg(app).to_string_lossy().into_owned();
        let running = Arc::new(AtomicBool::new(true));
        let child = Arc::new(Mutex::new(None));
        let (running_thread, child_thread) = (Arc::clone(&running), Arc::clone(&child));
        let video_path = path.to_string();
        let app = app.clone();

        // Plataformas soportadas: macOS (VideoToolbox) y Windows (D3D11VA).
        let hwaccel = if cfg!(target_os = "macos") { "videotoolbox" } else { "d3d11va" };

        let thread = thread::Builder::new()
            .name(format!("PulseFlow-VideoDec-{path}"))
            .spawn(move || {
                // `ffprobe` es async: se espera acá, en el hilo del decodificador, no en el de comandos.
                let info = tauri::async_runtime::block_on(ffmpeg_bin::probe(&app, &video_path)).ok().and_then(|probe| video_info_from_probe(&probe));
                let (width, height, fps, declared_matrix) = match &info {
                    Some(info) => {
                        let (w, h) = fit_even(info.width, info.height, MAX_WIDTH, MAX_HEIGHT);
                        (w, h, info.fps, info.matrix)
                    }
                    None => (MAX_WIDTH, MAX_HEIGHT, FALLBACK_FPS, None),
                };
                // la que declara el archivo; si no trae, la convención por alto
                let matrix = declared_matrix.unwrap_or_else(|| guess_matrix(height));
                let mut session = Session { ffmpeg: &ffmpeg, path: &video_path, width, height, fps, matrix, running: &running_thread, child: &child_thread, sink: sink.as_ref(), frames: 0 };

                // 1er intento: aceleración por hardware nativa.
                let end = session.run(Some(hwaccel));

                // Si el stream por hardware murió a mitad de camino, reintentar en software.
                if end == SessionEnd::Error && running_thread.load(Ordering::Relaxed) {
                    log::warn!("[VideoEngine] decodificación por hardware falló a mitad de camino, reintentando en software: {video_path}");
                    session.run(None);
                }
            })
            .map_err(|e| AppError::new(format!("Error iniciando decodificador de video: {e}")))?;

        Ok(Self { running, child, thread: Some(thread) })
    }
}

struct Session<'a> {
    ffmpeg: &'a str,
    path: &'a str,
    width: u32,
    height: u32,
    fps: (u32, u32),
    matrix: YuvMatrix,
    running: &'a Arc<AtomicBool>,
    child: &'a Arc<Mutex<Option<Child>>>,
    sink: &'a dyn FrameSink,
    /// Frames entregados en total: el PTS no se reinicia entre sesiones ni al dar la vuelta del loop.
    frames: u64,
}

impl Session<'_> {
    /// Ejecuta una sesión (spawn + bucle de lectura) y devuelve cómo terminó.
    fn run(&mut self, hwaccel: Option<&str>) -> SessionEnd {
        // `hwaccel` es una opción de entrada y debe ir antes de `-i`.
        let mut args: Vec<String> = Vec::new();
        if let Some(accel) = hwaccel {
            args.extend(["-hwaccel".into(), accel.into()]);
        }
        args.extend(["-stream_loop".into(), "-1".into()]); // Bucle infinito continuo
        args.push("-re".into()); // Tasa de refresco en tiempo real
        args.extend(["-i".into(), self.path.into()]);
        args.extend(["-vf".into(), format!("scale={}:{}", self.width, self.height)]);
        args.extend(["-f".into(), "rawvideo".into(), "-pix_fmt".into(), "nv12".into()]);
        args.push("-an".into()); // Sin audio
        args.push("-sn".into()); // Sin subtítulos
        args.extend(["-loglevel".into(), "error".into()]);
        args.push("-".into()); // Enviar a stdout en streaming

        let mut process = match Command::new(self.ffmpeg).args(&args).stdout(Stdio::piped()).stderr(Stdio::null()).spawn() {
            Ok(process) => process,
            Err(e) => {
                log::warn!("[VideoEngine] no se pudo iniciar ffmpeg ({hwaccel:?}): {e}");
                return SessionEnd::Error;
            }
        };

        // Tomar stdout antes de mover el proceso al slot compartido.
        let stdout = process.stdout.take();
        if let Ok(mut slot) = self.child.lock() {
            *slot = Some(process);
        }

        let end = match stdout {
            Some(stdout) => self.read_frames(stdout, hwaccel),
            None => {
                log::warn!("[VideoEngine] ffmpeg no expuso stdout ({hwaccel:?}) en {}", self.path);
                SessionEnd::Error
            }
        };

        // Matar el proceso (si sigue vivo) y liberar el slot.
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut p) = slot.take() {
                let _ = p.kill();
            }
        }
        end
    }

    fn read_frames(&mut self, mut stdout: impl Read, hwaccel: Option<&str>) -> SessionEnd {
        let mut buffer = vec![0u8; nv12_frame_size(self.width, self.height)];
        let luma = (self.width * self.height) as usize;
        let matrix = self.matrix;

        while self.running.load(Ordering::Relaxed) {
            if let Err(e) = stdout.read_exact(&mut buffer) {
                // EOF o error de lectura: reportar y salir (si no fue un stop).
                if self.running.load(Ordering::Relaxed) {
                    log::warn!("[VideoEngine] fin del stream ({hwaccel:?}) en {}: {e}", self.path);
                    return SessionEnd::Error;
                }
                break;
            }

            let (y, uv) = buffer.split_at(luma);
            self.sink.push(DecodedFrame { pts: pts_for_frame(self.frames, self.fps), pixels: FramePixels::Nv12Cpu { width: self.width, height: self.height, y, uv, matrix, full_range: false } });
            self.frames += 1;
        }
        SessionEnd::Stopped
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;

    #[test]
    fn frame_size_nv12_is_one_and_a_half_bytes_per_pixel() {
        assert_eq!(nv12_frame_size(1920, 1080), 1920 * 1080 * 3 / 2);
        assert_eq!(nv12_frame_size(4, 4), 24);
        // dimensión impar: el plano CbCr se redondea hacia arriba
        assert_eq!(nv12_frame_size(3, 3), 9 + 2 * 2 * 2);
    }

    #[test]
    fn pts_follows_the_frame_rate() {
        assert_eq!(pts_for_frame(0, (30, 1)), Duration::ZERO);
        assert_eq!(pts_for_frame(30, (30, 1)), Duration::from_secs(1));
        // NTSC: 30000 frames a 30000/1001 fps son exactamente 1001 s (sin deriva)
        assert_eq!(pts_for_frame(30_000, (30_000, 1001)), Duration::from_secs(1001));
    }

    #[test]
    fn ffmpeg_frames_carry_monotonic_pts() {
        // el contador de frames sigue creciendo al dar la vuelta del loop (`-stream_loop -1`)
        let mut last = Duration::ZERO;
        for index in 1..5_000u64 {
            let pts = pts_for_frame(index, (24, 1));
            assert!(pts > last, "frame {index}");
            last = pts;
        }
    }

    #[test]
    fn frame_rate_text_is_parsed() {
        assert_eq!(parse_frame_rate("30/1"), Some((30, 1)));
        assert_eq!(parse_frame_rate("30000/1001"), Some((30_000, 1001)));
        assert_eq!(parse_frame_rate("25"), Some((25, 1)));
        assert_eq!(parse_frame_rate("0/0"), None);
        assert_eq!(parse_frame_rate("abc"), None);
    }

    #[test]
    fn video_info_is_read_from_ffprobe_json() {
        let probe = json!({ "streams": [
            { "codec_type": "audio" },
            { "codec_type": "video", "width": 3840, "height": 2160, "avg_frame_rate": "60/1", "r_frame_rate": "60/1" }
        ]});
        let info = video_info_from_probe(&probe).expect("hay un stream de video");
        assert_eq!((info.width, info.height, info.fps), (3840, 2160, (60, 1)));

        assert!(video_info_from_probe(&json!({ "streams": [{ "codec_type": "audio" }] })).is_none());
        assert!(video_info_from_probe(&json!({})).is_none());
    }

    #[test]
    fn color_space_names_map_to_matrices() {
        assert_eq!(matrix_from_color_space("bt709"), Some(YuvMatrix::Bt709));
        assert_eq!(matrix_from_color_space("bt470bg"), Some(YuvMatrix::Bt601));
        assert_eq!(matrix_from_color_space("smpte170m"), Some(YuvMatrix::Bt601));
        assert_eq!(matrix_from_color_space("bt2020nc"), Some(YuvMatrix::Bt2020));
        assert_eq!(matrix_from_color_space("BT2020C"), Some(YuvMatrix::Bt2020), "sin importar mayúsculas");
        assert_eq!(matrix_from_color_space("unknown"), None);
        assert_eq!(matrix_from_color_space("gbr"), None);
        assert_eq!(matrix_from_color_space(""), None);
    }

    #[test]
    fn video_info_reads_the_declared_matrix() {
        let tagged = json!({ "streams": [{ "codec_type": "video", "width": 640, "height": 360, "avg_frame_rate": "30/1", "color_space": "bt709" }] });
        assert_eq!(video_info_from_probe(&tagged).expect("info").matrix, Some(YuvMatrix::Bt709));

        let untagged = json!({ "streams": [{ "codec_type": "video", "width": 640, "height": 360, "avg_frame_rate": "30/1" }] });
        assert_eq!(video_info_from_probe(&untagged).expect("info").matrix, None, "sin etiqueta se adivina después, por el alto");
    }

    #[test]
    fn output_size_fits_the_cap_keeps_aspect_and_is_even() {
        assert_eq!(fit_even(3840, 2160, 1920, 1080), (1920, 1080));
        assert_eq!(fit_even(1280, 720, 1920, 1080), (1280, 720), "no agranda");
        // 4:3 → entra por el alto y conserva la proporción (antes se estiraba a 16:9)
        assert_eq!(fit_even(1440, 1080, 1920, 1080), (1440, 1080));
        assert_eq!(fit_even(1001, 563, 1920, 1080), (1000, 562), "pares");
        let (w, h) = fit_even(0, 0, 1920, 1080);
        assert!(w >= 2 && h >= 2);
    }
}
