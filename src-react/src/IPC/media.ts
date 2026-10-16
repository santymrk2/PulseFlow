// ----- FreeShow -----
// Puente de medios hacia los comandos de Rust (`commands::media` y
// `commands::files`).
//
// A diferencia del bus `send`/`receive` de `@/IPC/tauri`, aquí usamos `invoke`
// directamente porque las miniaturas son peticiones/respuestas concurrentes
// (varias en vuelo a la vez): el bus enruta por canal y no permitiría distinguir
// cada `GET_THUMBNAIL`. `convertFileSrc` convierte la ruta de la miniatura en una
// URL `asset://` servida por el protocolo de assets de Tauri (habilitado en
// `tauri.conf.json` con scope `$APPCONFIG/media-cache`).

import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import type { FileFolder, ThumbnailResult } from "@/types/Media"

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

/** `GET_MEDIA_FOLDER_PATH`: carpeta de medios (`config.mediaFolderPath` o por defecto). */
export async function getMediaFolderPath(): Promise<string> {
    if (!isTauri) return ""
    return invoke<string>("GET_MEDIA_FOLDER_PATH")
}

/**
 * `READ_FOLDER`: recorre una carpeta y devuelve un mapa `ruta -> FileFolder`.
 * `depth` alto = recursión completa (por defecto 0 sólo lista el primer nivel).
 */
export async function readFolder(
    path: string,
    depth = 20
): Promise<Record<string, FileFolder>> {
    if (!isTauri) return {}
    return invoke<Record<string, FileFolder>>("READ_FOLDER", { data: { path, depth } })
}

/** `GET_THUMBNAIL`: genera (o recupera de caché) la miniatura de una imagen o vídeo. */
export async function getThumbnail(input: string, size = 250): Promise<ThumbnailResult> {
    if (!isTauri) return { input, size, output: "" }
    return invoke<ThumbnailResult>("GET_THUMBNAIL", { data: { input, size } })
}

/** Convierte una ruta del sistema en una URL que el webview puede mostrar. */
export function mediaSrc(path: string): string {
    if (!path) return ""
    return convertFileSrc(path)
}
