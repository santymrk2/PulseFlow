//! Ayudas de test del engine (sólo `#[cfg(test)]`).

use super::gpu::{self, GpuContext};
use super::media::MediaStore;
use super::video::nv12::Nv12Frame;

/// Lee de vuelta los bytes de una textura de `width × height` con `bytes_per_pixel` bytes por
/// píxel, sin el relleno de filas. Sirve para comprobar qué ve la GPU de una textura importada.
pub fn read_texture_bytes(gpu: &GpuContext, texture: &wgpu::Texture, width: u32, height: u32, bytes_per_pixel: u32) -> Vec<u8> {
    let unpadded = width * bytes_per_pixel;
    let padded = unpadded.div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT) * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;

    let buffer = gpu.device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("test readback"),
        size: u64::from(padded) * u64::from(height),
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });
    let mut encoder = gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("test readback") });
    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(padded), rows_per_image: None } },
        wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
    );
    gpu.queue.submit([encoder.finish()]);

    let slice = buffer.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |result| {
        let _ = tx.send(result);
    });
    gpu.device.poll(wgpu::PollType::wait_indefinitely()).expect("poll");
    rx.recv().expect("canal").expect("mapeo");

    let mapped = slice.get_mapped_range().expect("rango mapeado");
    let mut bytes = Vec::with_capacity((unpadded * height) as usize);
    for row in 0..height {
        let start = (row * padded) as usize;
        bytes.extend_from_slice(&mapped[start..start + unpadded as usize]);
    }
    drop(mapped);
    buffer.unmap();
    bytes
}

/// Dibuja `frame` estirado sobre un destino 8×8 (sin sRGB) y devuelve el píxel central RGBA.
pub fn render_center(frame: &Nv12Frame) -> [u8; 4] {
    let gpu = gpu::shared().expect("GPU compartida");
    let store = MediaStore::new(gpu.clone());
    let pipeline = store.nv12_pipeline(wgpu::TextureFormat::Rgba8Unorm);
    let mut arena = store.new_arena();

    let target = gpu.device.create_texture(&wgpu::TextureDescriptor {
        label: Some("destino NV12"),
        size: wgpu::Extent3d { width: 8, height: 8, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder = gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("NV12 test") });
    {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("NV12 test pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store },
                depth_slice: None,
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pipeline.render(&gpu.device, &gpu.queue, &mut arena, &mut pass, frame, 8, 8, 1.0, 2);
    }
    gpu.queue.submit([encoder.finish()]);

    let pixels = read_texture_bytes(&gpu, &target, 8, 8, 4);
    let at = (4 * 8 + 4) * 4;
    [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]]
}

pub fn assert_near(actual: [u8; 4], expected: [u8; 3], what: &str) {
    for channel in 0..3 {
        let diff = i32::from(actual[channel]) - i32::from(expected[channel]);
        assert!(diff.abs() <= 4, "{what}: canal {channel} = {} (esperado ~{})", actual[channel], expected[channel]);
    }
    assert_eq!(actual[3], 255, "{what}: opaco");
}
