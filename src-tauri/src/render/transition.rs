//! Motor de transiciones de GPU por hardware (Doble Buffer y Shaders WGSL).
//!
//! Soporta:
//! - Doble Buffer (Texture A y Texture B) para swapchain suave.
//! - Efectos en GPU: Crossfade, Dip to Black, Wipe y Push.
//! - Curvas de aceleración (Easing) computadas directamente en hardware.

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
    pub active_is_b: bool,
    pub active_transition: ActiveTransition,
}

impl TransitionEngine {
    pub fn new(device: &Device, format: TextureFormat, width: u32, height: u32) -> Self {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("FreeShow Transition Shader"),
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
            active_is_b: false,
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

        let (texture_a, view_a) = create_target_texture(device, self.width, self.height, format, "Buffer A");
        let (texture_b, view_b) = create_target_texture(device, self.width, self.height, format, "Buffer B");

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

    /// Comienza una nueva transición intercambiando el buffer objetivo.
    pub fn trigger(&mut self, trans_type: TransitionType, duration_ms: u64, easing: EasingType) {
        self.active_transition.start(trans_type, duration_ms, easing);
        self.active_is_b = !self.active_is_b;
    }

    /// Dibuja la composición de la transición sobre el framebuffer final de la ventana.
    pub fn render(&mut self, queue: &Queue, render_pass: &mut RenderPass<'_>) {
        let progress = self.active_transition.current_progress();

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
        usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_SRC,
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
