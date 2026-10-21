//! Fotograma de video en NV12 (planos Y y CbCr) listo para dibujarse.
//!
//! El decodificador (nativo o ffmpeg) entrega los dos planos como texturas de wgpu;
//! `Nv12Pipeline` (F18.2) los convierte a RGB en el shader. Es el formato en el que
//! decodifican VideoToolbox y Media Foundation, así que no hay conversión en la CPU.

use super::super::gpu::GpuContext;
use super::super::media::{LayerArena, LayerLayouts, LayerUniforms};
use crate::error::{AppError, AppResult};
use std::any::Any;

/// Matriz de color con la que se pasa de YCbCr a RGB.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum YuvMatrix {
    Bt601,
    Bt709,
    Bt2020,
}

/// Matriz por defecto cuando el contenedor no la declara: HD (≥ 720 líneas) es BT.709 y SD es BT.601.
pub fn guess_matrix(height: u32) -> YuvMatrix {
    if height >= 720 {
        YuvMatrix::Bt709
    } else {
        YuvMatrix::Bt601
    }
}

/// Desplazamiento de la crominancia: 128 es el centro del rango de 8 bits.
const CHROMA_OFFSET: f32 = 128.0 / 255.0;

/// Conversión YCbCr → RGB precalculada: una matriz 3×3 y un offset.
///
/// Se calcula **en la CPU** y viaja al shader dentro de los uniforms de la capa, para
/// que el fragment shader no tenga ningún `if`/`else` que obligue a la GPU a evaluar
/// varias rutas por píxel (divergencia de warps).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct YuvTransform {
    /// Columnas de la matriz 3×3, en el mismo orden que una `mat3x3<f32>` de WGSL
    /// (column-major): `matrix * v` = `matrix[0]*v.x + matrix[1]*v.y + matrix[2]*v.z`.
    pub matrix: [[f32; 4]; 3],
    /// Offset que se le resta a (Y, Cb, Cr) antes de multiplicar por la matriz.
    pub offset: [f32; 4],
}

impl YuvTransform {
    /// Transformación identidad: para las capas que no son video (el shader de imagen
    /// no lee estos campos).
    pub const IDENTITY: Self = Self {
        matrix: [
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
        ],
        offset: [0.0; 4],
    };

    /// Precalcula la conversión para la matriz y el rango del video.
    pub fn new(matrix: YuvMatrix, full_range: bool) -> Self {
        // Escala y bias según el rango: limitado (16–235 / 16–240) o completo (0–255).
        let (y_scale, c_scale, y_bias) = if full_range {
            (1.0, 1.0, 0.0)
        } else {
            (255.0 / 219.0, 255.0 / 224.0, 16.0 / 255.0)
        };

        // Coeficientes de color según el estándar.
        let (r_cr, g_cb, g_cr, b_cb) = match matrix {
            YuvMatrix::Bt601 => (1.402, 0.344136, 0.714136, 1.772),
            YuvMatrix::Bt709 => (1.5748, 0.187324, 0.468124, 1.8556),
            YuvMatrix::Bt2020 => (1.4746, 0.164553, 0.571353, 1.8814),
        };

        Self {
            // Columnas: la del eje Y, la de Cb y la de Cr.
            matrix: [
                [y_scale, y_scale, y_scale, 0.0],
                [0.0, -g_cb * c_scale, b_cb * c_scale, 0.0],
                [r_cr * c_scale, -g_cr * c_scale, 0.0, 0.0],
            ],
            offset: [y_bias, CHROMA_OFFSET, CHROMA_OFFSET, 0.0],
        }
    }

    /// Aplica la transformación a un sample YCbCr normalizado (0–1) y devuelve RGB
    /// acotado a [0, 1], igual que el shader. Es la referencia en CPU de lo que
    /// hace la GPU.
    pub fn apply(&self, y: f32, cb: f32, cr: f32) -> [f32; 3] {
        let v = [y - self.offset[0], cb - self.offset[1], cr - self.offset[2]];
        let mut rgb = [0.0; 3];
        for (row, channel) in rgb.iter_mut().enumerate() {
            let value = self.matrix[0][row] * v[0] + self.matrix[1][row] * v[1] + self.matrix[2][row] * v[2];
            *channel = value.clamp(0.0, 1.0);
        }
        rgb
    }
}

