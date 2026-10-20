//! Capa de medios (Video e Imágenes) en VRAM.
//!
//! Soporta:
//! - Subida y cacheo de imágenes a texturas GPU (`wgpu::Texture`).
//! - Buffer de fotogramas de video con decodificación acelerada por hardware.
//! - Reutilización de texturas: todas las pantallas comparten el `MediaStore` (y el
//!   `Device` de `GpuContext`), así que un mismo medio vive una sola vez en VRAM.
//! - Pipeline de composición con ajuste de aspecto (Cover, Contain, Stretch).
//!
//! Los uniforms de cada capa viven en una `LayerArena` (una por pantalla) con offset
//! dinámico: cada `draw` lee su propia entrada aunque se dibujen varias capas en un
//! mismo submit, y la textura (`MediaTexture`) no depende de ningún buffer de
//! uniforms, de modo que puede dibujarse desde varias pantallas a la vez.

use super::gpu::GpuContext;
use super::sync::{MutexExt, RwLockExt};
use crate::error::{AppError, AppResult};
use std::collections::HashMap;
use std::num::NonZeroU64;
use std::path::Path;
use std::sync::{Arc, Mutex, RwLock};
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

/// Capas que una pantalla puede dibujar por frame (fondo + items + overlays).
const MAX_LAYERS_PER_FRAME: u32 = 256;

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
    pub target_ratio: f32,
    pub media_ratio: f32,
    /// Rect destino normalizado [0, 1] (x, y, ancho, alto), origen arriba-izquierda.
    pub rect: [f32; 4],
}

/// Layouts de bind groups comunes a todos los pipelines de capa.
pub struct LayerLayouts {
    /// Grupo 0: `LayerUniforms` con offset dinámico (lo provee la `LayerArena`).
    pub uniforms: BindGroupLayout,
    /// Grupo 1: textura + sampler del medio.
    pub texture: BindGroupLayout,
}

impl LayerLayouts {
    pub fn new(device: &Device) -> Self {
        let uniforms = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Layer Uniforms Layout"),
            entries: &[BindGroupLayoutEntry {
                binding: 0,
                // El vertex stage lee `rect` para colocar el quad.
                visibility: ShaderStages::VERTEX_FRAGMENT,
                ty: BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: true,
                    min_binding_size: NonZeroU64::new(std::mem::size_of::<LayerUniforms>() as u64),
                },
                count: None,
            }],
        });
        let texture = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Layer Texture Layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        Self { uniforms, texture }
    }
}

/// Uniforms de las capas de un frame de una pantalla. Cada `draw` reserva una
/// entrada distinta: `write_buffer` sólo se ordena respecto del submit, así que
/// escribir siempre en el mismo sitio haría que todas las capas vieran la última.
pub struct LayerArena {
    buffer: wgpu::Buffer,
    bind_group: BindGroup,
    stride: u32,
    cursor: u32,
}

impl LayerArena {
    pub fn new(device: &Device, layouts: &LayerLayouts) -> Self {
        let size = std::mem::size_of::<LayerUniforms>() as u32;
        let alignment = device.limits().min_uniform_buffer_offset_alignment;
        let stride = size.next_multiple_of(alignment);
        let buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Layer Uniform Arena"),
            size: u64::from(stride) * u64::from(MAX_LAYERS_PER_FRAME),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Layer Uniform Arena Bind Group"),
            layout: &layouts.uniforms,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: BindingResource::Buffer(wgpu::BufferBinding {
                    buffer: &buffer,
                    offset: 0,
                    size: NonZeroU64::new(u64::from(size)),
                }),
            }],
        });
        Self { buffer, bind_group, stride, cursor: 0 }
    }

    /// Reinicia la reserva: se llama una vez al empezar cada frame.
    pub fn begin_frame(&mut self) {
        self.cursor = 0;
    }

    /// Escribe `uniforms` en una entrada nueva y devuelve su offset dinámico.
    fn push(&mut self, queue: &Queue, uniforms: &LayerUniforms) -> Option<u32> {
        if self.cursor >= MAX_LAYERS_PER_FRAME {
            eprintln!("[media] más de {MAX_LAYERS_PER_FRAME} capas en un frame: se omite el resto");
            return None;
        }
        let offset = self.cursor * self.stride;
        queue.write_buffer(&self.buffer, u64::from(offset), bytemuck::bytes_of(uniforms));
        self.cursor += 1;
        Some(offset)
    }
}

