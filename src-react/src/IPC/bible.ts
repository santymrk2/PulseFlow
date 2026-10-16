// ----- FreeShow -----
// Comandos del dominio SHOWS relacionado con Biblias (`READ_BIBLES_FOLDER` ya en
// `@/IPC/files`). `BIBLE` carga un `.fsb` y devuelve `{ id, content: [id, bible] }`.

import { invoke } from "@tauri-apps/api/core"
import type { Bible } from "@/types/Bible"

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

interface BibleResponse {
    id?: string
    error?: string
    content?: [string, Bible] | Bible
}

/** `BIBLE`: carga una biblia `.fsb` por id/nombre y normaliza el contenido. */
export async function loadBible(id: string, name?: string): Promise<Bible | null> {
    if (!isTauri) return null
    const response = await invoke<BibleResponse>("BIBLE", { data: { id, name } })
    if (!response || response.error) return null

    let content = response.content
    if (Array.isArray(content)) content = content[1]
    if (!content || typeof content !== "object") return null

    return { ...(content as Bible), id: response.id ?? id }
}
