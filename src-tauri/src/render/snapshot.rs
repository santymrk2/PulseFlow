//! Snapshot offscreen del engine (`RENDER_SNAPSHOT`).
//!
//! Renderiza una `ScenePayload` a una textura WGPU sin superficie ni ventana
//! (no hace falta monitor ni salida abierta) y la guarda como PNG. Es la base
//! de los tests visuales del engine: un agente o CI puede verificar qué dibuja
//! el motor sin hardware de presentación.

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

use super::media::{self, MediaPool};
use super::scene::ScenePayload;
use super::text::TextEngine;

/// Formato de la textura offscreen: RGBA 8 bits con sRGB, el mismo que el
/// swapchain de la salida y el formato natural del PNG.
const SNAPSHOT_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8UnormSrgb;

/// Renderiza la escena en `<base_dir>/snapshots/<file_name>.png` y devuelve la
/// ruta completa escrita.
///
/// `file_name` debe ser un nombre simple (sin ruta): se rechazan `/`, `\` y
/// `..` para que ningún caller pueda escribir fuera del directorio de snapshots.
/// Los fondos de tipo video no se decodifican en un snapshot (sólo imagen).
pub fn render_snapshot(
    scene: &ScenePayload,
    width: u32,
    height: u32,
    base_dir: &Path,
    file_name: &str,
) -> AppResult<PathBuf> {
    let name = safe_file_name(file_name)?;
    let dir = base_dir.join("snapshots");
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::new(format!("Error creando '{}': {e}", dir.display())))?;
    let path = dir.join(name);

    let width = width.max(1);
    let height = height.max(1);
    let rgba = render_snapshot_rgba(scene, width, height)?;
    image::save_buffer(&path, &rgba, width, height, image::ColorType::Rgba8)
        .map_err(|e| AppError::new(format!("Error guardando snapshot '{}': {e}", path.display())))?;
    Ok(path)
}

/// Valida que `file_name` sea un nombre de archivo simple y devuelve el nombre
/// con extensión `.png`. Se rechazan rutas (`/`, `\`), `..`, cadenas vacías y
/// los caracteres inválidos también en nombres de archivo de Windows.
fn safe_file_name(file_name: &str) -> AppResult<String> {
    let name = file_name.trim();
    if name.is_empty() {
        return Err(AppError::new("RENDER_SNAPSHOT: el nombre de archivo está vacío"));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::new(format!(
            "RENDER_SNAPSHOT: nombre de archivo inválido (se espera un nombre simple, sin ruta): {file_name}"
        )));
    }
    if name.chars().any(|c| matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err(AppError::new(format!(
            "RENDER_SNAPSHOT: nombre de archivo con caracteres no permitidos: {file_name}"
        )));
    }
    Ok(if name.ends_with(".png") {
        name.to_string()
    } else {
        format!("{name}.png")
    })
}

