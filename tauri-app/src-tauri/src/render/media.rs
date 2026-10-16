//! Capa de medios (Video e Imágenes) en VRAM.
//!
//! Soporta:
//! - Subida y cacheo de imágenes a texturas GPU (`wgpu::Texture`).
//! - Buffer de fotogramas de video con decodificación acelerada por hardware.
//! - Reutilización de texturas: si múltiples salidas muestran el mismo fondo,
//!   comparten el mismo `Arc<MediaTexture>` en VRAM.
//! - Pipeline de composición con ajuste de aspecto (Cover, Contain, Stretch).

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use wgpu::util::DeviceExt;
use wgpu::{
    BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout, BindGroupLayoutDescriptor,
    BindGroupLayoutEntry, BindingResource, BindingType, BlendComponent, BlendFactor, BlendOperation,
    BlendState, ColorTargetState, ColorWrites, Device, Extent3d, FragmentState, MultisampleState,
    Origin3d, PipelineCompilationOptions, PipelineLayoutDescriptor, PrimitiveState, Queue,
    RenderPass, RenderPipeline, RenderPipelineDescriptor, Sampler, SamplerBindingType,
    SamplerDescriptor, ShaderModuleDescriptor, ShaderSource, ShaderStages, TexelCopyBufferLayout,
    TexelCopyTextureInfo, Texture, TextureAspect, TextureDescriptor, TextureDimension,
    TextureFormat, TextureSampleType, TextureUsages, TextureView, TextureViewDescriptor,
    TextureViewDimension, VertexState,
};
use crate::error::{AppError, AppResult};

/// Textura de medio (imagen o video) lista en VRAM para la GPU.
pub struct MediaTexture {
    pub id: String,
    pub width: u32,
    pub height: u32,
    pub texture: Texture,
    pub view: TextureView,
    pub sampler: Sampler,
    pub bind_group: BindGroup,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct LayerUniforms {
    pub opacity: f32,
    pub aspect_mode: u32, // 0 = Cover, 1 = Contain, 2 = Stretch
    pub screen_ratio: f32,
    pub media_ratio: f32,
}

/// Piscina de texturas compartidas en VRAM.
pub struct MediaPool {
    textures: HashMap<String, Arc<MediaTexture>>,
}

impl MediaPool {
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
        }
    }

    /// Obtiene una textura previamente cargada en VRAM si ya existe.
    pub fn get(&self, id: &str) -> Option<Arc<MediaTexture>> {
        self.textures.get(id).cloned()
    }

    /// Carga una imagen estática desde disco a VRAM o reutiliza la existente.
    pub fn load_image<P: AsRef<Path>>(
        &mut self,
        device: &Device,
        queue: &Queue,
        pipeline: &BackgroundPipeline,
        path: P,
    ) -> AppResult<Arc<MediaTexture>> {
        let path_ref = path.as_ref();
        let id = path_ref.to_string_lossy().to_string();

        if let Some(existing) = self.textures.get(&id) {
            return Ok(Arc::clone(existing));
        }

        let img = image::open(path_ref)
            .map_err(|e| AppError::new(format!("Error abriendo imagen '{}': {e}", path_ref.display())))?
            .to_rgba8();

        let (width, height) = img.dimensions();
        let media = create_texture_from_rgba(
            device,
            queue,
            pipeline,
            &id,
            width,
            height,
            &img.into_raw(),
        )?;

        let arc_media = Arc::new(media);
        self.textures.insert(id, Arc::clone(&arc_media));
        Ok(arc_media)
    }

    /// Carga una imagen desde bytes binarios en memoria.
    pub fn load_image_bytes(
        &mut self,
        device: &Device,
        queue: &Queue,
        pipeline: &BackgroundPipeline,
        id: &str,
        bytes: &[u8],
    ) -> AppResult<Arc<MediaTexture>> {
        if let Some(existing) = self.textures.get(id) {
            return Ok(Arc::clone(existing));
        }

        let img = image::load_from_memory(bytes)
            .map_err(|e| AppError::new(format!("Error decodificando imagen en memoria: {e}")))?
            .to_rgba8();

        let (width, height) = img.dimensions();
        let media = create_texture_from_rgba(
            device,
            queue,
            pipeline,
            id,
            width,
            height,
            &img.into_raw(),
        )?;

        let arc_media = Arc::new(media);
        self.textures.insert(id.to_string(), Arc::clone(&arc_media));
        Ok(arc_media)
    }

    /// Sube o actualiza un fotograma de video acelerado por hardware a VRAM.
    pub fn update_video_frame(
        &mut self,
        device: &Device,
        queue: &Queue,
        pipeline: &BackgroundPipeline,
        id: &str,
        width: u32,
        height: u32,
        rgba_bytes: &[u8],
    ) -> AppResult<Arc<MediaTexture>> {
        if let Some(existing) = self.textures.get(id) {
            if existing.width == width && existing.height == height {
                // Actualización in-place sin reasignar memoria en VRAM (Zero Allocation)
                queue.write_texture(
                    TexelCopyTextureInfo {
                        texture: &existing.texture,
                        mip_level: 0,
                        origin: Origin3d::ZERO,
                        aspect: TextureAspect::All,
                    },
                    rgba_bytes,
                    TexelCopyBufferLayout {
                        offset: 0,
                        bytes_per_row: Some(4 * width),
                        rows_per_image: Some(height),
                    },
                    Extent3d {
                        width,
                        height,
                        depth_or_array_layers: 1,
                    },
                );
                return Ok(Arc::clone(existing));
            }
        }

        // Si no existe o cambió la resolución, crear nueva textura
        let media = create_texture_from_rgba(
            device,
            queue,
            pipeline,
            id,
            width,
            height,
            rgba_bytes,
        )?;
        let arc_media = Arc::new(media);
        self.textures.insert(id.to_string(), Arc::clone(&arc_media));
        Ok(arc_media)
    }
}