/// Dos texturas (Y: `R8Unorm`, CbCr: `Rg8Unorm` a mitad de resolución) + cómo interpretarlas.
pub struct Nv12Frame {
    pub y: wgpu::Texture,
    pub uv: wgpu::Texture,
    pub y_view: wgpu::TextureView,
    pub uv_view: wgpu::TextureView,
    pub width: u32,
    pub height: u32,
    pub matrix: YuvMatrix,
    /// `true` si el rango es completo (0–255); `false` es el rango de video (16–235).
    pub full_range: bool,
    /// Retiene lo que respalda las texturas (p. ej. el `CVPixelBuffer`) mientras el frame viva.
    _keepalive: Option<Box<dyn Any + Send + Sync>>,
}

impl Nv12Frame {
    /// Frame cuyas vistas ya vienen armadas (una textura NV12 con vistas por plano, en Windows).
    #[allow(clippy::too_many_arguments)]
    pub fn from_views(y: wgpu::Texture, uv: wgpu::Texture, y_view: wgpu::TextureView, uv_view: wgpu::TextureView, width: u32, height: u32, matrix: YuvMatrix, full_range: bool, keepalive: Option<Box<dyn Any + Send + Sync>>) -> Self {
        Self { y, uv, y_view, uv_view, width, height, matrix, full_range, _keepalive: keepalive }
    }

    /// `true` si las texturas son propias (planos subidos desde la CPU) y se pueden reescribir en el lugar.
    pub fn is_cpu_backed(&self) -> bool {
        self._keepalive.is_none()
    }

    pub fn new(y: wgpu::Texture, uv: wgpu::Texture, matrix: YuvMatrix, full_range: bool, keepalive: Option<Box<dyn Any + Send + Sync>>) -> Self {
        let y_view = y.create_view(&wgpu::TextureViewDescriptor::default());
        let uv_view = uv.create_view(&wgpu::TextureViewDescriptor::default());
        Self { width: y.width(), height: y.height(), y, uv, y_view, uv_view, matrix, full_range, _keepalive: keepalive }
    }
}

impl Nv12Frame {
    /// Frame NV12 con los planos subidos desde la CPU (camino ffmpeg). Y es `width × height`
    /// y CbCr es `ceil(width/2) × ceil(height/2)` con dos bytes por muestra.
    pub fn from_cpu_planes(gpu: &GpuContext, width: u32, height: u32, y: &[u8], uv: &[u8], matrix: YuvMatrix, full_range: bool) -> AppResult<Self> {
        let (uv_width, uv_height) = (width.div_ceil(2), height.div_ceil(2));
        if width == 0 || height == 0 {
            return Err(AppError::new("Un frame de video no puede tener tamaño cero"));
        }
        if y.len() != (width * height) as usize || uv.len() != (uv_width * uv_height * 2) as usize {
            return Err(AppError::new(format!("Planos NV12 de tamaño incorrecto para {width}x{height}: Y={} CbCr={}", y.len(), uv.len())));
        }

        let y_texture = plane_texture(gpu, "NV12 Y", width, height, wgpu::TextureFormat::R8Unorm);
        let uv_texture = plane_texture(gpu, "NV12 CbCr", uv_width, uv_height, wgpu::TextureFormat::Rg8Unorm);
        let frame = Self::new(y_texture, uv_texture, matrix, full_range, None);
        frame.write_cpu_planes(gpu, y, uv);
        Ok(frame)
    }

    /// Reemplaza el contenido de los planos (mismas dimensiones) sin reservar memoria nueva.
    pub fn write_cpu_planes(&self, gpu: &GpuContext, y: &[u8], uv: &[u8]) {
        write_plane(gpu, &self.y, y, self.width, self.height, 1);
        write_plane(gpu, &self.uv, uv, self.width.div_ceil(2), self.height.div_ceil(2), 2);
    }
}

fn plane_texture(gpu: &GpuContext, label: &str, width: u32, height: u32, format: wgpu::TextureFormat) -> wgpu::Texture {
    gpu.device.create_texture(&wgpu::TextureDescriptor {
        label: Some(label),
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    })
}

fn write_plane(gpu: &GpuContext, texture: &wgpu::Texture, bytes: &[u8], width: u32, height: u32, bytes_per_pixel: u32) {
    gpu.queue.write_texture(
        wgpu::TexelCopyTextureInfo { texture, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        bytes,
        wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(width * bytes_per_pixel), rows_per_image: Some(height) },
        wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
    );
}

/// Pipeline que dibuja un `Nv12Frame` a pantalla completa convirtiendo YCbCr → RGB en el shader.
pub struct Nv12Pipeline {
    render_pipeline: wgpu::RenderPipeline,
    texture_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
}

