// ----- FreeShow -----
// Clasificación de archivos multimedia. Las extensiones se alinean con las que
// `src-tauri/src/commands/media.rs` sabe convertir en miniatura.

const IMAGE_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "jfif", "avif", "heic", "heif",
])

const VIDEO_EXTENSIONS = new Set([
    "mp4", "m4v", "webm", "ogv", "mov", "avi", "mkv", "flv", "mpeg", "mpg", "wmv", "3gp", "3g2",
])

/** Extensión en minúsculas (soporta separadores `/` y `\\`). */
export function getExtension(path: string): string {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
    const dot = path.lastIndexOf(".")
    return dot > slash ? path.slice(dot + 1).toLowerCase() : ""
}

export function isImageFile(path: string): boolean {
    return IMAGE_EXTENSIONS.has(getExtension(path))
}

export function isVideoFile(path: string): boolean {
    return VIDEO_EXTENSIONS.has(getExtension(path))
}

export function isMediaFile(path: string): boolean {
    return isImageFile(path) || isVideoFile(path)
}
