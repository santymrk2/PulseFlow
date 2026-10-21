//! Windows: frames D3D11 de Media Foundation → texturas de wgpu (DX12) sin pasar por la CPU (F18.6).
//!
//! El decodificador entrega texturas D3D11 NV12 de su propio pool, que no se pueden compartir. Cada
//! frame se copia **GPU→GPU** (`CopySubresourceRegion`) a una textura NV12 compartida
//! (`SHARED_NTHANDLE`) de un anillo de 3, que wgpu abre como recurso D3D12 y ve por planos
//! (`Plane0` = `R8Unorm`, `Plane1` = `Rg8Unorm`). Los píxeles nunca pasan por la CPU.
//!
//! Sincronización: `Flush` + `ID3D11Query` de evento esperado en el hilo del decodificador antes de
//! publicar el frame (una espera de fence, no una copia). El anillo de 3 deja que el render termine de
//! leer un frame mientras se escribe el siguiente; no protege de un render atascado por más de 2 frames.
//!
//! **Sin verificar en Windows**: se compila contra `x86_64-pc-windows-msvc`, pero no se pudo ejecutar.

use super::nv12::{guess_matrix, Nv12Frame};
use crate::error::{AppError, AppResult};
use crate::render::gpu::GpuContext;
use windows::core::{Interface, BOOL};
use windows::Win32::Foundation::{CloseHandle, HANDLE, HMODULE};
use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_UNKNOWN;
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Multithread, ID3D11Query, ID3D11Texture2D, D3D11_BIND_SHADER_RESOURCE, D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_CREATE_DEVICE_VIDEO_SUPPORT, D3D11_QUERY_DESC,
    D3D11_QUERY_EVENT, D3D11_RESOURCE_MISC_SHARED, D3D11_RESOURCE_MISC_SHARED_NTHANDLE, D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
};
use windows::Win32::Graphics::Direct3D12::ID3D12Resource;
use windows::Win32::Graphics::Dxgi::Common::{DXGI_FORMAT_NV12, DXGI_SAMPLE_DESC};
use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIAdapter, IDXGIFactory4, IDXGIResource1, DXGI_SHARED_RESOURCE_READ};
use windows::Win32::Media::MediaFoundation::{IMFDXGIDeviceManager, MFCreateDXGIDeviceManager};

/// Cuántas texturas compartidas rotan (el render lee una mientras se escribe otra).
const RING_SIZE: usize = 3;

fn err(context: &str, e: impl std::fmt::Display) -> AppError {
    AppError::new(format!("{context}: {e}"))
}

struct Slot {
    texture: ID3D11Texture2D,
    wgpu_texture: wgpu::Texture,
    y_view: wgpu::TextureView,
    uv_view: wgpu::TextureView,
}

/// Dispositivo D3D11 (en el mismo adaptador que wgpu) y anillo de texturas compartidas.
pub struct D3dInterop {
    context: ID3D11DeviceContext,
    device: ID3D11Device,
    query: ID3D11Query,
    manager: IMFDXGIDeviceManager,
    ring: Vec<Slot>,
    ring_size: (u32, u32),
    next: usize,
}

