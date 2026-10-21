#!/usr/bin/env bash
# Type-checkea el video nativo de Windows (F18.6) desde macOS: arma un crate aislado que enlaza los
# archivos reales de `src-tauri/src/render` y lo compila para x86_64-pc-windows-msvc.
# No ejecuta nada (no hay Windows acá); sólo detecta errores de tipos y de API de `windows`.
#
# Uso: scripts/check-windows-video.sh      (requiere: rustup target add x86_64-pc-windows-msvc)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src-tauri/src"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/src/render/video"
cat > "$WORK/Cargo.toml" <<'TOML'
[package]
name = "wincheck"
version = "0.0.0"
edition = "2024"

[dependencies]
wgpu = "30.0.1"
bytemuck = { version = "1", features = ["derive"] }
pollster = "1.0.1"
image = { version = "0.25", default-features = false, features = ["png"] }
tokio = { version = "1", features = ["rt", "sync", "time", "macros"] }
log = "0.4"
arc-swap = "1.7"
crossbeam-channel = "0.5"

[target.'cfg(windows)'.dependencies]
windows = { version = "0.62", features = [
    "Win32_Foundation", "Win32_Security", "Win32_Graphics_Direct3D", "Win32_Graphics_Direct3D11",
    "Win32_Graphics_Direct3D12", "Win32_Graphics_Dxgi", "Win32_Graphics_Dxgi_Common",
    "Win32_Media_MediaFoundation", "Win32_System_Com", "Win32_System_Com_StructuredStorage", "Win32_System_Variant",
] }
TOML

cat > "$WORK/src/lib.rs" <<'RS'
pub mod error {
    #[derive(Debug, Clone)]
    pub struct AppError { message: String }
    impl AppError { pub fn new(m: impl Into<String>) -> Self { Self { message: m.into() } } }
    impl std::fmt::Display for AppError { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.message) } }
    pub type AppResult<T> = Result<T, AppError>;
}
pub mod render { pub mod sync; pub mod gpu; pub mod media; pub mod video; pub mod workers; }
RS

cat > "$WORK/src/render/video/mod.rs" <<'RS'
use std::time::Duration;
pub mod d3d_import;
pub mod mf;
pub mod nv12;
pub mod pacing;
pub enum FramePixels<'a> {
    Nv12Cpu { width: u32, height: u32, y: &'a [u8], uv: &'a [u8], matrix: nv12::YuvMatrix, full_range: bool },
    Native(nv12::Nv12Frame),
}
pub struct DecodedFrame<'a> { pub pts: Duration, pub pixels: FramePixels<'a> }
pub trait FrameSink: Send + Sync { fn push(&self, frame: DecodedFrame<'_>); }
pub trait VideoDecoder: Send { fn stop(&mut self); }
RS

for f in sync gpu media workers; do ln -s "$SRC/render/$f.rs" "$WORK/src/render/$f.rs"; done
ln -s "$SRC/render/shaders" "$WORK/src/render/shaders"
for f in nv12 d3d_import mf pacing; do ln -s "$SRC/render/video/$f.rs" "$WORK/src/render/video/$f.rs"; done

cd "$WORK"
RUSTFLAGS="-D warnings" cargo check --target x86_64-pc-windows-msvc
echo "OK: el video nativo de Windows compila para x86_64-pc-windows-msvc"
