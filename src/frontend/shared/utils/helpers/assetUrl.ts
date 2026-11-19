import { convertFileSrc } from "@tauri-apps/api/core"

// El webview no deja cargar `file://` desde el origen de la app: las miniaturas y los medios locales se sirven por el protocolo
// `asset` de Tauri (scope en `tauri.conf.json`). `convert` es inyectable para los tests; en el navegador sin Tauri es `null`.
const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export function toDisplayUrl(path: string, convert: ((path: string) => string) | null = inTauri ? convertFileSrc : null): string | null {
    if (!convert) return null

    let clean = path.startsWith("file://") ? path.slice("file://".length) : path
    try {
        if (/%[0-9a-fA-F]{2}/.test(clean)) clean = decodeURIComponent(clean)
    } catch {
        // codificación inválida: se deja la ruta como vino
    }

    return convert(clean)
}
