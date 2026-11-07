//! Motor tipográfico de alto rendimiento en GPU con glyphon y cosmic-text.
//!
//! Soporta:
//! - Carga automática de fuentes del sistema operativo y fuentes personalizadas.
//! - Atlas de glifos en VRAM con rasterización cacheada.
//! - Efectos en GPU sin coste de CPU:
//!   - Sombra arrojada (Drop Shadow).
//!   - Contorno perimetral (Stroke / Outline).
//! - Auto-ajuste de texto (word wrapping) y alineación configurable.

use std::path::Path;
use cosmic_text::{
    Align, Attrs, Buffer, Family, FontSystem, Metrics, Shaping, Style, SwashCache, Weight, Wrap,
};
use glyphon::{
    Cache, Color, Resolution, TextAtlas, TextArea, TextBounds, TextRenderer, Viewport,
};
use wgpu::{Device, MultisampleState, Queue, RenderPass, TextureFormat};
use crate::error::{AppError, AppResult};
use crate::render::types::TextBlock;

/// Administrador de fuentes y caché de rasterización de glifos.
pub struct FontAtlas {
    pub font_system: FontSystem,
    pub swash_cache: SwashCache,
}

impl FontAtlas {
    pub fn new() -> Self {
        let mut font_system = FontSystem::new();

        // Intentar cargar fuentes adicionales locales si existen
        let potential_font_dirs = [
            "public/fonts",
            "../public/fonts",
            "../../public/fonts",
        ];

        for dir in potential_font_dirs {
            let path = Path::new(dir);
            if path.exists() && path.is_dir() {
                font_system.db_mut().load_fonts_dir(path);
            }
        }

        Self {
            font_system,
            swash_cache: SwashCache::new(),
        }
    }

    /// Carga una fuente desde un buffer binario (.ttf, .otf, .woff2).
    pub fn load_font_bytes(&mut self, font_data: Vec<u8>) {
        self.font_system.db_mut().load_font_data(font_data);
    }
}

impl Default for FontAtlas {
    fn default() -> Self {
        Self::new()
    }
}

/// Capa de texto dentro de un frame. Cada capa tiene su propio `TextRenderer`: glyphon escribe los
/// vértices con `write_buffer` en offset 0, así que dos `prepare` del mismo renderer en un frame
/// se pisan entre sí.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextLayer {
    Slide,
    Overlay,
    Previous,
    Chrome,
}

/// Rectángulo de subrayado o tachado, en píxeles del destino (glyphon 0.12 no los dibuja).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Decoration {
    /// x, y, ancho, alto.
    pub rect: [f32; 4],
    pub color: [f32; 4],
}

/// Pipeline de texto WGPU que renderiza glifos cacheados en VRAM.
pub struct TextEngine {
    pub font_atlas: FontAtlas,
    pub cache: Cache,
    pub atlas: TextAtlas,
    pub viewport: Viewport,
    renderers: [TextRenderer; 4],
    /// Decoraciones de la última llamada a `render` de cada capa (F23.18).
    decorations: [Vec<Decoration>; 4],
}

impl TextEngine {
    pub fn new(device: &Device, queue: &Queue, format: TextureFormat) -> Self {
        let font_atlas = FontAtlas::new();
        let cache = Cache::new(device);
        let mut atlas = TextAtlas::new(device, queue, &cache, format);
        let viewport = Viewport::new(device, &cache);
        let renderers = std::array::from_fn(|_| {
            TextRenderer::new(&mut atlas, device, MultisampleState::default(), None)
        });

        Self {
            font_atlas,
            cache,
            atlas,
            viewport,
            renderers,
            decorations: Default::default(),
        }
    }

    /// Recorta el atlas de glifos: libera los que el frame no usó. Se llama tras presentar cada frame.
    pub fn end_frame(&mut self) {
        self.atlas.trim();
    }

    /// Subrayados y tachados de la última `render` de la capa. Quien llama los dibuja con
    /// `ShapePipeline::draw_decorations` en el MISMO pass, justo después de `render`: así quedan
    /// encima del texto y de la caja de F23.16 (que se dibuja antes del texto).
    pub fn decorations(&self, layer: TextLayer) -> &[Decoration] {
        &self.decorations[layer as usize]
    }