/// Almacén de texturas y pipelines compartido por todas las pantallas.
pub struct MediaStore {
    gpu: Arc<GpuContext>,
    layouts: LayerLayouts,
    textures: RwLock<HashMap<String, Arc<MediaTexture>>>,
    pipelines: Mutex<HashMap<TextureFormat, Arc<BackgroundPipeline>>>,
}

impl MediaStore {
    pub fn new(gpu: Arc<GpuContext>) -> Arc<Self> {
        let layouts = LayerLayouts::new(&gpu.device);
        Arc::new(Self {
            gpu,
            layouts,
            textures: RwLock::new(HashMap::new()),
            pipelines: Mutex::new(HashMap::new()),
        })
    }

    /// Pipeline de capa para `format` (uno por formato de superficie, compartido).
    pub fn pipeline(&self, format: TextureFormat) -> Arc<BackgroundPipeline> {
        let mut pipelines = self.pipelines.lock_safe();
        Arc::clone(pipelines.entry(format).or_insert_with(|| {
            Arc::new(BackgroundPipeline::new(&self.gpu.device, format, &self.layouts))
        }))
    }

    /// Arena de uniforms para una pantalla (o un snapshot).
    pub fn new_arena(&self) -> LayerArena {
        LayerArena::new(&self.gpu.device, &self.layouts)
    }

    /// Obtiene una textura previamente cargada en VRAM si ya existe.
    pub fn get(&self, id: &str) -> Option<Arc<MediaTexture>> {
        self.textures.read_safe().get(id).cloned()
    }

    /// Carga una imagen estática desde disco a VRAM o reutiliza la existente.
    pub fn load_image<P: AsRef<Path>>(&self, path: P) -> AppResult<Arc<MediaTexture>> {
        let path_ref = path.as_ref();
        let id = path_ref.to_string_lossy().to_string();

        if let Some(existing) = self.get(&id) {
            return Ok(existing);
        }

        // La decodificación va fuera del lock: no bloquea a las pantallas que leen.
        let img = image::open(path_ref)
            .map_err(|e| AppError::new(format!("Error abriendo imagen '{}': {e}", path_ref.display())))?
            .to_rgba8();
        let (width, height) = img.dimensions();
        self.insert_rgba(&id, width, height, &img.into_raw())
    }

    /// Carga una imagen desde bytes binarios en memoria.
    pub fn load_image_bytes(&self, id: &str, bytes: &[u8]) -> AppResult<Arc<MediaTexture>> {
        if let Some(existing) = self.get(id) {
            return Ok(existing);
        }

        let img = image::load_from_memory(bytes)
            .map_err(|e| AppError::new(format!("Error decodificando imagen en memoria: {e}")))?
            .to_rgba8();
        let (width, height) = img.dimensions();
        self.insert_rgba(id, width, height, &img.into_raw())
    }

    /// Sube o actualiza un fotograma de video acelerado por hardware a VRAM.
    pub fn update_video_frame(
        &self,
        id: &str,
        width: u32,
        height: u32,
        rgba_bytes: &[u8],
    ) -> AppResult<Arc<MediaTexture>> {
        if let Some(existing) = self.get(id) {
            if existing.width == width && existing.height == height {
                // Actualización in-place sin reasignar memoria en VRAM (Zero Allocation)
                self.gpu.queue.write_texture(
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
                    Extent3d { width, height, depth_or_array_layers: 1 },
                );
                return Ok(existing);
            }
        }

        // Si no existe o cambió la resolución, crear nueva textura
        let media = create_texture_from_rgba(
            &self.gpu.device,
            &self.gpu.queue,
            &self.layouts,
            id,
            width,
            height,
            rgba_bytes,
        );
        let arc_media = Arc::new(media);
        self.textures.write_safe().insert(id.to_string(), Arc::clone(&arc_media));
        Ok(arc_media)
    }

