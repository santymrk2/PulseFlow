//! Capa de medios (Video e Imágenes) en VRAM.
//!
//! Soporta:
//! - Subida y cacheo de imágenes a texturas GPU (`wgpu::Texture`).
//! - Último fotograma NV12 de cada video en reproducción, compartido por todas las pantallas.
//! - Reutilización de texturas: todas las pantallas comparten el `MediaStore` (y el
//!   `Device` de `GpuContext`), así que un mismo medio vive una sola vez en VRAM.
//! - Pipeline de composición con ajuste de aspecto (Cover, Contain, Stretch).
//!
//! Los uniforms de cada capa viven en una `LayerArena` (una por pantalla) con offset
//! dinámico: cada `draw` lee su propia entrada aunque se dibujen varias capas en un
//! mismo submit, y la textura (`MediaTexture`) no depende de ningún buffer de
//! uniforms, de modo que puede dibujarse desde varias pantallas a la vez.

use super::gpu::GpuContext;
use super::video::nv12::{Nv12Frame, Nv12Pipeline, YuvMatrix, YuvTransform};
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
    PipelineCompilationOptions, PipelineLayoutDescriptor, PrimitiveState, Queue,
    RenderPass, RenderPipeline, RenderPipelineDescriptor, Sampler, SamplerBindingType,
    SamplerDescriptor, ShaderModuleDescriptor, ShaderSource, ShaderStages,
    Texture, TextureDescriptor, TextureDimension,
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
    /// Sólo video NV12: matriz YCbCr→RGB y offset, ya precalculados (el shader no
    /// decide el rango ni la matriz: multiplica y listo).
    pub yuv_matrix: [[f32; 4]; 3],
    pub yuv_offset: [f32; 4],
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
    pub(crate) bind_group: BindGroup,
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
    pub(crate) fn push(&mut self, queue: &Queue, uniforms: &LayerUniforms) -> Option<u32> {
        if self.cursor >= MAX_LAYERS_PER_FRAME {
            log::warn!("[media] más de {MAX_LAYERS_PER_FRAME} capas en un frame: se omite el resto");
            return None;
        }
        let offset = self.cursor * self.stride;
        queue.write_buffer(&self.buffer, u64::from(offset), bytemuck::bytes_of(uniforms));
        self.cursor += 1;
        Some(offset)
    }
}

/// Estado de una imagen pedida con `MediaStore::request_image`.
pub enum MediaState {
    /// Se está decodificando en un worker: el render no la dibuja todavía.
    Loading,
    Ready(Arc<MediaTexture>),
    /// No se pudo cargar (no existe, está corrupta o es demasiado grande): no se reintenta.
    Failed(String),
}

/// Pedido en curso o fallido de una imagen (las listas viven en `MediaStore::jobs`).
enum Job {
    Loading,
    /// Motivo y cuándo falló: pasado el enfriamiento se reintenta (el archivo pudo terminar de copiarse).
    Failed(String, std::time::Instant),
}

/// Cuánto se espera antes de reintentar una imagen que falló.
const FAILED_RETRY_AFTER: std::time::Duration = std::time::Duration::from_secs(30);

/// Cuántas rutas acepta un pedido de precarga (lo que sobra se descarta).
pub const MAX_PREFETCH: usize = 64;

/// Lado máximo (px) de una imagen: más que eso no cabe en una textura y se rechaza sin decodificar.
const MAX_IMAGE_SIDE: u32 = 16_384;

/// Almacén de texturas y pipelines compartido por todas las pantallas.
pub struct MediaStore {
    /// Contexto GPU vigente: se cambia si el driver pierde el dispositivo (F23.3).
    context: RwLock<Arc<GpuContext>>,
    /// Layouts de bind group: dependen del dispositivo, así que se rehacen con él.
    layouts: RwLock<LayerLayouts>,
    textures: RwLock<HashMap<String, Arc<MediaTexture>>>,
    /// Último frame de cada video en reproducción (clave = ruta del archivo).
    videos: RwLock<HashMap<String, Arc<Nv12Frame>>>,
    pipelines: Mutex<HashMap<TextureFormat, Arc<BackgroundPipeline>>>,
    nv12_pipelines: Mutex<HashMap<TextureFormat, Arc<Nv12Pipeline>>>,
    /// Imágenes pedidas a los workers: cargando o fallidas (las listas salen de `textures`).
    jobs: Mutex<HashMap<String, Job>>,
    retry_after: std::time::Duration,
    /// Decodificaciones iniciadas (sólo tests: comprueba que se pidan una sola vez).
    #[cfg(test)]
    decodes: std::sync::atomic::AtomicUsize,
    /// Subidas de fotogramas de video (sólo tests: comprueba que sea una por frame).
    #[cfg(test)]
    uploads: std::sync::atomic::AtomicUsize,
}