    /// Prepara y renderiza los bloques de texto de la escena actual en el render pass.
    #[allow(clippy::too_many_arguments)] // firma fijada por F23.4
    pub fn render(
        &mut self,
        layer: TextLayer,
        device: &Device,
        queue: &Queue,
        render_pass: &mut RenderPass<'_>,
        screen_width: u32,
        screen_height: u32,
        blocks: &[TextBlock],
    ) -> AppResult<()> {
        self.decorations[layer as usize].clear();
        if blocks.is_empty() {
            return Ok(());
        }

        let resolution = Resolution {
            width: screen_width,
            height: screen_height,
        };
        self.viewport.update(queue, resolution);

        // Un buffer principal por bloque y, si hay sombra/contorno, buffers teñidos
        // con ese color (el color por tramo del texto principal no debe afectarles).
        let mut mains = Vec::new();
        let mut shadows: Vec<Option<Buffer>> = Vec::new();
        let mut strokes: Vec<Option<Buffer>> = Vec::new();
        let mut layouts: Vec<BlockLayout> = Vec::new();

        for block in blocks {
            let scale = match block.design_width {
                Some(dw) if dw > 0.0 => screen_width as f32 / dw,
                _ => 1.0,
            };
            let fs = &mut self.font_atlas.font_system;
            let (main, offset_y) = build_buffer(fs, block, None);
            let shadow = match (block.shadow_color, block.shadow_offset) {
                (Some(color), Some(_)) => Some(build_buffer(fs, block, Some(color)).0),
                _ => None,
            };
            let stroke = match (block.outline_color, block.outline_width) {
                (Some(color), Some(w)) if w > 0.0 => Some(build_buffer(fs, block, Some(color)).0),
                _ => None,
            };
            layouts.push(BlockLayout { scale, offset_y });
            mains.push(main);
            shadows.push(shadow);
            strokes.push(stroke);
        }

        // Capas: 1) sombra, 2) contorno en 8 direcciones, 3) texto principal.
        let mut text_areas = Vec::new();
        let mut decorations = Vec::new();

        for (i, block) in blocks.iter().enumerate() {
            let BlockLayout { scale, offset_y } = layouts[i];
            let base_x = block.x * scale;
            let base_y = (block.y + offset_y) * scale;

            if let (Some(buffer), Some(shadow_color), Some(offset)) =
                (shadows[i].as_ref(), block.shadow_color, block.shadow_offset)
            {
                text_areas.push(TextArea {
                    buffer,
                    left: base_x + offset[0] * scale,
                    top: base_y + offset[1] * scale,
                    scale,
                    bounds: TextBounds::default(),
                    default_color: to_glyphon_color(shadow_color),
                    custom_glyphs: &[],
                });
            }

            if let (Some(buffer), Some(outline_color), Some(stroke_w)) =
                (strokes[i].as_ref(), block.outline_color, block.outline_width)
            {
                let w = stroke_w * scale;
                let offsets = [
                    (-w, -w), (0.0, -w), (w, -w),
                    (-w,  0.0),          (w,  0.0),
                    (-w,  w), (0.0,  w), (w,  w),
                ];
                for (dx, dy) in offsets {
                    text_areas.push(TextArea {
                        buffer,
                        left: base_x + dx,
                        top: base_y + dy,
                        scale,
                        bounds: TextBounds::default(),
                        default_color: to_glyphon_color(outline_color),
                        custom_glyphs: &[],
                    });
                }
            }

            decorations.extend(block_decorations(&mains[i], block, base_x, base_y, scale));
            text_areas.push(TextArea {
                buffer: &mains[i],
                left: base_x,
                top: base_y,
                scale,
                bounds: TextBounds::default(),
                default_color: to_glyphon_color(block.color),
                custom_glyphs: &[],
            });
        }

        // Preparar text areas en VRAM
        let renderer = &mut self.renderers[layer as usize];
        renderer
            .prepare(
                device,
                queue,
                &mut self.font_atlas.font_system,
                &mut self.atlas,
                &self.viewport,
                text_areas,
                &mut self.font_atlas.swash_cache,
            )
            .map_err(|e| AppError::new(format!("Error preparando texto en GPU: {e:?}")))?;

        // Renderizar los glifos con el pipeline de WGPU
        renderer
            .render(&self.atlas, &self.viewport, render_pass)
            .map_err(|e| AppError::new(format!("Error renderizando texto en GPU: {e:?}")))?;

        self.decorations[layer as usize] = decorations;
        Ok(())
    }
}

