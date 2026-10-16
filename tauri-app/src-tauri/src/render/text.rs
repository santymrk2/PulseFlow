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

        // Creamos los buffers de texto necesarios para cada bloque
        let mut text_buffers = Vec::new();

        for block in blocks {
            let line_height = block.font_size * block.line_height_ratio.max(1.0);
            let metrics = Metrics::new(block.font_size, line_height);

            let family = match &block.font_family {
                Some(fam) if !fam.is_empty() => Family::Name(fam.as_str()),
                _ => Family::SansSerif,
            };

            let weight = Weight(block.font_weight);
            let style = match block.font_style.as_deref() {
                Some("italic") => Style::Italic,
                _ => Style::Normal,
            };

            let align = match block.alignment.to_lowercase().as_str() {
                "center" => Some(Align::Center),
                "right" => Some(Align::Right),
                "justify" => Some(Align::Justified),
                _ => Some(Align::Left),
            };

            let attrs = Attrs::new()
                .family(family)
                .weight(weight)
                .style(style);

            let mut buffer = Buffer::new(&mut self.font_atlas.font_system, metrics);
            buffer.set_size(Some(block.width), Some(block.height));
            buffer.set_wrap(Wrap::Word);
            buffer.set_text(
                &block.text,
                &attrs,
                Shaping::Advanced,
                align,
            );

            buffer.shape_until_scroll(&mut self.font_atlas.font_system, false);
            text_buffers.push(buffer);
        }

        // Construir capas de renderizado:
        // Capa 1: Sombra arrojada (Drop Shadow)
        // Capa 2: Contorno (Stroke) en 8 direcciones
        // Capa 3: Texto frontal principal
        let mut text_areas = Vec::new();

        for (i, block) in blocks.iter().enumerate() {
            let buffer = &text_buffers[i];

            // 1. Sombra arrojada si está configurada
            if let (Some(shadow_color), Some(offset)) = (block.shadow_color, block.shadow_offset) {
                let shadow_area = TextArea {
                    buffer,
                    left: block.x + offset[0],
                    top: block.y + offset[1],
                    scale: 1.0,
                    bounds: TextBounds::default(),
                    default_color: to_glyphon_color(shadow_color),
                    custom_glyphs: &[],
                };
                text_areas.push(shadow_area);
            }

            // 2. Contorno / Stroke por GPU en 8 direcciones perimetrales
            if let (Some(outline_color), Some(stroke_w)) = (block.outline_color, block.outline_width) {
                if stroke_w > 0.0 {
                    let w = stroke_w;
                    let stroke_color = to_glyphon_color(outline_color);
                    let offsets = [
                        (-w, -w), (0.0, -w), (w, -w),
                        (-w,  0.0),          (w,  0.0),
                        (-w,  w), (0.0,  w), (w,  w),
                    ];
                    for (dx, dy) in offsets {
                        text_areas.push(TextArea {
                            buffer,
                            left: block.x + dx,
                            top: block.y + dy,
                            scale: 1.0,
                            bounds: TextBounds::default(),
                            default_color: stroke_color,
                            custom_glyphs: &[],
                        });
                    }
                }
            }

            // 3. Texto principal
            let main_color = to_glyphon_color(block.color);
            let main_area = TextArea {
                buffer,
                left: block.x,
                top: block.y,
                scale: 1.0,
                bounds: TextBounds::default(),
                default_color: main_color,
                custom_glyphs: &[],
            };
            text_areas.push(main_area);
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

/// Convierte un color [r, g, b, a] normalizado (0.0..1.0) a `glyphon::Color`.
fn to_glyphon_color(c: [f32; 4]) -> Color {
    let r = (c[0].clamp(0.0, 1.0) * 255.0).round() as u8;
    let g = (c[1].clamp(0.0, 1.0) * 255.0).round() as u8;
    let b = (c[2].clamp(0.0, 1.0) * 255.0).round() as u8;
    let a = (c[3].clamp(0.0, 1.0) * 255.0).round() as u8;
    Color::rgba(r, g, b, a)
}
