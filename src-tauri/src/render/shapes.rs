//! Cajas redondeadas con fondo y borde (F23.16): el fondo, el borde, las esquinas y la opacidad de un cuadro.
//!
//! Un quad por caja; el fragment shader calcula la distancia a la caja redondeada y suaviza el borde.
//! Los uniforms van en la `LayerArena` (como las capas de `media.rs`): una entrada por caja.

use super::media::{LayerArena, LayerLayouts, LayerUniforms};
use super::scene::SceneBox;
use super::types::{MediaItem, TextBlock};

/// Uniforms de una caja. Mide lo mismo que `LayerUniforms` para compartir la arena.
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct ShapeUniforms {
    /// x, y, ancho, alto normalizados al destino.
    rect: [f32; 4],
    fill: [f32; 4],
    border: [f32; 4],
    /// ancho px, alto px, grosor del borde px, radio px.
    params: [f32; 4],
    _pad: [f32; 8],
}

const _: () = assert!(std::mem::size_of::<ShapeUniforms>() == std::mem::size_of::<LayerUniforms>());

pub struct ShapePipeline {
    pipeline: wgpu::RenderPipeline,
    /// La superficie es sRGB: los colores del contrato (sRGB) se pasan a lineal antes de escribirlos.
    srgb: bool,
}

fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

impl ShapePipeline {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self {
        let layouts = LayerLayouts::new(device);
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Rounded Rect Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/rounded_rect.wgsl").into()),
        });
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Rounded Rect Pipeline Layout"),
            bind_group_layouts: &[Some(&layouts.uniforms)],
            immediate_size: 0,
        });
        let blend = wgpu::BlendState {
            color: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::SrcAlpha,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            },
            alpha: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            },
        };
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Rounded Rect Pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &module,
                entry_point: Some("vs_main"),
                compilation_options: Default::default(),
                buffers: &[],
            },
            fragment: Some(wgpu::FragmentState {
                module: &module,
                entry_point: Some("fs_main"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(blend),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });
        Self {
            pipeline,
            srgb: format.is_srgb(),
        }
    }

    fn to_target(&self, color: [f32; 4]) -> [f32; 4] {
        if self.srgb {
            [
                srgb_to_linear(color[0]),
                srgb_to_linear(color[1]),
                srgb_to_linear(color[2]),
                color[3],
            ]
        } else {
            color
        }
    }

    /// Dibuja una caja redondeada. `rect` (x, y, ancho, alto) y `border_width`/`radius` van en píxeles del
    /// destino; `target` es el tamaño del destino real (viewport) contra el que se normaliza el rect.
    #[allow(clippy::too_many_arguments)] // parámetros de GPU/dibujo que no ganan nada agrupándose en un struct
    pub fn draw_rounded_rect(
        &self,
        _device: &wgpu::Device,
        queue: &wgpu::Queue,
        arena: &mut LayerArena,
        pass: &mut wgpu::RenderPass<'_>,
        rect: [f32; 4],
        fill: [f32; 4],
        border: [f32; 4],
        border_width: f32,
        radius: f32,
        target: (u32, u32),
    ) {
        if rect[2] <= 0.0 || rect[3] <= 0.0 {
            return;
        }
        let (tw, th) = (target.0.max(1) as f32, target.1.max(1) as f32);
        let uniforms = ShapeUniforms {
            rect: [rect[0] / tw, rect[1] / th, rect[2] / tw, rect[3] / th],
            fill: self.to_target(fill),
            border: self.to_target(border),
            params: [rect[2], rect[3], border_width.max(0.0), radius.max(0.0)],
            _pad: [0.0; 8],
        };
        let Some(offset) = arena.push(queue, &uniforms) else {
            return;
        };
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &arena.bind_group, &[offset]);
        pass.draw(0..6, 0..1);
    }

    /// Dibuja la caja de un ítem. `rect` está en unidades de la resolución lógica y `scale` la lleva al destino.
    /// Sin fondo ni borde visibles no dibuja nada.
    #[allow(clippy::too_many_arguments)] // parámetros de GPU/dibujo que no ganan nada agrupándose en un struct
    pub fn draw_box(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        arena: &mut LayerArena,
        pass: &mut wgpu::RenderPass<'_>,
        style: &SceneBox,
        rect: [f32; 4],
        scale: f32,
        target: (u32, u32),
    ) {
        let opacity = style.opacity_factor();
        let border_width = style.border_width.unwrap_or(0.0).max(0.0) * scale;
        let border = style
            .border_color
            .filter(|_| border_width > 0.0)
            .map(|c| [c[0], c[1], c[2], c[3] * opacity]);
        let fill = style.background.map(|c| [c[0], c[1], c[2], c[3] * opacity]);
        if fill.is_none_or(|c| c[3] <= 0.0) && border.is_none_or(|c| c[3] <= 0.0) {
            return;
        }
        // Lo que falta es transparente, con el RGB del otro para que el suavizado no oscurezca el borde.
        let border = border
            .or(fill.map(|c| [c[0], c[1], c[2], 0.0]))
            .unwrap_or([0.0; 4]);
        let fill = fill.unwrap_or([border[0], border[1], border[2], 0.0]);
        let radius = style.radius.unwrap_or(0.0) * scale;
        let rect = [
            rect[0] * scale,
            rect[1] * scale,
            rect[2] * scale,
            rect[3] * scale,
        ];
        self.draw_rounded_rect(
            device,
            queue,
            arena,
            pass,
            rect,
            fill,
            border,
            border_width,
            radius,
            target,
        );
    }

    /// Dibuja las cajas de todos los bloques de texto de una capa (antes de la llamada de texto de esa capa).
    #[allow(clippy::too_many_arguments)] // parámetros de GPU/dibujo que no ganan nada agrupándose en un struct
    pub fn draw_text_boxes(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        arena: &mut LayerArena,
        pass: &mut wgpu::RenderPass<'_>,
        blocks: &[TextBlock],
        target: (u32, u32),
    ) {
        for block in blocks {
            if let Some((style, rect)) = block.box_rect() {
                let scale = match block.design_width {
                    Some(dw) if dw > 0.0 => target.0 as f32 / dw,
                    _ => 1.0,
                };
                self.draw_box(device, queue, arena, pass, style, rect, scale, target);
            }
        }
    }

    /// Dibuja la caja de un ítem de medio (justo antes del medio).
    pub fn draw_media_box(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        arena: &mut LayerArena,
        pass: &mut wgpu::RenderPass<'_>,
        item: &MediaItem,
        target: (u32, u32),
    ) {
        if let Some(style) = item.box_style.as_ref() {
            let scale = match item.design_width {
                Some(dw) if dw > 0.0 => target.0 as f32 / dw,
                _ => 1.0,
            };
            self.draw_box(
                device,
                queue,
                arena,
                pass,
                style,
                [item.x, item.y, item.width, item.height],
                scale,
                target,
            );
        }
    }
}
