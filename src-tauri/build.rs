//! Build script de PulseFlow.
//!
//! En Windows/MSVC el manifiesto de la aplicación (Common-Controls v6) lo incrusta
//! el linker para **todos** los objetivos, no sólo para el binario. `tauri-build`
//! lo metía en el `.res`, que `embed-resource` enlaza únicamente con
//! `cargo:rustc-link-arg-bins`; el binario que arma `cargo test --lib` quedaba sin
//! manifiesto, el loader ataba comctl32 a la v5.82 y el proceso moría con
//! STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) al resolver `TaskDialogIndirect`,
//! que sólo exporta la v6.

use std::env;
use std::path::PathBuf;

fn main() {
    let windows_msvc = env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");

    let attributes = if windows_msvc {
        // Sin `new_without_app_manifest` habría dos RT_MANIFEST por binario (el del
        // .res y el del linker) y el enlace falla con LNK1123. Icono y versión
        // siguen saliendo por el .res: sólo cambia de dónde sale el manifiesto.
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        tauri_build::Attributes::new()
    };

    if let Err(err) = tauri_build::try_build(attributes) {
        panic!("tauri-build no pudo generar los recursos de Windows: {err}");
    }

    if windows_msvc {
        // cwd de un build script = raíz del paquete, así que el fallback "." también
        // encontraría el archivo.
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into());
        let manifest = PathBuf::from(manifest_dir).join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT={}", manifest.display());
    }
}