impl Nv12Pipeline {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat, layouts: &LayerLayouts) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("PulseFlow NV12 Shader"),
            source: wgpu::ShaderSource::Wgsl(concat!(include_str!("../shaders/layer_common.wgsl"), include_str!("../shaders/video_nv12.wgsl")).into()),
        });

        let plane_entry = |binding: u32| wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::FRAGMENT,
            ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false },
            count: None,
        };
        let texture_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("NV12 Texture Layout"),
            entries: &[
                plane_entry(0),
                plane_entry(1),
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("NV12 Pipeline Layout"),
            bind_group_layouts: &[Some(&layouts.uniforms), Some(&texture_layout)],
            immediate_size: 0,
        });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("NV12 Render Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState { module: &shader, entry_point: Some("vs_main"), buffers: &[], compilation_options: wgpu::PipelineCompilationOptions::default() },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState { format, blend: Some(wgpu::BlendState::ALPHA_BLENDING), write_mask: wgpu::ColorWrites::ALL })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("NV12 Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Self { render_pipeline, texture_layout, sampler }
    }

    /// Dibuja el frame a pantalla completa (`aspect_mode`: 0 Cover, 1 Contain, 2 Stretch).
    #[allow(clippy::too_many_arguments)]
    pub fn render(&self, device: &wgpu::Device, queue: &wgpu::Queue, arena: &mut LayerArena, pass: &mut wgpu::RenderPass<'_>, frame: &Nv12Frame, screen_width: u32, screen_height: u32, opacity: f32, aspect_mode: u32) {
        // La conversión de color va precalculada a la CPU: el shader multiplica y listo.
        let transform = YuvTransform::new(frame.matrix, frame.full_range);
        let uniforms = LayerUniforms {
            opacity,
            aspect_mode,
            target_ratio: screen_width as f32 / screen_height.max(1) as f32,
            media_ratio: frame.width as f32 / frame.height.max(1) as f32,
            rect: [0.0, 0.0, 1.0, 1.0],
            yuv_matrix: transform.matrix,
            yuv_offset: transform.offset,
        };
        let Some(offset) = arena.push(queue, &uniforms) else {
            return;
        };

        let planes = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("NV12 Planes"),
            layout: &self.texture_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&frame.y_view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&frame.uv_view) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&self.sampler) },
            ],
        });

        pass.set_pipeline(&self.render_pipeline);
        pass.set_bind_group(0, &arena.bind_group, &[offset]);
        pass.set_bind_group(1, &planes, &[]);
        pass.draw(0..6, 0..1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::gpu;
    use crate::render::test_util::{assert_near, render_center};

    /// Frame NV12 uniforme de `width × height` (planos subidos desde la CPU).
    fn solid(width: u32, height: u32, y: u8, cb: u8, cr: u8, matrix: YuvMatrix, full_range: bool) -> Nv12Frame {
        let gpu = gpu::shared().expect("GPU compartida");
        let (uw, uh) = (width.div_ceil(2), height.div_ceil(2));
        let y_plane = vec![y; (width * height) as usize];
        let uv_plane: Vec<u8> = (0..uw * uh).flat_map(|_| [cb, cr]).collect();
        Nv12Frame::from_cpu_planes(&gpu, width, height, &y_plane, &uv_plane, matrix, full_range).expect("frame NV12")
    }

    #[test]
    fn matrix_is_guessed_from_the_height() {
        assert_eq!(guess_matrix(1080), YuvMatrix::Bt709);
        assert_eq!(guess_matrix(720), YuvMatrix::Bt709);
        assert_eq!(guess_matrix(480), YuvMatrix::Bt601);
    }

    #[test]
    fn nv12_bt709_limited_red() {
        // Y=63, Cb=102, Cr=240 en rango limitado y BT.709 es rojo puro
        assert_near(render_center(&solid(4, 4, 63, 102, 240, YuvMatrix::Bt709, false)), [255, 0, 0], "rojo");
    }

    #[test]
    fn nv12_bt709_limited_white() {
        assert_near(render_center(&solid(4, 4, 235, 128, 128, YuvMatrix::Bt709, false)), [255, 255, 255], "blanco");
    }

    #[test]
    fn nv12_full_range_differs_from_limited() {
        // mismo Y=63 sin crominancia: rango limitado ≈ 55, rango completo ≈ 63
        let limited = render_center(&solid(4, 4, 63, 128, 128, YuvMatrix::Bt709, false));
        let full = render_center(&solid(4, 4, 63, 128, 128, YuvMatrix::Bt709, true));
        assert_near(limited, [55, 55, 55], "limitado");
        assert_near(full, [63, 63, 63], "completo");
    }

    #[test]
    fn nv12_matrices_give_different_colors_for_the_same_planes() {
        let bt601 = render_center(&solid(4, 4, 63, 102, 240, YuvMatrix::Bt601, false));
        let bt709 = render_center(&solid(4, 4, 63, 102, 240, YuvMatrix::Bt709, false));
        assert_ne!(bt601, bt709);
    }

    #[test]
    fn nv12_odd_dimensions() {
        // 3×3: el plano CbCr es de 2×2 (se redondea hacia arriba) y no desborda
        assert_near(render_center(&solid(3, 3, 63, 102, 240, YuvMatrix::Bt709, false)), [255, 0, 0], "3x3");
    }

    #[test]
    fn nv12_planes_of_the_wrong_size_are_rejected() {
        let gpu = gpu::shared().expect("GPU compartida");
        assert!(Nv12Frame::from_cpu_planes(&gpu, 4, 4, &[0; 15], &[0; 8], YuvMatrix::Bt709, false).is_err());
        assert!(Nv12Frame::from_cpu_planes(&gpu, 4, 4, &[0; 16], &[0; 7], YuvMatrix::Bt709, false).is_err());
    }

    /// Conversión de referencia (la que hacía el shader con `if`/`else` antes de
    /// precalcular la matriz): sirve para comprobar que la matriz no cambia el color.
    fn reference_rgb(y_raw: f32, cb_raw: f32, cr_raw: f32, matrix: YuvMatrix, full_range: bool) -> [f32; 3] {
        let (y, cb, cr) = if full_range {
            (y_raw, cb_raw - 128.0 / 255.0, cr_raw - 128.0 / 255.0)
        } else {
            (
                (y_raw * 255.0 - 16.0) / 219.0,
                (cb_raw * 255.0 - 128.0) / 224.0,
                (cr_raw * 255.0 - 128.0) / 224.0,
            )
        };
        let rgb = match matrix {
            YuvMatrix::Bt601 => [y + 1.402 * cr, y - 0.344136 * cb - 0.714136 * cr, y + 1.772 * cb],
            YuvMatrix::Bt709 => [y + 1.5748 * cr, y - 0.187324 * cb - 0.468124 * cr, y + 1.8556 * cb],
            YuvMatrix::Bt2020 => [y + 1.4746 * cr, y - 0.164553 * cb - 0.571353 * cr, y + 1.8814 * cb],
        };
        rgb.map(|v| v.clamp(0.0, 1.0))
    }

    #[test]
    fn the_precalculated_matrix_gives_the_same_color_as_the_branches() {
        let samples = [
            (63.0 / 255.0, 102.0 / 255.0, 240.0 / 255.0),
            (235.0 / 255.0, 128.0 / 255.0, 128.0 / 255.0),
            (16.0 / 255.0, 0.0, 255.0 / 255.0),
            (0.5, 0.75, 0.25),
        ];
        for matrix in [YuvMatrix::Bt601, YuvMatrix::Bt709, YuvMatrix::Bt2020] {
            for full_range in [false, true] {
                let transform = YuvTransform::new(matrix, full_range);
                for (y, cb, cr) in samples {
                    let expected = reference_rgb(y, cb, cr, matrix, full_range);
                    let actual = transform.apply(y, cb, cr);
                    for channel in 0..3 {
                        assert!(
                            (actual[channel] - expected[channel]).abs() < 1e-5,
                            "{matrix:?} (rango completo: {full_range}): canal {channel} = {} (esperado {})",
                            actual[channel],
                            expected[channel]
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn the_limited_range_expands_the_video_range() {
        // Y=16 (negro de video) tiene que dar 0 y Y=235 (blanco de video) 1.
        let limited = YuvTransform::new(YuvMatrix::Bt709, false);
        let black = limited.apply(16.0 / 255.0, 128.0 / 255.0, 128.0 / 255.0);
        let white = limited.apply(235.0 / 255.0, 128.0 / 255.0, 128.0 / 255.0);
        assert!(black.iter().all(|v| v.abs() < 1e-5), "negro de video: {black:?}");
        assert!(white.iter().all(|v| (v - 1.0).abs() < 1e-5), "blanco de video: {white:?}");

        // En rango completo el valor 16 queda tal cual (no se expande).
        let full = YuvTransform::new(YuvMatrix::Bt709, true);
        let grey = full.apply(16.0 / 255.0, 128.0 / 255.0, 128.0 / 255.0);
        assert!((grey[0] - 16.0 / 255.0).abs() < 1e-5, "rango completo: {grey:?}");
    }
}