impl D3dInterop {
    pub fn new(gpu: &GpuContext) -> AppResult<Self> {
        if !gpu.device.features().contains(wgpu::Features::TEXTURE_FORMAT_NV12) {
            return Err(AppError::new("El adaptador de wgpu no soporta texturas NV12"));
        }

        // El decodificador y wgpu tienen que usar el mismo adaptador: se busca el de wgpu por su LUID.
        // SAFETY: sólo se lee el LUID del dispositivo DX12 de wgpu.
        let luid = unsafe {
            let hal = gpu.device.as_hal::<wgpu::hal::api::Dx12>().ok_or_else(|| AppError::new("El Device de wgpu no es DX12"))?;
            hal.raw_device().GetAdapterLuid()
        };
        // SAFETY: llamadas COM con objetos propios y vivos.
        unsafe {
            let factory: IDXGIFactory4 = CreateDXGIFactory1().map_err(|e| err("CreateDXGIFactory1", e))?;
            let adapter: IDXGIAdapter = factory.EnumAdapterByLuid::<windows::Win32::Graphics::Dxgi::IDXGIAdapter1>(luid).map_err(|e| err("EnumAdapterByLuid", e))?.cast().map_err(|e| err("IDXGIAdapter", e))?;

            let mut device: Option<ID3D11Device> = None;
            let mut context: Option<ID3D11DeviceContext> = None;
            D3D11CreateDevice(
                &adapter,
                D3D_DRIVER_TYPE_UNKNOWN,
                HMODULE::default(),
                D3D11_CREATE_DEVICE_VIDEO_SUPPORT | D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&mut device),
                None,
                Some(&mut context),
            )
            .map_err(|e| err("D3D11CreateDevice", e))?;
            let device = device.ok_or_else(|| AppError::new("D3D11CreateDevice no devolvió un dispositivo"))?;
            let context = context.ok_or_else(|| AppError::new("D3D11CreateDevice no devolvió un contexto"))?;

            // Media Foundation usa el dispositivo desde sus propios hilos.
            let multithread: ID3D11Multithread = device.cast().map_err(|e| err("ID3D11Multithread", e))?;
            let _ = multithread.SetMultithreadProtected(true);

            let mut token = 0u32;
            let mut manager: Option<IMFDXGIDeviceManager> = None;
            MFCreateDXGIDeviceManager(&mut token, &mut manager).map_err(|e| err("MFCreateDXGIDeviceManager", e))?;
            let manager = manager.ok_or_else(|| AppError::new("MFCreateDXGIDeviceManager no devolvió un administrador"))?;
            manager.ResetDevice(&device, token).map_err(|e| err("IMFDXGIDeviceManager::ResetDevice", e))?;

            let mut query: Option<ID3D11Query> = None;
            device.CreateQuery(&D3D11_QUERY_DESC { Query: D3D11_QUERY_EVENT, MiscFlags: 0 }, Some(&mut query)).map_err(|e| err("CreateQuery", e))?;
            let query = query.ok_or_else(|| AppError::new("CreateQuery no devolvió una consulta"))?;

            Ok(Self { context, device, query, manager, ring: Vec::new(), ring_size: (0, 0), next: 0 })
        }
    }

    /// Administrador para `MF_SOURCE_READER_D3D_MANAGER` (el decodificador de hardware escribe en este dispositivo).
    pub fn manager(&self) -> &IMFDXGIDeviceManager {
        &self.manager
    }

    /// Copia `source[subresource]` a la siguiente textura compartida y la entrega como `Nv12Frame`.
    pub fn publish(&mut self, gpu: &GpuContext, source: &ID3D11Texture2D, subresource: u32, width: u32, height: u32) -> AppResult<Nv12Frame> {
        if self.ring_size != (width, height) || self.ring.is_empty() {
            self.ring = (0..RING_SIZE).map(|_| self.create_slot(gpu, width, height)).collect::<AppResult<Vec<_>>>()?;
            self.ring_size = (width, height);
            self.next = 0;
        }
        let slot = &self.ring[self.next];
        self.next = (self.next + 1) % RING_SIZE;

        // SAFETY: ambos recursos son NV12 del mismo tamaño y viven en el mismo dispositivo D3D11.
        unsafe {
            self.context.CopySubresourceRegion(&slot.texture, 0, 0, 0, 0, source, subresource, None);
            self.context.End(&self.query);
            self.context.Flush();
            // espera de evento: la copia terminó antes de que el render la lea
            let mut done = BOOL(0);
            while self.context.GetData(&self.query, Some(&mut done as *mut BOOL as *mut _), std::mem::size_of::<BOOL>() as u32, 0).is_err() || !done.as_bool() {
                std::thread::yield_now();
            }
        }

        Ok(Nv12Frame::from_views(slot.wgpu_texture.clone(), slot.wgpu_texture.clone(), slot.y_view.clone(), slot.uv_view.clone(), width, height, guess_matrix(height), false, None))
    }

    fn create_slot(&self, gpu: &GpuContext, width: u32, height: u32) -> AppResult<Slot> {
        let description = D3D11_TEXTURE2D_DESC {
            Width: width,
            Height: height,
            MipLevels: 1,
            ArraySize: 1,
            Format: DXGI_FORMAT_NV12,
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: D3D11_BIND_SHADER_RESOURCE.0 as u32,
            CPUAccessFlags: 0,
            MiscFlags: (D3D11_RESOURCE_MISC_SHARED.0 | D3D11_RESOURCE_MISC_SHARED_NTHANDLE.0) as u32,
        };

        // SAFETY: llamadas COM con objetos propios; el handle compartido se cierra apenas D3D12 lo abre.
        unsafe {
            let mut texture: Option<ID3D11Texture2D> = None;
            self.device.CreateTexture2D(&description, None, Some(&mut texture)).map_err(|e| err("CreateTexture2D (NV12 compartida)", e))?;
            let texture = texture.ok_or_else(|| AppError::new("CreateTexture2D no devolvió una textura"))?;

            let resource: IDXGIResource1 = texture.cast().map_err(|e| err("IDXGIResource1", e))?;
            let handle: HANDLE = resource.CreateSharedHandle(None, DXGI_SHARED_RESOURCE_READ.0, None).map_err(|e| err("CreateSharedHandle", e))?;

            let hal = gpu.device.as_hal::<wgpu::hal::api::Dx12>().ok_or_else(|| AppError::new("El Device de wgpu no es DX12"))?;
            let mut opened: Option<ID3D12Resource> = None;
            let result = hal.raw_device().OpenSharedHandle(handle, &mut opened);
            let _ = CloseHandle(handle);
            result.map_err(|e| err("ID3D12Device::OpenSharedHandle", e))?;
            let resource12 = opened.ok_or_else(|| AppError::new("OpenSharedHandle no devolvió un recurso"))?;

            let size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };
            let hal_texture = wgpu::hal::dx12::Device::texture_from_raw(resource12, wgpu::TextureFormat::NV12, wgpu::TextureDimension::D2, size, 1, 1);
            let wgpu_texture = gpu.device.create_texture_from_hal::<wgpu::hal::api::Dx12>(
                hal_texture,
                &wgpu::TextureDescriptor {
                    label: Some("NV12 compartida (D3D11 → D3D12)"),
                    size,
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: wgpu::TextureDimension::D2,
                    format: wgpu::TextureFormat::NV12,
                    usage: wgpu::TextureUsages::TEXTURE_BINDING,
                    view_formats: &[],
                },
                wgpu::TextureUses::RESOURCE,
            );

            let plane = |aspect, format| wgpu_texture.create_view(&wgpu::TextureViewDescriptor { aspect, format: Some(format), ..Default::default() });
            let y_view = plane(wgpu::TextureAspect::Plane0, wgpu::TextureFormat::R8Unorm);
            let uv_view = plane(wgpu::TextureAspect::Plane1, wgpu::TextureFormat::Rg8Unorm);
            Ok(Slot { texture, wgpu_texture, y_view, uv_view })
        }
    }
}
