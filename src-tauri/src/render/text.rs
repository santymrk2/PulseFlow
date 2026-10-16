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

/// Pipeline de texto WGPU que renderiza glifos cacheados en VRAM.
pub struct TextEngine {
    pub font_atlas: FontAtlas,
    pub cache: Cache,
    pub atlas: TextAtlas,
    pub viewport: Viewport,
    pub text_renderer: TextRenderer,
}

impl TextEngine {
    pub fn new(device: &Device, queue: &Queue, format: TextureFormat) -> Self {
        let font_atlas = FontAtlas::new();
        let cache = Cache::new(device);
        let mut atlas = TextAtlas::new(device, queue, &cache, format);
        let viewport = Viewport::new(device, &cache);
        let text_renderer = TextRenderer::new(
            &mut atlas,
            device,
            MultisampleState::default(),
            None,
        );

        Self {
            font_atlas,
            cache,
            atlas,
            viewport,
            text_renderer,
        }
    }

    /// Prepara y renderiza los bloques de texto de la escena actual en el render pass.
    pub fn render(
        &mut self,
        device: &Device,
        queue: &Queue,
        render_pass: &mut RenderPass<'_>,
        screen_width: u32,
        screen_height: u32,
        blocks: &[TextBlock],
    ) -> AppResult<()> {
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
        self.text_renderer
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
        self.text_renderer
            .render(&self.atlas, &self.viewport, render_pass)
            .map_err(|e| AppError::new(format!("Error renderizando texto en GPU: {e:?}")))?;

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
    let attrs = block_attrs(base_family, block.font_weight, block.font_style.as_deref(), tint.unwrap_or(block.color));

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
            .map(|span| {
                let family = span.font_family.as_deref().filter(|f| !f.is_empty()).or(base_family);
                let size = span.font_size.unwrap_or(block.font_size);
                let color = tint.or(span.color).unwrap_or(block.color);
                let a = block_attrs(
                    family,
                    span.font_weight.unwrap_or(block.font_weight),
                    span.font_style.as_deref().or(block.font_style.as_deref()),
                    color,
                )
                .metrics(Metrics::new(size, size * line_ratio));
                (span.text.as_str(), a)
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
        .color(to_glyphon_color(color).into())
}

/// Convierte un color [r, g, b, a] normalizado (0.0..1.0) a `glyphon::Color`.
fn to_glyphon_color(c: [f32; 4]) -> Color {
    let r = (c[0].clamp(0.0, 1.0) * 255.0).round() as u8;
    let g = (c[1].clamp(0.0, 1.0) * 255.0).round() as u8;
    let b = (c[2].clamp(0.0, 1.0) * 255.0).round() as u8;
    let a = (c[3].clamp(0.0, 1.0) * 255.0).round() as u8;
    Color::rgba(r, g, b, a)
}
