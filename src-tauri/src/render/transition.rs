//! Motor de transiciones de GPU por hardware (Doble Buffer y Shaders WGSL).
//!
//! Uso desde el bucle de render (F4.4):
//! 1. Se dibuja la escena actual en `view_b` (el buffer "hacia").
//! 2. Al llegar una escena nueva, si `trigger` devuelve `true` se copia `texture_b`
//!    (la escena anterior) a `texture_a` (el buffer "desde") antes de dibujar la nueva.
//! 3. `render` compone `texture_a` → `texture_b` según `progress` sobre el framebuffer
//!    final (el shader recibe `a` como origen y `b` como destino).
//!
//! El corte (`None` o duración 0) no copia ni anima: `progress` es 1 desde el inicio y
//! el shader muestra directamente `texture_b`.
//!
//! - Efectos en GPU: crossfade, dip to black, wipe y push.
//! - Curvas de aceleración (easing) computadas directamente en hardware.

use std::time::{Duration, Instant};
use wgpu::{
    BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout, BindGroupLayoutDescriptor,
    BindGroupLayoutEntry, BindingResource, BindingType, BlendComponent, BlendState,
    ColorTargetState, ColorWrites, Device, Extent3d, FragmentState, MultisampleState,
    PipelineCompilationOptions, PipelineLayoutDescriptor, PrimitiveState, Queue, RenderPass,
    RenderPipeline, RenderPipelineDescriptor, Sampler, SamplerBindingType, SamplerDescriptor,
    ShaderModuleDescriptor, ShaderSource, ShaderStages, Texture, TextureDescriptor,
    TextureDimension, TextureFormat, TextureSampleType, TextureUsages, TextureView,
    TextureViewDescriptor, TextureViewDimension, VertexState,
};

#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionType {
    None = 0,
    Crossfade = 1,
    DipToBlack = 2,
    WipeLeft = 3,
    WipeRight = 4,
    PushLeft = 5,
    PushRight = 6,
}

impl TransitionType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "crossfade" | "fade" => Self::Crossfade,
            "diptoblack" | "dip_black" | "black" => Self::DipToBlack,
            "wipeleft" | "wipe_left" => Self::WipeLeft,
            "wiperight" | "wipe_right" | "wipe" => Self::WipeRight,
            "pushleft" | "push_left" => Self::PushLeft,
            "pushright" | "push_right" | "push" => Self::PushRight,
            _ => Self::None,
        }
    }
}

#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EasingType {
    Linear = 0,
    EaseInOut = 1,
    EaseOut = 2,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct TransitionUniforms {
    pub progress: f32,
    pub transition_type: u32,
    pub easing: u32,
    pub _pad: u32,
}

/// Estado de la transición activa controlada por tiempo.
pub struct ActiveTransition {
    pub start_time: Instant,
    pub duration: Duration,
    pub transition_type: TransitionType,
    pub easing: EasingType,
    pub is_active: bool,
}

impl ActiveTransition {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            duration: Duration::from_millis(0),
            transition_type: TransitionType::None,
            easing: EasingType::EaseInOut,
            is_active: false,
        }
    }

    pub fn start(&mut self, trans_type: TransitionType, duration_ms: u64, easing: EasingType) {
        self.start_time = Instant::now();
        self.duration = Duration::from_millis(duration_ms);
        self.transition_type = trans_type;
        self.easing = easing;
        self.is_active = duration_ms > 0 && trans_type != TransitionType::None;
    }

    /// Calcula el progreso normalizado (0.0 a 1.0) para el frame actual.
    pub fn current_progress(&mut self) -> f32 {
        if !self.is_active || self.duration.as_millis() == 0 {
            return 1.0;
        }

        let elapsed = self.start_time.elapsed();
        let progress = (elapsed.as_secs_f32() / self.duration.as_secs_f32()).clamp(0.0, 1.0);

        if progress >= 1.0 {
            self.is_active = false;
        }

        progress
    }
}

impl Default for ActiveTransition {
    fn default() -> Self {
        Self::new()
    }
}

