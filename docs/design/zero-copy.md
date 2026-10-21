# Video zero-copy nativo (F18)

Estado al 2026-10-20. Resultado del spike F18.1 y decisiones para F18.2–F18.6.

## Qué significa "zero-copy" acá

Los píxeles decodificados **no pasan por la CPU**: el decodificador del sistema los deja en memoria de GPU
(IOSurface en macOS, textura D3D11 en Windows) y la textura que dibuja wgpu apunta a esa misma memoria.
Se evitan el volcado a RGBA, el pipe de ffmpeg y `write_texture`.

## macOS — verificado

Camino: `CVPixelBuffer` NV12 (IOSurface, `420v`/`420f`) → `CVMetalTextureCache` → dos `MTLTexture` (Y: `R8Unorm`,
CbCr: `RG8Unorm`) → `wgpu::hal::metal::Device::texture_from_raw` → `Device::create_texture_from_hal`.

- Implementado en `src-tauri/src/render/video/metal_import.rs` (`MetalTextureCache`, `import_pixel_buffer`).
- Prueba (`imported_nv12_planes_see_the_pixels_written_by_the_cpu`): se crea un `CVPixelBuffer` NV12 real, se
  escribe Y=63, CbCr=(102, 240) desde la CPU, se importa y se lee de vuelta desde la **textura de wgpu**: coincide.
  Eso prueba que la textura y el buffer comparten memoria.
- Las versiones de `objc2-*` tienen que ser las de `wgpu-hal` 30 (`objc2` 0.6, `objc2-metal` 0.3); si no, los
  tipos de `MTLTexture` no coinciden.
- El `CVMetalTexture` y el `CVPixelBuffer` se retienen en el callback de destrucción de la textura (el `Nv12Frame`
  guarda además el buffer): el decodificador puede reciclar el buffer sólo cuando la GPU terminó.
- `CVMetalTextureCache` se declara `Send` (no `Sync`): quien la comparte la guarda en un `Mutex`.
- Límites: sólo NV12 de 8 bits. 10 bits (P010/HDR), 4:2:2 y 4:4:4 se rechazan y caen al camino ffmpeg. La matriz
  de color se elige por alto (≥720 → BT.709, si no BT.601); falta leer los adjuntos de color del buffer.

## Windows — implementado y compilado, sin ejecutar

Se implementó (`video/mf.rs`, `video/d3d_import.rs`) y se compila contra `x86_64-pc-windows-msvc` con
`scripts/check-windows-video.sh`, pero no se pudo ejecutar desde la Mac de desarrollo. Camino:

1. **Decodificar** con Media Foundation: `IMFSourceReader` con un `IMFDXGIDeviceManager` sobre un `ID3D11Device`
   creado con `D3D11_CREATE_DEVICE_VIDEO_SUPPORT`, `MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS` y salida NV12.
   Cada muestra trae un `IMFDXGIBuffer` → `ID3D11Texture2D` (suele ser un *array* del pool del decodificador) + índice.
2. **Copiar a una textura compartida** NV12 (`D3D11_RESOURCE_MISC_SHARED | SHARED_NTHANDLE`) con
   `CopySubresourceRegion`: es una copia GPU→GPU; los píxeles siguen sin pasar por la CPU. No se comparte la textura
   del decodificador porque su pool no se puede crear compartido.
3. **Sincronizar**: `Flush()` + `ID3D11Query` (evento) esperado en el hilo del decodificador antes de publicar el
   frame. Es una espera de fence, no una copia. Alternativa futura: fence compartido (`ID3D11Fence`).
4. **Importar a wgpu (DX12)**: `ID3D12Device::OpenSharedHandle` → `ID3D12Resource` →
   `wgpu::hal::dx12::Device::texture_from_raw` + `create_texture_from_hal`, con `Features::TEXTURE_FORMAT_NV12` y
   vistas por plano (`TextureAspect::Plane0` como `R8Unorm`, `Plane1` como `Rg8Unorm`).
5. El backend de wgpu en Windows está fijado a **DX12** (`GpuContext`): el interop D3D11→D3D12 lo exige.

Riesgos (sin comprobar): el anillo de 3 texturas no protege de un render atascado más de 2 frames; el `Flush` +
evento bloquea el hilo del decodificador hasta que termina la copia; que `TEXTURE_FORMAT_NV12` falte en algún adaptador (→ fallback a ffmpeg), vistas de plano en wgpu 30 y
GPUs con varios adaptadores (el decodificador y wgpu tienen que usar el mismo). Verificación pendiente en F13.4.

## Contenedores

| Backend | Contenedores |
| --- | --- |
| Nativo (AVFoundation / Media Foundation) | `.mp4`, `.mov`, `.m4v` |
| ffmpeg (NV12 por pipe) | `.webm`, `.mkv`, `.avi` y cualquier fallo del nativo |

## Qué no se pudo verificar

- Nada de Windows (ver arriba).
- El rendimiento 4K sostenido: se mide en F18.5 (macOS) y queda para F13.4 en Windows.
