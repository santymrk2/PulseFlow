//! Bucle de render por pantalla (un hilo WGPU por ventana).

use super::*;
use crate::render::media::{MediaState, MediaStore, MediaTexture};
use crate::render::{gpu, media};

// ---------------------------------------------------------------------------
// Bucle de render (uno por pantalla; audiencia y stage son layouts, no ciclos)
// ---------------------------------------------------------------------------

pub(super) fn spawn_render_loop(
    window: Arc<Window>,
    kind: ScreenKind,
    scene: Arc<RwLock<ScreenScene>>,
    running: Arc<AtomicBool>,
    pending_transition: Arc<Mutex<Option<TransitionRequest>>>,
    surface_size: Arc<Mutex<PhysicalSize<u32>>>,
) -> AppResult<JoinHandle<()>> {
    let gpu = gpu::shared()?;
    let store = media::shared_store()?;
    let surface = gpu
        .instance
        .create_surface(Arc::clone(&window))
        .map_err(|e| AppError::new(format!("Error creando la superficie WGPU: {e}")))?;
    if !gpu.supports_surface(&surface) {
        return Err(AppError::new("La GPU compartida no puede presentar en esta pantalla"));
    }
    let (device, queue) = (gpu.device.clone(), gpu.queue.clone());

    let size = window.inner_size().unwrap_or(PhysicalSize::new(1920, 1080));
    let mut config = surface
        .get_default_config(&gpu.adapter, size.width.max(1), size.height.max(1))
        .ok_or_else(|| AppError::new("La superficie no es compatible con la GPU"))?;
    config.present_mode = wgpu::PresentMode::Fifo; // VSync
    surface.configure(&device, &config);

    thread::Builder::new()
        .name(format!("PulseFlow-Screen-{}", window.label()))
        .spawn(move || {
            let background_pipeline = store.pipeline(config.format);
            let nv12_pipeline = store.nv12_pipeline(config.format);
            let mut arena = store.new_arena();
            let mut text_engine = TextEngine::new(&device, &queue, config.format);
            // F4.4: doble buffer offscreen donde se compone la escena + la transición.
            let mut transition_engine = crate::render::transition::TransitionEngine::new(
                &device,
                config.format,
                config.width,
                config.height,
            );

            while running.load(Ordering::Relaxed) {
                let frame_start = Instant::now();
                arena.begin_frame();

                {
                    let current = *surface_size.lock_safe();
                    if current.width > 0
                        && current.height > 0
                        && (current.width != config.width || current.height != config.height)
                    {
                        config.width = current.width;
                        config.height = current.height;
                        surface.configure(&device, &config);
                        transition_engine.resize(&device, config.format, config.width, config.height);
                    }
                }

                let frame = match surface.get_current_texture() {
                    wgpu::CurrentSurfaceTexture::Success(frame)
                    | wgpu::CurrentSurfaceTexture::Suboptimal(frame) => frame,
                    wgpu::CurrentSurfaceTexture::Outdated
                    | wgpu::CurrentSurfaceTexture::Lost => {
                        surface.configure(&device, &config);
                        continue;
                    }
                    _ => {
                        thread::sleep(Duration::from_millis(16));
                        continue;
                    }
                };

                let view = frame
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default());
                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("PulseFlow Screen Encoder"),
                });

                // F4.4: si llegó una escena nueva, se dispara la transición. Sólo hay
                // que copiar el fotograma anterior cuando de verdad se anima (crossfade
                // y demás); el corte muestra el buffer nuevo sin copiar nada.
                let copy_previous = match pending_transition.lock_safe().take() {
                    Some(request) => transition_engine.trigger(
                        request.transition_type,
                        request.duration_ms,
                        request.easing,
                    ),
                    None => false,
                };
                if copy_previous {
                    let size = wgpu::Extent3d {
                        width: transition_engine.width,
                        height: transition_engine.height,
                        depth_or_array_layers: 1,
                    };
                    encoder.copy_texture_to_texture(
                        transition_engine.texture_b.as_image_copy(),
                        transition_engine.texture_a.as_image_copy(),
                        size,
                    );
                }

                {
                    // La escena se dibuja en el buffer B; la transición compone A -> B
                    // sobre la superficie de la ventana.
                    let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("PulseFlow Screen Pass"),
                        color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                            view: &transition_engine.view_b,
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

                    let current = scene.read_safe().clone();
                    // F21.2: el contenido se encuadra en la ventana (barras negras + `alignPosition`) cuando la
                    // proporción de la escena no coincide con la de la salida
                    let frame_rect = crate::render::frame::fit_content_rect(current.content, config.width, config.height);
                    frame_rect.apply_to(&mut pass);
                    let (w, h) = (frame_rect.width, frame_rect.height);

                    let blocks = match kind {
                        ScreenKind::Audience => {
                            if let Some(bg) = current.background {
                                if is_video(&bg) {
                                    // video: un frame NV12 por archivo (la ruta es el id), convertido a RGB en el shader
                                    if let Some(frame) = bg.path.as_deref().and_then(|path| store.get_video(path)) {
                                        nv12_pipeline.render(&device, &queue, &mut arena, &mut pass, &frame, w, h, bg.opacity, bg.aspect_mode);
                                    }
                                } else if let Some(texture) = bg.path.as_deref().and_then(|path| ready_image(&store, path)) {
                                    background_pipeline.render(
                                        &queue,
                                        &mut arena,
                                        &mut pass,
                                        &texture,
                                        w,
                                        h,
                                        bg.opacity,
                                        bg.aspect_mode,
                                    );
                                }
                            }

                            // Items de medio (imágenes) colocados en la slide, encima
                            // del fondo y debajo del texto (F4.5).
                            for item in &current.media {
                                if item.media_type != "image" || item.path.is_empty() {
                                    continue;
                                }
                                if let Some(texture) = ready_image(&store, &item.path) {
                                    // La caja viene en la resolución lógica de la escena.
                                    let scale = match item.design_width {
                                        Some(dw) if dw > 0.0 => w as f32 / dw,
                                        _ => 1.0,
                                    };
                                    background_pipeline.render_rect(
                                        &queue,
                                        &mut arena,
                                        &mut pass,
                                        &texture,
                                        w,
                                        h,
                                        [
                                            item.x * scale,
                                            item.y * scale,
                                            item.width * scale,
                                            item.height * scale,
                                        ],
                                        item.opacity,
                                        item.aspect_mode,
                                    );
                                }
                            }

                            // Texto de la slide (capa 3). Los overlays del Scene Graph
                            // (F4.6) se dibujan después, en su propia capa.
                            current.text.clone()
                        }
                        ScreenKind::Stage => crate::render::stage::stage_blocks(&current.stage, w as f32, h as f32),
                    };

                    if !blocks.is_empty() {
                        let _ = text_engine.render(&device, &queue, &mut pass, w, h, &blocks);
                    }

                    // Capa de overlays del Scene Graph (F4.6): fondo → medios slide →
                    // texto slide → medios overlay → texto overlay. Sólo en audiencia.
                    if matches!(kind, ScreenKind::Audience) {
                        // Medios (imágenes) de los overlays.
                        for item in &current.overlay_media {
                            if item.media_type != "image" || item.path.is_empty() {
                                continue;
                            }
                            if let Some(texture) = ready_image(&store, &item.path) {
                                let scale = match item.design_width {
                                    Some(dw) if dw > 0.0 => w as f32 / dw,
                                    _ => 1.0,
                                };
                                background_pipeline.render_rect(
                                        &queue,
                                        &mut arena,
                                        &mut pass,
                                    &texture,
                                    w,
                                    h,
                                    [
                                        item.x * scale,
                                        item.y * scale,
                                        item.width * scale,
                                        item.height * scale,
                                    ],
                                    item.opacity,
                                    item.aspect_mode,
                                );
                            }
                        }

                        // Texto de los overlays.
                        if !current.overlay_text.is_empty() {
                            let _ = text_engine.render(
                                &device,
                                &queue,
                                &mut pass,
                                w,
                                h,
                                &current.overlay_text,
                            );
                        }

                        // Overlays del modelo previo (relojes/avisos): se dibujan
                        // por encima de todo, como antes.
                        let old_blocks: Vec<TextBlock> = current
                            .overlays
                            .clone()
                            .into_iter()
                            .map(|o| overlay_block(o, w))
                            .collect();
                        if !old_blocks.is_empty() {
                            let _ = text_engine.render(&device, &queue, &mut pass, w, h, &old_blocks);
                        }
                    }
                }

                // Compone la transición (o, sin transición activa, copia el buffer B,
                // que ya tiene la escena actual) sobre la superficie de la ventana.
                {
                    let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("PulseFlow Transition Pass"),
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
                    transition_engine.render(&queue, &mut pass);
                }

                queue.submit([encoder.finish()]);
                queue.present(frame);

                // Fifo ya limita a la frecuencia del monitor; esto evita girar en
                // vacío si el compositor no bloquea.
                let elapsed = frame_start.elapsed();
                if elapsed < Duration::from_millis(8) {
                    thread::sleep(Duration::from_millis(8) - elapsed);
                }
            }
        })
        .map_err(|e| AppError::new(format!("Error iniciando el hilo de render: {e}")))
}

/// Mapea un overlay del modelo previo a un bloque de texto (contorno + sombra).
pub(super) fn overlay_block(o: OverlayItem, surface_width: u32) -> TextBlock {
    TextBlock {
        text: o.text,
        font_family: None,
        font_size: o.font_size,
        font_weight: 700,
        font_style: None,
        color: o.color,
        alignment: "left".to_string(),
        x: o.x,
        y: o.y,
        width: surface_width as f32,
        height: 200.0,
        line_height_ratio: 1.2,
        outline_color: Some([0.0, 0.0, 0.0, 1.0]),
        outline_width: Some(1.5),
        shadow_color: Some([0.0, 0.0, 0.0, 0.8]),
        shadow_offset: Some([3.0, 3.0]),
        ..Default::default()
    }
}

/// Textura de la imagen si ya está lista. Si no, la pide a los workers (sin bloquear el hilo de render)
/// y devuelve `None`: la capa aparece en el primer frame después de que termine de cargarse.
fn ready_image(store: &Arc<MediaStore>, path: &str) -> Option<Arc<MediaTexture>> {
    match store.request_image(std::path::Path::new(path)) {
        MediaState::Ready(texture) => Some(texture),
        MediaState::Loading | MediaState::Failed(_) => None,
    }
}