    /// Sube `rgba` como textura `id`; si otro hilo la insertó antes, gana esa.
    fn insert_rgba(&self, id: &str, width: u32, height: u32, rgba: &[u8]) -> AppResult<Arc<MediaTexture>> {
        let media = Arc::new(create_texture_from_rgba(
            &self.gpu.device,
            &self.gpu.queue,
            &self.layouts,
            id,
            width,
            height,
            rgba,
        ));
        let mut textures = self.textures.write_safe();
        Ok(Arc::clone(textures.entry(id.to_string()).or_insert(media)))
    }
}

/// Pipeline de renderizado de la capa de fondo (Fullscreen Quad).
pub struct BackgroundPipeline {
    pub render_pipeline: RenderPipeline,
}

impl BackgroundPipeline {
    pub fn new(device: &Device, format: TextureFormat, layouts: &LayerLayouts) -> Self {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("PulseFlow Composite Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/composite.wgsl").into()),
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Background Pipeline Layout"),
            bind_group_layouts: &[Some(&layouts.uniforms), Some(&layouts.texture)],
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

        Self { render_pipeline }
    }

    /// Dibuja la textura de fondo a pantalla completa en el render pass.
    pub fn render(
        &self,
        queue: &Queue,
        arena: &mut LayerArena,
        render_pass: &mut RenderPass<'_>,
        media: &MediaTexture,
        screen_width: u32,
        screen_height: u32,
        opacity: f32,
        aspect_mode: u32, // 0 Cover, 1 Contain, 2 Stretch
    ) {
        let screen_ratio = screen_width as f32 / screen_height.max(1) as f32;
        self.draw(
            queue,
            arena,
            render_pass,
            media,
            opacity,
            aspect_mode,
            screen_ratio,
            [0.0, 0.0, 1.0, 1.0],
        );
    }

    /// Dibuja la textura en un rect de la pantalla (en píxeles, origen arriba-izquierda).
    /// Es la capa de los items de medio dentro de la slide (F4.5).
    pub fn render_rect(
        &self,
        queue: &Queue,
        arena: &mut LayerArena,
        render_pass: &mut RenderPass<'_>,
        media: &MediaTexture,
        screen_width: u32,
        screen_height: u32,
        rect: [f32; 4], // x, y, ancho, alto en píxeles
        opacity: f32,
        aspect_mode: u32, // 0 Cover, 1 Contain, 2 Stretch
    ) {
        let w = screen_width.max(1) as f32;
        let h = screen_height.max(1) as f32;
        let target_ratio = rect[2] / rect[3].max(1.0);
        let normalized = [rect[0] / w, rect[1] / h, rect[2] / w, rect[3] / h];
        self.draw(
            queue,
            arena,
            render_pass,
            media,
            opacity,
            aspect_mode,
            target_ratio,
            normalized,
        );
    }

    /// Reserva los uniforms de la capa en la arena y dibuja el quad (6 vértices).
    fn draw(
        &self,
        queue: &Queue,
        arena: &mut LayerArena,
        render_pass: &mut RenderPass<'_>,
        media: &MediaTexture,
        opacity: f32,
        aspect_mode: u32,
        target_ratio: f32,
        rect: [f32; 4],
    ) {
        let media_ratio = media.width as f32 / media.height.max(1) as f32;

        let uniforms = LayerUniforms {
            opacity,
            aspect_mode,
            target_ratio,
            media_ratio,
            rect,
        };

        let Some(offset) = arena.push(queue, &uniforms) else {
            return;
        };

        render_pass.set_pipeline(&self.render_pipeline);
        render_pass.set_bind_group(0, &arena.bind_group, &[offset]);
        render_pass.set_bind_group(1, &media.bind_group, &[]);
        // Dibuja los 6 vértices del Quad generado en vs_main
        render_pass.draw(0..6, 0..1);
    }
}

