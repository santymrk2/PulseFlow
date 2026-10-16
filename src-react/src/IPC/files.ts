// ----- FreeShow -----
// Comandos del dominio FILES (sistema de archivos y diálogos nativos).
//
// Igual que `@/IPC/media`, se usa `invoke` directamente: son peticiones/respuesta
// puntuales que no necesitan el enrutado por canal del bus `send`/`receive`.

import { invoke } from "@tauri-apps/api/core"

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

/** `SYSTEM_OPEN`: revela una ruta en el explorador del sistema. */
export async function systemOpen(path: string): Promise<void> {
    if (!isTauri || !path) return
    await invoke("SYSTEM_OPEN", { data: path })
}

/** `OPEN_FOLDER_PATH`: abre una carpeta en el explorador del sistema. */
export async function openFolderPath(path: string): Promise<void> {
    if (!isTauri || !path) return
    await invoke("OPEN_FOLDER_PATH", { data: path })
}

/** `OPEN_APPDATA`: abre la carpeta de configuración/datos de la app. */
export async function openAppData(): Promise<void> {
    if (!isTauri) return
    await invoke("OPEN_APPDATA")
}

/** `OPEN_CACHE`: abre la carpeta de caché de miniaturas. */
export async function openCache(): Promise<void> {
    if (!isTauri) return
    await invoke("OPEN_CACHE")
}

export interface OpenFolderData {
    channel?: string
    title?: string
    path?: string
}

/** `OPEN_FOLDER`: abre el diálogo nativo de selección de carpeta. */
export async function openFolderDialog(data: OpenFolderData): Promise<string | null> {
    if (!isTauri) return null
    return invoke<string | null>("OPEN_FOLDER", { data: { channel: "dialog", ...data } })
}

/** `DATA_PATH`: ruta raíz de datos (`<Documents>/FreeShow` o `config.dataPath`). */
export async function getDataPath(): Promise<string> {
    if (!isTauri) return ""
    return invoke<string>("DATA_PATH")
}

/** `SET_MEDIA_FOLDER_PATH`: guarda `config.mediaFolderPath`. */
export async function setMediaFolderPath(path: string): Promise<void> {
    if (!isTauri) return
    await invoke("SET_MEDIA_FOLDER_PATH", { data: path })
}

/** `GET_MEDIA_FOLDER_PATH`: carpeta de medios activa. */
export async function getMediaFolderPath(): Promise<string> {
    if (!isTauri) return ""
    return invoke<string>("GET_MEDIA_FOLDER_PATH")
}

/** `UPDATE_DATA_PATH`: cambia la carpeta raíz de datos. */
export async function updateDataPath(newPath: string, oldPath: string): Promise<void> {
    if (!isTauri) return
    await invoke("UPDATE_DATA_PATH", { data: { newPath, oldPath } })
}

export interface BibleFile {
    path: string
    name: string
}

/** `READ_BIBLES_FOLDER`: lista los archivos `.fsb` de la carpeta de Biblias. */
export async function readBiblesFolder(): Promise<BibleFile[]> {
    if (!isTauri) return []
    return invoke<BibleFile[]>("READ_BIBLES_FOLDER")
}
