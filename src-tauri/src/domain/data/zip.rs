//! Compresión y descompresión ZIP (`src/electron/data/zip.ts`).
//!
//! Se usa el crate `zip`. Las entradas pueden ser archivos en disco o contenido
//! en memoria (para las tiendas portables, que se serializan directamente).

use crate::error::{AppError, AppResult};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;

/// Origen del contenido de una entrada del ZIP.
pub enum EntrySource {
    File(PathBuf),
    Content(String),
}

/// Entrada del ZIP: nombre interno + origen.
pub struct ZipEntry {
    pub name: String,
    pub source: EntrySource,
}

fn zip_err<E: std::fmt::Display>(err: E) -> AppError {
    AppError::new(format!("ZIP error: {err}"))
}

/// Comprime las entradas en `zip_path`.
pub fn compress_to_zip(entries: &[ZipEntry], zip_path: &Path) -> AppResult<()> {
    let file = File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for entry in entries {
        zip.start_file(entry.name.clone(), options)
            .map_err(zip_err)?;
        match &entry.source {
            EntrySource::File(path) => {
                let mut src = File::open(path)?;
                std::io::copy(&mut src, &mut zip)?;
            }
            EntrySource::Content(content) => {
                zip.write_all(content.as_bytes())?;
            }
        }
    }

    zip.finish().map_err(zip_err)?;
    Ok(())
}

/// Descomprime `zip_path` y devuelve `(nombre, contenido)` de cada entrada.
pub fn decompress_zip(zip_path: &Path) -> AppResult<Vec<(String, String)>> {
    let file = File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(zip_err)?;
    let mut out = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(zip_err)?;
        let name = entry.name().to_string();
        let mut content = String::new();
        if entry.read_to_string(&mut content).is_err() {
            continue;
        }
        out.push((name, content));
    }

    Ok(out)
}
