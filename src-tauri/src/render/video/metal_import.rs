//! Importación de `CVPixelBuffer` (NV12, respaldado por IOSurface) a texturas de wgpu en Metal,
//! sin copiar píxeles (F18.1/F18.5).
//!
//! `CVMetalTextureCache` crea una `MTLTexture` por plano apuntando a la misma memoria del
//! IOSurface; `wgpu::hal::metal` la envuelve como `wgpu::Texture`. Mientras la textura viva,
//! el `CVMetalTexture` y el `CVPixelBuffer` se retienen en el callback de destrucción.

use super::nv12::{Nv12Frame, YuvMatrix};
use crate::error::{AppError, AppResult};
use crate::render::gpu::GpuContext;
use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2_core_foundation::CFRetained;
use objc2_core_video::{
    kCVPixelFormatType_420YpCbCr8BiPlanarFullRange, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, kCVReturnSuccess, CVMetalTextureCache, CVMetalTextureGetTexture, CVPixelBuffer,
    CVPixelBufferGetHeightOfPlane, CVPixelBufferGetPixelFormatType, CVPixelBufferGetPlaneCount, CVPixelBufferGetWidthOfPlane,
};
use objc2_metal::{MTLDevice, MTLPixelFormat, MTLTexture, MTLTextureType};
use std::ptr::NonNull;

/// Caché de texturas de CoreVideo atada al `MTLDevice` de wgpu.
pub struct MetalTextureCache {
    cache: CFRetained<CVMetalTextureCache>,
}

// SAFETY: la caché sólo se usa para `CVMetalTextureCacheCreateTextureFromImage`, que CoreVideo
// documenta como utilizable desde cualquier hilo; quien la comparte la guarda en un `Mutex`.
unsafe impl Send for MetalTextureCache {}

impl MetalTextureCache {
    pub fn new(gpu: &GpuContext) -> AppResult<Self> {
        // SAFETY: sólo se lee el `MTLDevice` del backend Metal; no se muta ni se guarda la referencia.
        let hal_device = unsafe { gpu.device.as_hal::<wgpu::hal::api::Metal>() }.ok_or_else(|| AppError::new("El Device de wgpu no es de Metal"))?;
        let mtl_device: &ProtocolObject<dyn MTLDevice> = hal_device.raw_device();

        let mut raw: *mut CVMetalTextureCache = std::ptr::null_mut();
        // SAFETY: `raw` es un puntero de salida válido; el resultado se envuelve en `CFRetained` (posee el +1).
        let status = unsafe { CVMetalTextureCache::create(None, None, mtl_device, None, NonNull::from(&mut raw)) };
        if status != kCVReturnSuccess {
            return Err(AppError::new(format!("CVMetalTextureCacheCreate falló ({status})")));
        }
        let cache = NonNull::new(raw).ok_or_else(|| AppError::new("CVMetalTextureCache nula"))?;
        // SAFETY: `Create` devuelve un objeto con retain count +1 que ahora poseemos.
        Ok(Self { cache: unsafe { CFRetained::from_raw(cache) } })
    }
}