impl MediaStore {
    pub fn new(gpu: Arc<GpuContext>) -> Arc<Self> {
        Self::new_with_retry(gpu, FAILED_RETRY_AFTER)
    }

    pub(crate) fn new_with_retry(gpu: Arc<GpuContext>, retry_after: std::time::Duration) -> Arc<Self> {
        let layouts = LayerLayouts::new(&gpu.device);
        Arc::new(Self {
            context: RwLock::new(gpu),
            layouts: RwLock::new(layouts),
            textures: RwLock::new(HashMap::new()),
            videos: RwLock::new(HashMap::new()),
            pipelines: Mutex::new(HashMap::new()),
            nv12_pipelines: Mutex::new(HashMap::new()),
            jobs: Mutex::new(HashMap::new()),
            retry_after,
            #[cfg(test)]
            decodes: std::sync::atomic::AtomicUsize::new(0),
            #[cfg(test)]
            uploads: std::sync::atomic::AtomicUsize::new(0),
        })
    }

    /// Si el driver perdió el dispositivo, rehace layouts, pipelines y texturas: lo
    /// que había en VRAM pertenecía al dispositivo perdido y ya no sirve.
    ///
    /// `true` si hubo que reconstruir. Las imágenes vuelven a pedirse (se vuelven a
    /// decodificar) y los videos se vuelven a subir en el próximo frame.
    pub fn sync_device(&self) -> AppResult<bool> {
        let current = super::gpu::shared()?;
        {
            let context = self.context.read_safe();
            if Arc::ptr_eq(&context, &current) {
                return Ok(false);
            }
        }

        log::warn!("[media] el dispositivo se perdió: se rehacen pipelines y texturas");
        // El orden de los locks es siempre contexto → layouts → pipelines → jobs →
        // texturas → videos, para que nadie pueda tomarlos en otro orden y se muerda.
        let mut _context = self.context.write_safe();
        let mut _layouts = self.layouts.write_safe();
        let mut pipelines = self.pipelines.lock_safe();
        let mut nv12_pipelines = self.nv12_pipelines.lock_safe();
        let mut jobs = self.jobs.lock_safe();
        let mut textures = self.textures.write_safe();
        let mut videos = self.videos.write_safe();

        *_context = Arc::clone(&current);
        *_layouts = LayerLayouts::new(&current.device);
        pipelines.clear();
        nv12_pipelines.clear();
        textures.clear();
        videos.clear();
        jobs.clear();
        Ok(true)
    }

    /// Pipeline de capa para `format` (uno por formato de superficie, compartido).
    pub fn pipeline(&self, format: TextureFormat) -> Arc<BackgroundPipeline> {
        let context = self.context.read_safe();
        let layouts = self.layouts.read_safe();
        let mut pipelines = self.pipelines.lock_safe();
        Arc::clone(pipelines.entry(format).or_insert_with(|| {
            Arc::new(BackgroundPipeline::new(&context.device, format, &layouts))
        }))
    }

    /// Pipeline de video NV12 para `format` (uno por formato de superficie, compartido).
    pub fn nv12_pipeline(&self, format: TextureFormat) -> Arc<Nv12Pipeline> {
        let context = self.context.read_safe();
        let layouts = self.layouts.read_safe();
        let mut pipelines = self.nv12_pipelines.lock_safe();
        Arc::clone(pipelines.entry(format).or_insert_with(|| Arc::new(Nv12Pipeline::new(&context.device, format, &layouts))))
    }

    /// Arena de uniforms para una pantalla (o un snapshot).
    pub fn new_arena(&self) -> LayerArena {
        let context = self.context.read_safe();
        let layouts = self.layouts.read_safe();
        LayerArena::new(&context.device, &layouts)
    }

    #[cfg(test)]
    pub(crate) fn decodes(&self) -> usize {
        self.decodes.load(std::sync::atomic::Ordering::SeqCst)
    }