/// Pipeline de transición con Doble Buffer (Texture A y Texture B).
pub struct TransitionEngine {
    pub pipeline: RenderPipeline,
    pub bind_group_layout: BindGroupLayout,
    pub uniform_buffer: wgpu::Buffer,
    pub sampler: Sampler,
    pub texture_a: Texture,
    pub view_a: TextureView,
    pub texture_b: Texture,
    pub view_b: TextureView,
    pub bind_group: BindGroup,
    pub width: u32,
    pub height: u32,
    pub active_transition: ActiveTransition,
}

impl TransitionEngine {
    pub fn new(device: &Device, format: TextureFormat, width: u32, height: u32) -> Self {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("PulseFlow Transition Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/transition.wgsl").into()),
        });

        let uniform_size = std::mem::size_of::<TransitionUniforms>() as u64;
        let uniform_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Transition Uniforms"),
            size: uniform_size,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let sampler = device.create_sampler(&SamplerDescriptor {
            label: Some("Transition Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::MipmapFilterMode::Nearest,
            ..Default::default()
        });

        let bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Transition Bind Group Layout"),
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
                // Binding 1: Texture A
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
                // Binding 2: Texture B
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Binding 3: Sampler
                BindGroupLayoutEntry {
                    binding: 3,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Transition Pipeline Layout"),
            bind_group_layouts: &[Some(&bind_group_layout)],
            immediate_size: 0,
        });

        let pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Transition Render Pipeline"),
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
                        color: BlendComponent::REPLACE,
                        alpha: BlendComponent::REPLACE,
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

        // Crear Textura A y Textura B para doble buffer
        let (texture_a, view_a) = create_target_texture(device, width, height, format, "Buffer A");
        let (texture_b, view_b) = create_target_texture(device, width, height, format, "Buffer B");

        let bind_group = create_transition_bind_group(
            device,
            &bind_group_layout,
            &uniform_buffer,
            &view_a,
            &view_b,
            &sampler,
        );

        Self {
            pipeline,
            bind_group_layout,
            uniform_buffer,
            sampler,
            texture_a,
            view_a,
            texture_b,
            view_b,
            bind_group,
            width,
            height,
            active_transition: ActiveTransition::new(),
        }
    }

    /// Redimensiona los buffers offscreen si cambia el tamaño de la ventana.
    pub fn resize(&mut self, device: &Device, format: TextureFormat, width: u32, height: u32) {
        if self.width == width && self.height == height {
            return;
        }
        self.width = width.max(1);
        self.height = height.max(1);

        let (texture_a, view_a) =
            create_target_texture(device, self.width, self.height, format, "Buffer A");
        let (texture_b, view_b) =
            create_target_texture(device, self.width, self.height, format, "Buffer B");

        self.bind_group = create_transition_bind_group(
            device,
            &self.bind_group_layout,
            &self.uniform_buffer,
            &view_a,
            &view_b,
            &self.sampler,
        );

        self.texture_a = texture_a;
        self.view_a = view_a;
        self.texture_b = texture_b;
        self.view_b = view_b;
    }

    /// Comienza una transición. Devuelve `true` si de verdad hay que animarla (una
    /// transición con duración distinta de `None`): en ese caso el bucle debe copiar
    /// el fotograma anterior a la textura A antes de dibujar el nuevo en B. Un corte
    /// (`None` o duración 0) devuelve `false`: el resultado ya es el buffer nuevo.
    pub fn trigger(
        &mut self,
        trans_type: TransitionType,
        duration_ms: u64,
        easing: EasingType,
    ) -> bool {
        self.active_transition
            .start(trans_type, duration_ms, easing);
        self.active_transition.is_active
    }

    /// Dibuja la composición de la transición sobre el framebuffer final de la ventana.
    pub fn render(&mut self, queue: &Queue, render_pass: &mut RenderPass<'_>) {
        let progress = self.active_transition.current_progress();
        self.render_with_progress(queue, render_pass, progress);
    }

    /// Escribe los uniforms y dibuja el quad de composición con un `progress` dado
    /// (0 = `texture_a`, 1 = `texture_b`). Separado de `render` para poder fijar el
    /// progreso en los tests sin depender del reloj.
    fn render_with_progress(
        &mut self,
        queue: &Queue,
        render_pass: &mut RenderPass<'_>,
        progress: f32,
    ) {
        let uniforms = TransitionUniforms {
            progress,
            transition_type: self.active_transition.transition_type as u32,
            easing: self.active_transition.easing as u32,
            _pad: 0,
        };

        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, &self.bind_group, &[]);
        render_pass.draw(0..6, 0..1);
    }
}