impl Default for MediaPool {
    fn default() -> Self {
        Self::new()
    }
}

/// Pipeline de renderizado de la capa de fondo (Fullscreen Quad).
pub struct BackgroundPipeline {
    pub render_pipeline: RenderPipeline,
    pub bind_group_layout: BindGroupLayout,
    pub uniform_buffer: wgpu::Buffer,
}

impl BackgroundPipeline {
    pub fn new(device: &Device, format: TextureFormat) -> Self {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("FreeShow Composite Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/composite.wgsl").into()),
        });

        let uniform_size = std::mem::size_of::<LayerUniforms>() as u64;
        let uniform_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Background Uniform Buffer"),
            size: uniform_size,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Background Bind Group Layout"),
            entries: &[
                // Binding 0: Uniforms
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Binding 1: Media Texture
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Binding 2: Sampler
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Background Pipeline Layout"),
            bind_group_layouts: &[Some(&bind_group_layout)],
            immediate_size: 0,
        });

        let render_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Background Render Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: PipelineCompilationOptions::default(),
            },
            fragment: Some(FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format,
                    blend: Some(BlendState {
                        color: BlendComponent {
                            src_factor: BlendFactor::SrcAlpha,
                            dst_factor: BlendFactor::OneMinusSrcAlpha,
                            operation: BlendOperation::Add,
                        },
                        alpha: BlendComponent {
                            src_factor: BlendFactor::One,
                            dst_factor: BlendFactor::OneMinusSrcAlpha,
                            operation: BlendOperation::Add,
                        },
                    }),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: PipelineCompilationOptions::default(),
            }),
            primitive: PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        Self {
            render_pipeline,
            bind_group_layout,
            uniform_buffer,
        }
    }

    /// Dibuja la textura de fondo en el render pass.
    pub fn render(
        &self,
        queue: &Queue,
        render_pass: &mut RenderPass<'_>,
        media: &MediaTexture,
        screen_width: u32,
        screen_height: u32,
        opacity: f32,
        aspect_mode: u32, // 0 Cover, 1 Contain, 2 Stretch
    ) {
        let screen_ratio = screen_width as f32 / screen_height.max(1) as f32;
        let media_ratio = media.width as f32 / media.height.max(1) as f32;

        let uniforms = LayerUniforms {
            opacity,
            aspect_mode,
            screen_ratio,
            media_ratio,
        };

        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        render_pass.set_pipeline(&self.render_pipeline);
        render_pass.set_bind_group(0, &media.bind_group, &[]);
        // Dibuja los 6 vértices del Fullscreen Quad generado en vs_main
        render_pass.draw(0..6, 0..1);
    }
}

/// Helper para crear `MediaTexture` a partir de bytes RGBA.
fn create_texture_from_rgba(
    device: &Device,
    queue: &Queue,
    pipeline: &BackgroundPipeline,
    id: &str,
    width: u32,
    height: u32,
    rgba_bytes: &[u8],
) -> AppResult<MediaTexture> {
    let size = Extent3d {
        width,
        height,
        depth_or_array_layers: 1,
    };

    let texture = device.create_texture_with_data(
        queue,
        &TextureDescriptor {
            label: Some(id),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8UnormSrgb,
            usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
            view_formats: &[],
        },
        wgpu::util::TextureDataOrder::LayerMajor,
        rgba_bytes,
    );

    let view = texture.create_view(&TextureViewDescriptor::default());

    let sampler = device.create_sampler(&SamplerDescriptor {
        label: Some("Media Sampler"),
        address_mode_u: wgpu::AddressMode::ClampToEdge,
        address_mode_v: wgpu::AddressMode::ClampToEdge,
        address_mode_w: wgpu::AddressMode::ClampToEdge,
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        mipmap_filter: wgpu::MipmapFilterMode::Nearest,
        ..Default::default()
    });

    let bind_group = device.create_bind_group(&BindGroupDescriptor {
        label: Some("Media Bind Group"),
        layout: &pipeline.bind_group_layout,
        entries: &[
            BindGroupEntry {
                binding: 0,
                resource: pipeline.uniform_buffer.as_entire_binding(),
            },
            BindGroupEntry {
                binding: 1,
                resource: BindingResource::TextureView(&view),
            },
            BindGroupEntry {
                binding: 2,
                resource: BindingResource::Sampler(&sampler),
            },
        ],
    });

    Ok(MediaTexture {
        id: id.to_string(),
        width,
        height,
        texture,
        view,
        sampler,
        bind_group,
    })
}