    #[cfg(test)]
    pub(crate) fn uploads(&self) -> usize {
        self.uploads.load(std::sync::atomic::Ordering::SeqCst)
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

    /// Pide una imagen **sin bloquear**: si no está, se encola en un worker (una sola vez por ruta,
    /// aunque se pida 50 veces) y mientras tanto devuelve `Loading`. El worker decodifica y sube la
    /// textura a la GPU compartida; la siguiente llamada devuelve `Ready`. Un fallo es permanente
    /// (`Failed`) y no se reintenta.
    pub fn request_image(self: &Arc<Self>, path: &Path) -> MediaState {
        let key = path.to_string_lossy().to_string();
        if let Some(texture) = self.get(&key) {
            return MediaState::Ready(texture);
        }

        {
            let mut jobs = self.jobs.lock_safe();
            // el worker inserta la textura antes de soltar el pedido: revisar de nuevo con el lock tomado
            if let Some(texture) = self.get(&key) {
                return MediaState::Ready(texture);
            }
            match jobs.get(&key) {
                Some(Job::Loading) => return MediaState::Loading,
                Some(Job::Failed(reason, failed_at)) if failed_at.elapsed() < self.retry_after => return MediaState::Failed(reason.clone()),
                // falló hace rato (o nunca se pidió): se vuelve a intentar
                Some(Job::Failed(..)) | None => {
                    jobs.insert(key.clone(), Job::Loading);
                }
            }
        }

        let store = Arc::clone(self);
        let owned = path.to_path_buf();
        super::workers::submit(move || store.run_image_job(&key, &owned));
        MediaState::Loading
    }

    /// Precarga imágenes en los workers antes de que alguna pantalla las necesite. Ignora rutas
    /// vacías y repetidas y acepta hasta `MAX_PREFETCH`; devuelve cuántas rutas distintas aceptó.
    pub fn prefetch<'a>(self: &Arc<Self>, paths: impl IntoIterator<Item = &'a str>) -> usize {
        let mut accepted: Vec<&str> = Vec::new();
        for path in paths {
            if accepted.len() >= MAX_PREFETCH {
                break;
            }
            if path.trim().is_empty() || accepted.contains(&path) {
                continue;
            }
            accepted.push(path);
            let _ = self.request_image(Path::new(path));
        }
        accepted.len()
    }

    /// Trabajo del worker: valida el tamaño, decodifica y sube; deja el resultado en `jobs`/`textures`.
    fn run_image_job(&self, key: &str, path: &Path) {
        #[cfg(test)]
        self.decodes.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        let result = self.decode_and_upload(key, path);
        let mut jobs = self.jobs.lock_safe();
        match result {
            Ok(()) => {
                jobs.remove(key);
            }
            Err(err) => {
                log::warn!("[media] {err}");
                jobs.insert(key.to_string(), Job::Failed(err.to_string(), std::time::Instant::now()));
            }
        }
    }