/// Lo que no se toca pero tiene que vivir hasta que la GPU deje de usar la textura.
struct Keepalive<T>(#[allow(dead_code)] T);
// SAFETY: sólo se destruye (CFRelease es seguro desde cualquier hilo); nunca se accede a su contenido.
unsafe impl<T> Send for Keepalive<T> {}
unsafe impl<T> Sync for Keepalive<T> {}

fn retain_buffer(pixel_buffer: &CVPixelBuffer) -> CFRetained<CVPixelBuffer> {
    // SAFETY: `pixel_buffer` es una referencia viva; `retain` suma un +1 que `CFRetained` suelta al destruirse.
    unsafe { CFRetained::retain(NonNull::from(pixel_buffer)) }
}

/// Envuelve los dos planos de `pixel_buffer` (NV12) como texturas de wgpu, sin copiar.
pub fn import_pixel_buffer(gpu: &GpuContext, cache: &MetalTextureCache, pixel_buffer: &CVPixelBuffer) -> AppResult<Nv12Frame> {
    let format = CVPixelBufferGetPixelFormatType(pixel_buffer);
    let full_range = match format {
        f if f == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange => false,
        f if f == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange => true,
        other => return Err(AppError::new(format!("Formato de píxel no soportado (no es NV12): {other:#x}"))),
    };
    if CVPixelBufferGetPlaneCount(pixel_buffer) != 2 {
        return Err(AppError::new("El CVPixelBuffer NV12 debe tener 2 planos"));
    }

    let y = import_plane(gpu, cache, pixel_buffer, 0, MTLPixelFormat::R8Unorm, wgpu::TextureFormat::R8Unorm)?;
    let uv = import_plane(gpu, cache, pixel_buffer, 1, MTLPixelFormat::RG8Unorm, wgpu::TextureFormat::Rg8Unorm)?;

    // Sin metadatos de color confiables, HD y menos es BT.709 y SD es BT.601 (convención de los decodificadores).
    let matrix = if y.height() >= 720 { YuvMatrix::Bt709 } else { YuvMatrix::Bt601 };
    let keepalive: Box<dyn std::any::Any + Send + Sync> = Box::new(Keepalive(retain_buffer(pixel_buffer)));
    Ok(Nv12Frame::new(y, uv, matrix, full_range, Some(keepalive)))
}

fn import_plane(gpu: &GpuContext, cache: &MetalTextureCache, pixel_buffer: &CVPixelBuffer, plane: usize, mtl_format: MTLPixelFormat, format: wgpu::TextureFormat) -> AppResult<wgpu::Texture> {
    let width = CVPixelBufferGetWidthOfPlane(pixel_buffer, plane);
    let height = CVPixelBufferGetHeightOfPlane(pixel_buffer, plane);

    let mut raw: *mut objc2_core_video::CVMetalTexture = std::ptr::null_mut();
    // SAFETY: todos los punteros son válidos; `raw` queda con un CVMetalTexture +1 si devuelve éxito.
    let status = unsafe { CVMetalTextureCache::create_texture_from_image(None, &cache.cache, pixel_buffer, None, mtl_format, width, height, plane, NonNull::from(&mut raw)) };
    if status != kCVReturnSuccess {
        return Err(AppError::new(format!("CVMetalTextureCacheCreateTextureFromImage falló en el plano {plane} ({status})")));
    }
    let cv_texture = NonNull::new(raw).ok_or_else(|| AppError::new("CVMetalTexture nulo"))?;
    // SAFETY: poseemos el +1 de `Create…`.
    let cv_texture = unsafe { CFRetained::from_raw(cv_texture) };

    // `CVMetalTextureGetTexture` ya devuelve la textura retenida.
    let mtl_texture: Retained<ProtocolObject<dyn MTLTexture>> = CVMetalTextureGetTexture(&cv_texture).ok_or_else(|| AppError::new("El CVMetalTexture no tiene MTLTexture"))?;

    let keep = Keepalive((cv_texture, retain_buffer(pixel_buffer)));
    let hal_texture = {
        // SAFETY: `mtl_texture` es una textura 2D de un nivel y una capa, del formato y tamaño declarados;
        // el callback retiene su origen hasta que wgpu destruya la textura.
        unsafe {
            wgpu::hal::metal::Device::texture_from_raw(
                mtl_texture,
                format,
                MTLTextureType::Type2D,
                1,
                1,
                wgpu::hal::CopyExtent { width: width as u32, height: height as u32, depth: 1 },
                Some(Box::new(move || drop(keep))),
            )
        }
    };

    let descriptor = wgpu::TextureDescriptor {
        label: Some("NV12 plane (CVMetalTextureCache)"),
        size: wgpu::Extent3d { width: width as u32, height: height as u32, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    };
    // SAFETY: `hal_texture` viene del mismo Device (Metal) y su descripción coincide con `descriptor`.
    Ok(unsafe { gpu.device.create_texture_from_hal::<wgpu::hal::api::Metal>(hal_texture, &descriptor, wgpu::TextureUses::RESOURCE) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::gpu;
    use crate::render::test_util::read_texture_bytes;
    use objc2_core_foundation::{CFBoolean, CFDictionary, CFString, CFType};
    use objc2_core_video::{
        kCVPixelBufferIOSurfacePropertiesKey, kCVPixelBufferMetalCompatibilityKey, kCVPixelFormatType_32BGRA, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, kCVReturnSuccess, CVPixelBufferCreate,
        CVPixelBufferGetBaseAddressOfPlane, CVPixelBufferGetBytesPerRowOfPlane, CVPixelBufferLockBaseAddress, CVPixelBufferLockFlags, CVPixelBufferUnlockBaseAddress,
    };
    use std::ptr::NonNull;

    /// `CVPixelBuffer` IOSurface-compatible del formato pedido, relleno de un color NV12 conocido.
    fn make_pixel_buffer(format: u32, width: usize, height: usize, y: u8, cb: u8, cr: u8) -> CFRetained<CVPixelBuffer> {
        let empty_iosurface_props = CFDictionary::<CFString, CFType>::empty();
        let truth = CFBoolean::new(true);
        let attributes = CFDictionary::<CFString, CFType>::from_slices(
            &[unsafe { kCVPixelBufferMetalCompatibilityKey }, unsafe { kCVPixelBufferIOSurfacePropertiesKey }],
            &[truth.as_ref(), empty_iosurface_props.as_ref()],
        );

        let mut raw: *mut CVPixelBuffer = std::ptr::null_mut();
        let status = unsafe { CVPixelBufferCreate(None, width, height, format, Some(attributes.as_opaque()), NonNull::from(&mut raw)) };
        assert_eq!(status, kCVReturnSuccess, "CVPixelBufferCreate falló: {status}");
        let buffer = unsafe { CFRetained::from_raw(NonNull::new(raw).expect("CVPixelBuffer nulo")) };

        if format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange {
            unsafe {
                assert_eq!(CVPixelBufferLockBaseAddress(&buffer, CVPixelBufferLockFlags(0)), kCVReturnSuccess);
                let y_base = CVPixelBufferGetBaseAddressOfPlane(&buffer, 0) as *mut u8;
                let y_stride = CVPixelBufferGetBytesPerRowOfPlane(&buffer, 0);
                for row in 0..height {
                    std::ptr::write_bytes(y_base.add(row * y_stride), y, width);
                }
                let uv_base = CVPixelBufferGetBaseAddressOfPlane(&buffer, 1) as *mut u8;
                let uv_stride = CVPixelBufferGetBytesPerRowOfPlane(&buffer, 1);
                for row in 0..height / 2 {
                    for col in 0..width / 2 {
                        *uv_base.add(row * uv_stride + col * 2) = cb;
                        *uv_base.add(row * uv_stride + col * 2 + 1) = cr;
                    }
                }
                CVPixelBufferUnlockBaseAddress(&buffer, CVPixelBufferLockFlags(0));
            }
        }
        buffer
    }

    #[test]
    fn imported_nv12_planes_see_the_pixels_written_by_the_cpu() {
        let gpu = gpu::shared().expect("GPU compartida");
        let cache = MetalTextureCache::new(&gpu).expect("caché de texturas");
        let buffer = make_pixel_buffer(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, 64, 64, 63, 102, 240);

        let frame = import_pixel_buffer(&gpu, &cache, &buffer).expect("importación");

        assert_eq!((frame.width, frame.height), (64, 64));
        assert!(!frame.full_range, "420v es rango de video");
        let y = read_texture_bytes(&gpu, &frame.y, 64, 64, 1);
        assert!(y.iter().all(|&v| v == 63), "plano Y: {:?}", &y[..8]);
        let uv = read_texture_bytes(&gpu, &frame.uv, 32, 32, 2);
        assert!(uv.chunks(2).all(|p| p == [102, 240]), "plano CbCr: {:?}", &uv[..8]);
    }

    #[test]
    fn a_buffer_that_is_not_nv12_is_rejected() {
        let gpu = gpu::shared().expect("GPU compartida");
        let cache = MetalTextureCache::new(&gpu).expect("caché de texturas");
        let buffer = make_pixel_buffer(kCVPixelFormatType_32BGRA, 16, 16, 0, 0, 0);

        assert!(import_pixel_buffer(&gpu, &cache, &buffer).is_err());
    }
}