/// Construye y mide el buffer de un bloque. Con `tint` todo el texto se pinta de
/// ese color (sombra/contorno). Devuelve el buffer y el desplazamiento vertical
/// que corresponde a la alineación vertical del bloque.
fn build_buffer(font_system: &mut FontSystem, block: &TextBlock, tint: Option<[f32; 4]>) -> (Buffer, f32) {
    let line_ratio = block.line_height_ratio.max(1.0);
    let metrics = Metrics::new(block.font_size, block.font_size * line_ratio);
    let base_family = block.font_family.as_deref().filter(|f| !f.is_empty());
    let letter_spacing = block.letter_spacing.filter(|ls| *ls != 0.0);
    let attrs = with_spacing(
        block_attrs(base_family, block.font_weight, block.font_style.as_deref(), tint.unwrap_or(block.color)),
        letter_spacing,
        block.font_size,
    );

    let align = match block.alignment.to_lowercase().as_str() {
        "center" => Some(Align::Center),
        "right" => Some(Align::Right),
        "justify" => Some(Align::Justified),
        _ => Some(Align::Left),
    };

    let mut buffer = Buffer::new(font_system, metrics);
    // Sin límite de alto: el texto desborda la caja como en CSS y la alineación
    // vertical se calcula midiendo el layout.
    buffer.set_size(Some(block.width), None);
    buffer.set_wrap(Wrap::Word);

    if block.spans.is_empty() {
        buffer.set_text(&block.text, &attrs, Shaping::Advanced, align);
    } else {
        let spans: Vec<(&str, Attrs)> = block
            .spans
            .iter()
            .enumerate()
            .map(|(index, span)| {
                let family = span.font_family.as_deref().filter(|f| !f.is_empty()).or(base_family);
                let size = span.font_size.unwrap_or(block.font_size);
                let color = tint.or(span.color).unwrap_or(block.color);
                let a = block_attrs(
                    family,
                    span.font_weight.unwrap_or(block.font_weight),
                    span.font_style.as_deref().or(block.font_style.as_deref()),
                    color,
                )
                .metrics(Metrics::new(size, size * line_ratio))
                // El índice del tramo vuelve en `LayoutGlyph::metadata`: así se ubican sus decoraciones.
                .metadata(index);
                (span.text.as_str(), with_spacing(a, letter_spacing, size))
            })
            .collect();
        buffer.set_rich_text(spans, &attrs, Shaping::Advanced, align);
    }

    buffer.shape_until_scroll(font_system, false);

    let text_height: f32 = buffer.layout_runs().map(|run| run.line_height).sum();
    let offset_y = match block.vertical_align.as_deref() {
        Some("center") | Some("middle") => (block.height - text_height) / 2.0,
        Some("bottom") => block.height - text_height,
        _ => 0.0,
    };
    (buffer, offset_y)
}

/// Escala y desplazamiento vertical calculados para un bloque.
#[derive(Clone, Copy)]
struct BlockLayout {
    scale: f32,
    offset_y: f32,
}

/// Atributos de fuente de un bloque o tramo.
fn block_attrs<'a>(family: Option<&'a str>, weight: u16, style: Option<&str>, color: [f32; 4]) -> Attrs<'a> {
    Attrs::new()
        .family(match family {
            Some(name) => Family::Name(name),
            None => Family::SansSerif,
        })
        .weight(Weight(weight))
        .style(match style {
            Some("italic") => Style::Italic,
            _ => Style::Normal,
        })
        .color(to_glyphon_color(color))
}