    fn decode_and_upload(&self, key: &str, path: &Path) -> AppResult<()> {
        let open_error = |e: &dyn std::fmt::Display| AppError::new(format!("Error abriendo imagen '{}': {e}", path.display()));

        // el encabezado dice el tamaño sin decodificar: se rechaza lo enorme antes de reservar memoria
        let (width, height) = image::ImageReader::open(path)
            .map_err(|e| open_error(&e))?
            .with_guessed_format()
            .map_err(|e| open_error(&e))?
            .into_dimensions()
            .map_err(|e| open_error(&e))?;
        if width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE {
            return Err(AppError::new(format!("Imagen '{}' demasiado grande ({width}x{height}): el máximo es {MAX_IMAGE_SIDE} px por lado", path.display())));
        }

        let rgba = image::open(path).map_err(|e| open_error(&e))?.to_rgba8();
        let (width, height) = rgba.dimensions();
        self.insert_rgba(key, width, height, &rgba.into_raw())?;
        Ok(())
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

    /// Último frame de video publicado con `id` (la ruta del archivo).
    pub fn get_video(&self, id: &str) -> Option<Arc<Nv12Frame>> {
        self.videos.read_safe().get(id).cloned()
    }

    /// Publica un frame NV12 con los planos en memoria de la CPU: **una subida** por frame, que ven
    /// todas las pantallas. Si el tamaño no cambió se reescriben las texturas en el lugar.
    pub fn update_video_nv12_cpu(&self, id: &str, width: u32, height: u32, y: &[u8], uv: &[u8], matrix: YuvMatrix, full_range: bool) -> AppResult<()> {
        #[cfg(test)]
        self.uploads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        // El contexto se toma una vez y se mantiene hasta publicar el frame: si el
        // dispositivo se pierde mientras tanto, `sync_device` espera a que termine
        // esta subida (así no queda un frame del dispositivo muerto en la lista).
        let context = self.context.read_safe();

        if let Some(existing) = self.get_video(id) {
            if existing.is_cpu_backed() && existing.width == width && existing.height == height {
                existing.write_cpu_planes(&context, y, uv);
                return Ok(());
            }
        }

        let frame = Arc::new(Nv12Frame::from_cpu_planes(&context, width, height, y, uv, matrix, full_range)?);
        self.videos.write_safe().insert(id.to_string(), frame);
        Ok(())
    }

    /// Publica un frame cuyas texturas ya respaldan memoria de GPU (decodificador nativo): no se copia nada.
    pub fn set_video_native(&self, id: &str, frame: Nv12Frame) {
        self.videos.write_safe().insert(id.to_string(), Arc::new(frame));
    }

    /// Libera el frame de un video que ya nadie reproduce.
    pub fn remove_video(&self, id: &str) {
        self.videos.write_safe().remove(id);
    }

    /// Sube `rgba` como textura `id`; si otro hilo la insertó antes, gana esa.
    fn insert_rgba(&self, id: &str, width: u32, height: u32, rgba: &[u8]) -> AppResult<Arc<MediaTexture>> {
        let context = self.context.read_safe();
        let layouts = self.layouts.read_safe();
        let media = Arc::new(create_texture_from_rgba(
            &context.device,
            &context.queue,
            &layouts,
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
            source: ShaderSource::Wgsl(concat!(include_str!("shaders/layer_common.wgsl"), include_str!("shaders/composite.wgsl")).into()),
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
            // El shader de imagen no convierte de color: la matriz no se usa.
            yuv_matrix: YuvTransform::IDENTITY.matrix,
            yuv_offset: YuvTransform::IDENTITY.offset,
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

/// El almacén de medios si ya se creó (la primera pantalla lo crea); no inicializa la GPU.
pub fn store_if_ready() -> Option<Arc<MediaStore>> {
    SHARED_STORE.get().cloned()
}

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
    fn sync_device_rebuilds_the_store_when_the_context_changed() {
        // Un almacén propio sobre **otro** dispositivo: al sincronizar tiene que
        // adoptar el contexto compartido y tirar lo que era del dispositivo viejo.
        let own = super::super::gpu::GpuContext::new().expect("GPU disponible");
        let store = MediaStore::new(Arc::clone(&own));
        let texture = store.load_image(&test_png("sync-device.png")).expect("carga");
        assert!(store.get(&texture.id).is_some());

        assert!(store.sync_device().expect("sincroniza"), "el almacén tenía que rehacerse");
        assert!(store.get(&texture.id).is_none(), "las texturas del dispositivo viejo se tiran");
        // La segunda vez ya está en el contexto vigente: no hay nada que rehacer.
        assert!(!store.sync_device().expect("sincroniza"), "no hay nada que rehacer");
    }

    #[test]
    fn sync_device_does_nothing_when_the_context_is_the_same() {
        let store = store();
        assert!(!store.sync_device().expect("sincroniza"), "el contexto ya es el vigente");
    }

    #[test]
    fn arena_gives_each_layer_its_own_offset() {
        let store = store();
        let mut arena = store.new_arena();
        let gpu = super::super::gpu::shared().expect("GPU disponible");
        let u = LayerUniforms { opacity: 1.0, aspect_mode: 0, target_ratio: 1.0, media_ratio: 1.0, rect: [0.0, 0.0, 1.0, 1.0], yuv_matrix: YuvTransform::IDENTITY.matrix, yuv_offset: YuvTransform::IDENTITY.offset };
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
        let u = LayerUniforms { opacity: 1.0, aspect_mode: 0, target_ratio: 1.0, media_ratio: 1.0, rect: [0.0, 0.0, 1.0, 1.0], yuv_matrix: YuvTransform::IDENTITY.matrix, yuv_offset: YuvTransform::IDENTITY.offset };
        for _ in 0..MAX_LAYERS_PER_FRAME {
            assert!(arena.push(&gpu.queue, &u).is_some());
        }
        assert_eq!(arena.push(&gpu.queue, &u), None);
    }

    // --- F19.1: carga de imágenes fuera del hilo de render ---

    /// PNG de `width × height` con ruido (para que decodificarlo no sea instantáneo).
    fn noisy_png(name: &str, width: u32, height: u32) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("pulseflow-media-tests");
        std::fs::create_dir_all(&dir).expect("carpeta temporal");
        let path = dir.join(name);
        let image = image::RgbaImage::from_fn(width, height, |x, y| {
            let n = x.wrapping_mul(2_654_435_761).wrapping_add(y.wrapping_mul(40_503));
            image::Rgba([n as u8, (n >> 8) as u8, (n >> 16) as u8, 255])
        });
        image.save(&path).expect("guardar PNG de prueba");
        path
    }

    fn wait_until_settled(store: &Arc<MediaStore>, path: &std::path::Path) -> MediaState {
        let started = std::time::Instant::now();
        loop {
            let state = store.request_image(path);
            if !matches!(state, MediaState::Loading) || started.elapsed() > std::time::Duration::from_secs(10) {
                return state;
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }

    #[test]
    fn request_returns_immediately_while_loading() {
        let store = store();
        let path = noisy_png("grande.png", 3000, 3000);

        let started = std::time::Instant::now();
        let first = store.request_image(&path);
        assert!(started.elapsed() < std::time::Duration::from_millis(50), "el pedido bloqueó {:?}", started.elapsed());
        assert!(matches!(first, MediaState::Loading), "la primera respuesta es Loading");
    }

    #[test]
    fn ready_after_worker_finishes() {
        let store = store();
        let path = noisy_png("lista.png", 64, 64);
        match wait_until_settled(&store, &path) {
            MediaState::Ready(texture) => assert_eq!((texture.width, texture.height), (64, 64)),
            _ => panic!("tenía que quedar Ready"),
        }
        assert!(store.get(&path.to_string_lossy()).is_some(), "la textura queda en el almacén");
    }

    #[test]
    fn fifty_requests_one_decode() {
        let store = store();
        let path = noisy_png("repetida.png", 512, 512);
        for _ in 0..50 {
            let _ = store.request_image(&path);
        }
        assert!(matches!(wait_until_settled(&store, &path), MediaState::Ready(_)));
        assert_eq!(store.decodes(), 1, "un solo decode aunque se pida 50 veces");
    }

    #[test]
    fn missing_file_is_failed_and_stable() {
        let store = store();
        let path = std::path::Path::new("/no/existe/imagen.png");
        assert!(matches!(wait_until_settled(&store, path), MediaState::Failed(_)));
        for _ in 0..10 {
            assert!(matches!(store.request_image(path), MediaState::Failed(_)), "sigue Failed");
        }
        assert_eq!(store.decodes(), 1, "no se reencola");
    }

    #[test]
    fn oversized_image_fails_without_decoding_it() {
        let store = store();
        // 20000 px de ancho: pasa el límite de 16384 por lado (el archivo en sí es chico)
        let path = noisy_png("ancha.png", 20_000, 1);
        match wait_until_settled(&store, &path) {
            MediaState::Failed(reason) => assert!(reason.contains("16384"), "{reason}"),
            _ => panic!("tenía que fallar por tamaño"),
        }
    }

    #[test]
    fn prefetch_queues_each_image_once_and_ignores_blanks() {
        let store = store();
        let (a, b) = (noisy_png("pre-a.png", 32, 32), noisy_png("pre-b.png", 32, 32));
        let (a_str, b_str) = (a.to_string_lossy().to_string(), b.to_string_lossy().to_string());

        let queued = store.prefetch([a_str.as_str(), "", "   ", b_str.as_str(), a_str.as_str()]);
        assert_eq!(queued, 2, "dos imágenes distintas; los vacíos y el repetido no cuentan");

        assert!(matches!(wait_until_settled(&store, &a), MediaState::Ready(_)));
        assert!(matches!(wait_until_settled(&store, &b), MediaState::Ready(_)));
        assert_eq!(store.decodes(), 2);
    }

    #[test]
    fn prefetch_is_capped() {
        let store = store();
        let paths: Vec<String> = (0..200).map(|i| format!("/no/existe/{i}.png")).collect();
        assert_eq!(store.prefetch(paths.iter().map(String::as_str)), MAX_PREFETCH);
    }

    #[test]
    fn a_failed_image_is_retried_after_the_cooldown() {
        let store = MediaStore::new_with_retry(super::super::gpu::shared().expect("GPU disponible"), std::time::Duration::from_millis(80));
        let dir = std::env::temp_dir().join("pulseflow-media-tests");
        std::fs::create_dir_all(&dir).expect("carpeta temporal");
        let path = dir.join("aparece-despues.png");
        let _ = std::fs::remove_file(&path);

        // todavía no existe: falla y queda en Failed durante el enfriamiento
        assert!(matches!(wait_until_settled(&store, &path), MediaState::Failed(_)));
        assert!(matches!(store.request_image(&path), MediaState::Failed(_)));

        // el archivo termina de copiarse; pasado el enfriamiento se vuelve a intentar sola
        image::RgbaImage::from_pixel(8, 8, image::Rgba([9, 9, 9, 255])).save(&path).expect("guardar PNG");
        std::thread::sleep(std::time::Duration::from_millis(120));
        assert!(matches!(wait_until_settled(&store, &path), MediaState::Ready(_)));
        assert_eq!(store.decodes(), 2);
    }
}