fn create_target_texture(
    device: &Device,
    width: u32,
    height: u32,
    format: TextureFormat,
    label: &str,
) -> (Texture, TextureView) {
    let texture = device.create_texture(&TextureDescriptor {
        label: Some(label),
        size: Extent3d {
            width: width.max(1),
            height: height.max(1),
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D2,
        format,
        usage: TextureUsages::RENDER_ATTACHMENT
            | TextureUsages::TEXTURE_BINDING
            | TextureUsages::COPY_SRC
            | TextureUsages::COPY_DST,
        view_formats: &[],
    });

    let view = texture.create_view(&TextureViewDescriptor::default());
    (texture, view)
}

fn create_transition_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    uniform_buffer: &wgpu::Buffer,
    view_a: &TextureView,
    view_b: &TextureView,
    sampler: &Sampler,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: Some("Transition Bind Group"),
        layout,
        entries: &[
            BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            },
            BindGroupEntry {
                binding: 1,
                resource: BindingResource::TextureView(view_a),
            },
            BindGroupEntry {
                binding: 2,
                resource: BindingResource::TextureView(view_b),
            },
            BindGroupEntry {
                binding: 3,
                resource: BindingResource::Sampler(sampler),
            },
        ],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: u32 = 64;
    /// Formato sin conversión sRGB: los bytes escritos se leen tal cual, así el test
    /// puede comparar los colores del crossfade directamente.
    const FORMAT: TextureFormat = TextureFormat::Rgba8Unorm;

    fn device() -> (Device, Queue) {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
            ..Default::default()
        }))
        .expect("adaptador GPU");
        pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("Transition Test Device"),
            ..Default::default()
        }))
        .expect("device de prueba")
    }

    fn solid() -> (Device, Queue, TransitionEngine) {
        let (device, queue) = device();
        let engine = TransitionEngine::new(&device, FORMAT, SIZE, SIZE);
        (device, queue, engine)
    }

    /// Rellena una textura con un color sólido.
    fn fill(queue: &Queue, texture: &Texture, color: [u8; 4]) {
        let data: Vec<u8> = color
            .iter()
            .copied()
            .cycle()
            .take((SIZE * SIZE * 4) as usize)
            .collect();
        queue.write_texture(
            texture.as_image_copy(),
            &data,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(SIZE * 4),
                rows_per_image: Some(SIZE),
            },
            Extent3d {
                width: SIZE,
                height: SIZE,
                depth_or_array_layers: 1,
            },
        );
    }

    /// Compone la transición en una textura offscreen y devuelve el color del píxel
    /// central.
    fn composite_center(
        device: &Device,
        queue: &Queue,
        engine: &mut TransitionEngine,
        trans_type: TransitionType,
        easing: EasingType,
        progress: f32,
    ) -> [u8; 4] {
        engine.active_transition.transition_type = trans_type;
        engine.active_transition.easing = easing;

        let target = device.create_texture(&TextureDescriptor {
            label: Some("Transition Test Target"),
            size: Extent3d {
                width: SIZE,
                height: SIZE,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: FORMAT,
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = target.create_view(&TextureViewDescriptor::default());

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Transition Test Encoder"),
        });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Transition Test Pass"),
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
            engine.render_with_progress(queue, &mut pass, progress);
        }

        let bytes_per_row = SIZE * 4; // múltiplo del alineamiento de wgpu
        let buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Transition Test Readback"),
            size: u64::from(bytes_per_row) * u64::from(SIZE),
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });
        encoder.copy_texture_to_buffer(
            target.as_image_copy(),
            wgpu::TexelCopyBufferInfo {
                buffer: &buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(SIZE),
                },
            },
            Extent3d {
                width: SIZE,
                height: SIZE,
                depth_or_array_layers: 1,
            },
        );
        queue.submit([encoder.finish()]);

        let slice = buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });
        device
            .poll(wgpu::PollType::wait_indefinitely())
            .expect("poll");
        rx.recv().expect("mapeo listo").expect("mapeo ok");

        let mapped = slice.get_mapped_range().expect("rango mapeado");
        let center = ((SIZE / 2) * bytes_per_row + (SIZE / 2) * 4) as usize;
        let pixel = [
            mapped[center],
            mapped[center + 1],
            mapped[center + 2],
            mapped[center + 3],
        ];
        drop(mapped);
        buffer.unmap();
        pixel
    }

    fn assert_near(actual: [u8; 4], expected: [u8; 4], what: &str) {
        for c in 0..3 {
            let diff = i32::from(actual[c]) - i32::from(expected[c]);
            assert!(diff.abs() <= 10, "{what}: {actual:?} vs {expected:?}");
        }
    }

    #[test]
    fn corte_muestra_el_buffer_nuevo_aunque_el_progreso_sea_cero() {
        let (device, queue, mut engine) = solid();
        fill(&queue, &engine.texture_a, [255, 0, 0, 255]); // anterior: rojo
        fill(&queue, &engine.texture_b, [0, 0, 255, 255]); // nuevo: azul

        // Con corte (`None`) el shader ignora el progreso y muestra siempre `b`.
        let center = composite_center(
            &device,
            &queue,
            &mut engine,
            TransitionType::None,
            EasingType::Linear,
            0.0,
        );
        assert_near(
            center,
            [0, 0, 255, 255],
            "corte debe mostrar el buffer nuevo",
        );
    }

    #[test]
    fn crossfade_mezcla_los_dos_buffers() {
        let (device, queue, mut engine) = solid();
        fill(&queue, &engine.texture_a, [255, 0, 0, 255]); // anterior: rojo
        fill(&queue, &engine.texture_b, [0, 0, 255, 255]); // nuevo: azul

        let at = |engine: &mut TransitionEngine, progress: f32| {
            composite_center(
                &device,
                &queue,
                engine,
                TransitionType::Crossfade,
                EasingType::Linear,
                progress,
            )
        };

        assert_near(
            at(&mut engine, 0.0),
            [255, 0, 0, 255],
            "progreso 0 = buffer anterior",
        );
        assert_near(
            at(&mut engine, 1.0),
            [0, 0, 255, 255],
            "progreso 1 = buffer nuevo",
        );

        // Al 50% el crossfade mezcla rojo y azul: (127, 0, 127).
        let middle = at(&mut engine, 0.5);
        assert!(
            (i32::from(middle[0]) - 128).abs() <= 10
                && middle[1] <= 10
                && (i32::from(middle[2]) - 128).abs() <= 10,
            "el crossfade al 50% debe mezclar los dos buffers: {middle:?}"
        );
    }

    #[test]
    fn trigger_indica_si_hace_falta_copiar_el_buffer_anterior() {
        let (_device, _queue, mut engine) = solid();

        // Crossfade con duración: hay que animar y copiar el fotograma anterior.
        assert!(engine.trigger(TransitionType::Crossfade, 300, EasingType::EaseInOut));
        assert!(engine.active_transition.is_active);
        assert!(engine.active_transition.current_progress() < 1.0);

        // Corte: no hay nada que copiar ni animar, el resultado ya es el buffer nuevo.
        assert!(!engine.trigger(TransitionType::None, 300, EasingType::EaseInOut));
        assert!(!engine.active_transition.is_active);
        assert_eq!(engine.active_transition.current_progress(), 1.0);
    }
}