/// Helper para crear `MediaTexture` a partir de bytes RGBA.
fn create_texture_from_rgba(
    device: &Device,
    queue: &Queue,
    layouts: &LayerLayouts,
    id: &str,
    width: u32,
    height: u32,
    rgba_bytes: &[u8],
) -> MediaTexture {
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
        layout: &layouts.texture,
        entries: &[
            BindGroupEntry {
                binding: 0,
                resource: BindingResource::TextureView(&view),
            },
            BindGroupEntry {
                binding: 1,
                resource: BindingResource::Sampler(&sampler),
            },
        ],
    });

    MediaTexture {
        id: id.to_string(),
        width,
        height,
        texture,
        view,
        sampler,
        bind_group,
    }
}

static SHARED_STORE: std::sync::OnceLock<Arc<MediaStore>> = std::sync::OnceLock::new();
/// Serializa la primera creación del almacén compartido.
static STORE_INIT: Mutex<()> = Mutex::new(());

/// Almacén de medios del proceso, sobre el `GpuContext` compartido.
pub fn shared_store() -> AppResult<Arc<MediaStore>> {
    if let Some(store) = SHARED_STORE.get() {
        return Ok(Arc::clone(store));
    }
    let _guard = STORE_INIT.lock_safe();
    if let Some(store) = SHARED_STORE.get() {
        return Ok(Arc::clone(store));
    }
    let store = MediaStore::new(super::gpu::shared()?);
    Ok(Arc::clone(SHARED_STORE.get_or_init(|| store)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_png(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("pulseflow-media-tests");
        std::fs::create_dir_all(&dir).expect("carpeta temporal");
        let path = dir.join(name);
        image::RgbaImage::from_pixel(8, 8, image::Rgba([10, 20, 30, 255]))
            .save(&path)
            .expect("guardar PNG de prueba");
        path
    }

    fn store() -> Arc<MediaStore> {
        MediaStore::new(super::super::gpu::shared().expect("GPU disponible"))
    }

    #[test]
    fn same_image_two_callers_share_texture() {
        let store = store();
        let path = test_png("shared.png");
        let a = store.load_image(&path).expect("primera carga");
        let b = store.load_image(&path).expect("segunda carga");
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn pipeline_is_cached_per_format() {
        let store = store();
        let a = store.pipeline(TextureFormat::Bgra8UnormSrgb);
        let b = store.pipeline(TextureFormat::Bgra8UnormSrgb);
        let c = store.pipeline(TextureFormat::Rgba8Unorm);
        assert!(Arc::ptr_eq(&a, &b));
        assert!(!Arc::ptr_eq(&a, &c));
    }

    #[test]
    fn arena_gives_each_layer_its_own_offset() {
        let store = store();
        let mut arena = store.new_arena();
        let gpu = super::super::gpu::shared().expect("GPU disponible");
        let u = LayerUniforms { opacity: 1.0, aspect_mode: 0, target_ratio: 1.0, media_ratio: 1.0, rect: [0.0, 0.0, 1.0, 1.0] };
        let first = arena.push(&gpu.queue, &u).expect("entrada 0");
        let second = arena.push(&gpu.queue, &u).expect("entrada 1");
        assert_ne!(first, second);
        arena.begin_frame();
        assert_eq!(arena.push(&gpu.queue, &u), Some(first), "begin_frame reinicia la reserva");
    }

    #[test]
    fn arena_refuses_layers_past_capacity() {
        let store = store();
        let mut arena = store.new_arena();
        let gpu = super::super::gpu::shared().expect("GPU disponible");
        let u = LayerUniforms { opacity: 1.0, aspect_mode: 0, target_ratio: 1.0, media_ratio: 1.0, rect: [0.0, 0.0, 1.0, 1.0] };
        for _ in 0..MAX_LAYERS_PER_FRAME {
            assert!(arena.push(&gpu.queue, &u).is_some());
        }
        assert_eq!(arena.push(&gpu.queue, &u), None);
    }
}