/// Renderiza la escena a una textura offscreen y devuelve los píxeles RGBA8
/// sin padding, fila por fila de arriba a abajo (`width * height * 4` bytes).
pub fn render_snapshot_rgba(scene: &ScenePayload, width: u32, height: u32) -> AppResult<Vec<u8>> {
    let width = width.max(1);
    let height = height.max(1);

    // 1. Instance + adapter sin superficie (no hay ventana que presentar).
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: None,
        force_fallback_adapter: false,
        ..Default::default()
    }))
    .map_err(|e| AppError::new(format!("GPU no disponible para snapshot: {e}")))?;

    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("PulseFlow Snapshot Device"),
            ..Default::default()
        },
    ))
    .map_err(|e| AppError::new(format!("Device no disponible para snapshot: {e}")))?;

    // 2. Textura offscreen + render pass con limpieza a negro.
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("PulseFlow Snapshot Texture"),
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: SNAPSHOT_FORMAT,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("PulseFlow Snapshot Encoder"),
    });

    {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("PulseFlow Snapshot Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
                depth_slice: None,
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });

        // Capa 1: fondo de imagen (los videos no se decodifican fuera del bucle).
        if let Some(bg) = scene.background_media() {
            if bg.media_type == "image" {
                if let Some(ref path_str) = bg.path {
                    let pipeline = media::BackgroundPipeline::new(&device, SNAPSHOT_FORMAT);
                    let mut pool = MediaPool::new();
                    let texture = pool.load_image(&device, &queue, &pipeline, path_str)?;
                    pipeline.render(
                        &queue,
                        &mut render_pass,
                        &texture,
                        width,
                        height,
                        bg.opacity,
                        bg.aspect_mode,
                    );
                }
            }
        }

        // Capa 2: texto principal.
        let blocks = scene.text_blocks();
        if !blocks.is_empty() {
            let mut text_engine = TextEngine::new(&device, &queue, SNAPSHOT_FORMAT);
            text_engine.render(&device, &queue, &mut render_pass, width, height, &blocks)?;
        }
    }

    queue.submit([encoder.finish()]);

    // 3. Copiar la textura a un buffer legible (filas alineadas a 256 bytes).
    let unpadded_bytes_per_row = width * 4;
    let bytes_per_row = (unpadded_bytes_per_row + wgpu::COPY_BYTES_PER_ROW_ALIGNMENT - 1)
        / wgpu::COPY_BYTES_PER_ROW_ALIGNMENT
        * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;

    let buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("PulseFlow Snapshot Buffer"),
        size: u64::from(bytes_per_row) * u64::from(height),
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    let mut copy_encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("PulseFlow Snapshot Copy Encoder"),
    });
    copy_encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture: &texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        wgpu::TexelCopyBufferInfo {
            buffer: &buffer,
            layout: wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(bytes_per_row),
                rows_per_image: None,
            },
        },
        wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
    );
    queue.submit([copy_encoder.finish()]);

    // 4. Mapear el buffer y quitar el padding de cada fila.
    let slice = buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |result| {
        let _ = tx.send(result);
    });
    device
        .poll(wgpu::PollType::wait_indefinitely())
        .map_err(|e| AppError::new(format!("Error esperando el buffer de snapshot: {e}")))?;
    rx.recv()
        .map_err(|_| AppError::new("El mapeo del buffer de snapshot no respondió"))?
        .map_err(|e| AppError::new(format!("No se pudo leer el buffer de snapshot: {e:?}")))?;

    let mapped = slice
        .get_mapped_range()
        .map_err(|e| AppError::new(format!("No se pudo acceder al buffer de snapshot: {e}")))?;
    let unpadded = (unpadded_bytes_per_row) as usize;
    let mut rgba = Vec::with_capacity(unpadded * height as usize);
    for row in 0..height {
        let start = (row * bytes_per_row) as usize;
        rgba.extend_from_slice(&mapped[start..start + unpadded]);
    }
    drop(mapped);
    buffer.unmap();

    Ok(rgba)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::scene::{SceneItem, ScenePayload, SceneTextItem};
    use serde_json::json;

    /// Escena mínima con un texto blanco centrado en una caja conocida.
    fn text_scene() -> ScenePayload {
        let value = json!({
            "outputId": "snapshot-test",
            "stage": false,
            "width": 640,
            "height": 360,
            "background": null,
            "items": [
                {
                    "type": "text",
                    "x": 0, "y": 120, "width": 640, "height": 120,
                    "align": "center", "verticalAlign": "center",
                    "lineHeight": 1.2, "fontSize": 64, "fontWeight": 700,
                    "color": [1, 1, 1, 1],
                    "text": "PULSEFLOW"
                }
            ],
            "transition": null,
            "plainText": "PULSEFLOW"
        });
        serde_json::from_value(value).expect("payload de prueba válido")
    }

    #[test]
    fn snapshot_dibuja_texto_no_negro_y_guarda_png() {
        let scene = text_scene();
        let width = 640u32;
        let height = 360u32;

        let rgba = render_snapshot_rgba(&scene, width, height).expect("render del snapshot");

        assert_eq!(rgba.len(), (width * height * 4) as usize);

        // Zona del texto: y = 120..240. Debe haber píxeles claros (el texto)
        // y el resto de la escena debe quedar en negro.
        let mut lit_in_text_zone = 0usize;
        let mut lit_outside = 0usize;
        for (i, pixel) in rgba.chunks_exact(4).enumerate() {
            let y = (i as u32) / width;
            let luminosity = u32::from(pixel[0]) + u32::from(pixel[1]) + u32::from(pixel[2]);
            let lit = luminosity > 60;
            if lit {
                if (120..240).contains(&y) {
                    lit_in_text_zone += 1;
                } else {
                    lit_outside += 1;
                }
            }
        }
        assert!(
            lit_in_text_zone > 200,
            "El texto debe dejar píxeles no negros en su zona (hay {lit_in_text_zone})"
        );
        assert_eq!(lit_outside, 0, "Fuera de la zona del texto todo debe ser negro");

        // El PNG generado se puede abrir y tiene las dimensiones pedidas.
        let dir = std::env::temp_dir().join("pulseflow-snapshot-test");
        std::fs::create_dir_all(&dir).expect("carpeta temporal");
        let png_path = render_snapshot(&scene, width, height, &dir, "snapshot_texto")
            .expect("guardar PNG");
        assert_eq!(png_path, dir.join("snapshots").join("snapshot_texto.png"));

        let saved = image::open(&png_path).expect("abrir el PNG generado");
        assert_eq!(saved.width(), width);
        assert_eq!(saved.height(), height);

        let _ = std::fs::remove_file(&png_path);
    }

    #[test]
    fn snapshot_rechaza_nombres_con_ruta() {
        let scene = text_scene();
        let dir = std::env::temp_dir().join("pulseflow-snapshot-reject");
        std::fs::create_dir_all(&dir).expect("carpeta temporal");

        for bad in ["../x", "/tmp/evil.png", "sub\\dir", "", "  ", "a..b", "c:/x"] {
            let result = render_snapshot(&scene, 8, 8, &dir, bad);
            assert!(
                result.is_err(),
                "El nombre '{bad}' debe ser rechazado"
            );
        }

        // No debe haberse escrito nada fuera de <dir>/snapshots/.
        assert!(!dir.join("x.png").exists(), "No debe escribirse fuera de snapshots/");
        let Ok(entries) = std::fs::read_dir(dir.join("snapshots")) else {
            return; // ni siquiera se creó la carpeta: también válido
        };
        assert_eq!(entries.count(), 0, "No debe haber archivos de nombres rechazados");
    }

    #[test]
    fn snapshot_acepta_nombre_con_extension_png() {
        assert_eq!(safe_file_name("foto").expect("válido"), "foto.png");
        assert_eq!(safe_file_name("foto.png").expect("válido"), "foto.png");
    }

    #[test]
    fn snapshot_escena_vacia_da_todo_negro() {
        let scene = ScenePayload {
            output_id: "snapshot-empty".to_string(),
            stage: false,
            width: 320.0,
            height: 180.0,
            background: None,
            items: vec![SceneItem::Unknown],
            transition: None,
            plain_text: String::new(),
            next_text: None,
        };

        let rgba = render_snapshot_rgba(&scene, 320, 180).expect("render del snapshot");
        // El clear del render pass es negro opaco: RGB en 0 (el alfa puede ser 255).
        let all_black = rgba
            .chunks_exact(4)
            .all(|pixel| pixel[0] == 0 && pixel[1] == 0 && pixel[2] == 0);
        assert!(all_black, "Una escena vacía debe ser todo negro");
    }

    #[test]
    fn text_scene_usa_bloques_del_engine() {
        let scene = text_scene();
        let blocks = scene.text_blocks();
        assert_eq!(blocks.len(), 1);
        assert!(matches!(scene.items[0], SceneItem::Text(SceneTextItem { .. })));
    }
}