/// `letter_spacing` (px) se pasa a cosmic-text en em: `px / tamaño de fuente`.
fn with_spacing(attrs: Attrs<'_>, letter_spacing: Option<f32>, font_size: f32) -> Attrs<'_> {
    match letter_spacing {
        Some(px) if font_size > 0.0 => attrs.letter_spacing(px / font_size),
        _ => attrs,
    }
}

/// Subrayados y tachados de un bloque a partir de las posiciones reales de sus glifos (siguen solos el
/// padding, la alineación y el salto de línea). Los glifos contiguos del mismo tramo decorado forman un rect.
fn block_decorations(buffer: &Buffer, block: &TextBlock, base_x: f32, base_y: f32, scale: f32) -> Vec<Decoration> {
    let mut out = Vec::new();
    if !block.spans.iter().any(|s| s.underline || s.strike) {
        return out;
    }
    for run in buffer.layout_runs() {
        // (tramo, x inicial, x final, tamaño de fuente) del rect en curso por tipo: 0 subrayado, 1 tachado.
        let mut open: [Option<(usize, f32, f32, f32)>; 2] = [None, None];
        let flush = |kind: usize, cur: Option<(usize, f32, f32, f32)>, out: &mut Vec<Decoration>| {
            let Some((span, x0, x1, fs)) = cur else { return };
            let color = block.spans[span].color.unwrap_or(block.color);
            let (offset, thickness) = (if kind == 0 { fs * 0.12 } else { -fs * 0.30 }, (fs / 16.0).max(1.0));
            out.push(Decoration {
                rect: [base_x + x0 * scale, base_y + (run.line_y + offset) * scale, (x1 - x0) * scale, thickness * scale],
                color,
            });
        };
        for glyph in run.glyphs {
            let span = block.spans.get(glyph.metadata);
            for (kind, slot) in open.iter_mut().enumerate() {
                let on = span.is_some_and(|s| if kind == 0 { s.underline } else { s.strike });
                match (slot, on) {
                    (Some(cur), true) if cur.0 == glyph.metadata => cur.2 = glyph.x + glyph.w,
                    (cur, _) => {
                        flush(kind, cur.take(), &mut out);
                        if on {
                            *cur = Some((glyph.metadata, glyph.x, glyph.x + glyph.w, glyph.font_size));
                        }
                    }
                }
            }
        }
        for (kind, cur) in open.into_iter().enumerate() {
            flush(kind, cur, &mut out);
        }
    }
    out
}

/// Convierte un color [r, g, b, a] normalizado (0.0..1.0) a `glyphon::Color`.
fn to_glyphon_color(c: [f32; 4]) -> Color {
    let r = (c[0].clamp(0.0, 1.0) * 255.0).round() as u8;
    let g = (c[1].clamp(0.0, 1.0) * 255.0).round() as u8;
    let b = (c[2].clamp(0.0, 1.0) * 255.0).round() as u8;
    let a = (c[3].clamp(0.0, 1.0) * 255.0).round() as u8;
    Color::rgba(r, g, b, a)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::{gpu, test_util::read_texture_bytes};

    const FORMAT: TextureFormat = TextureFormat::Rgba8UnormSrgb;

    fn bloque(text: &str, size: f32, color: [f32; 4], x: f32, y: f32, w: f32, h: f32) -> TextBlock {
        TextBlock { text: text.into(), font_size: size, color, x, y, width: w, height: h, ..TextBlock::default() }
    }

    fn hay(px: &[u8], (x0, y0, x1, y1): (u32, u32, u32, u32), f: impl Fn(&[u8]) -> bool) -> bool {
        (y0..y1).any(|y| (x0..x1).any(|x| f(&px[((y * 320 + x) * 4) as usize..][..4])))
    }

    #[test]
    fn capas_de_texto_no_se_pisan() {
        let gpu = gpu::shared().expect("gpu");
        let errores = gpu.uncaptured_errors();
        let mut engine = TextEngine::new(&gpu.device, &gpu.queue, FORMAT);
        let texture = gpu.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("test capas de texto"),
            size: wgpu::Extent3d { width: 320, height: 180, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let slide = [bloque("A", 60.0, [1.0; 4], 10.0, 10.0, 50.0, 70.0)];
        let overlay = [bloque("OVERLAY LARGO", 40.0, [1.0, 0.0, 0.0, 1.0], 10.0, 110.0, 300.0, 60.0)];

        let mut encoder = gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("test capas") });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("test capas"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store },
                    depth_slice: None,
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            engine.render(TextLayer::Slide, &gpu.device, &gpu.queue, &mut pass, 320, 180, &slide).expect("slide");
            engine.render(TextLayer::Overlay, &gpu.device, &gpu.queue, &mut pass, 320, 180, &overlay).expect("overlay");
        }
        gpu.queue.submit([encoder.finish()]);

        let px = read_texture_bytes(&gpu, &texture, 320, 180, 4);
        assert!(hay(&px, (10, 10, 60, 80), |p| p[0] > 200 && p[1] > 200 && p[2] > 200), "faltan los blancos de la slide");
        assert!(hay(&px, (10, 110, 310, 170), |p| p[0] > 200 && p[1] < 80), "faltan los rojos del overlay");
        assert_eq!(gpu.uncaptured_errors(), errores, "errores de validación de wgpu");
    }

    #[test]
    fn muchos_tamanos_no_llenan_el_atlas() {
        let gpu = gpu::shared().expect("gpu");
        let mut engine = TextEngine::new(&gpu.device, &gpu.queue, FORMAT);
        let texture = gpu.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("test atlas"),
            size: wgpu::Extent3d { width: 320, height: 180, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        for i in 0..200 {
            let blocks = [bloque(&format!("Texto {i}"), 8.0 + i as f32 * 1.5, [1.0; 4], 0.0, 0.0, 320.0, 180.0)];
            let mut encoder = gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("test atlas") });
            {
                let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("test atlas"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store },
                        depth_slice: None,
                    })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                    multiview_mask: None,
                });
                let r = engine.render(TextLayer::Slide, &gpu.device, &gpu.queue, &mut pass, 320, 180, &blocks);
                assert!(r.is_ok(), "iteración {i}: {r:?}");
            }
            gpu.queue.submit([encoder.finish()]);
            engine.end_frame();
        }
    }
}
