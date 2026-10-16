// ----- FreeShow -----
// Comandos del dominio SHOWS usados por la biblioteca (borrado).
//
// La lista y la carga de shows usan el bus `send`/`receive` (`MAIN`); este módulo
// expone operaciones puntuales resueltas con `invoke` directo.

import { invoke } from "@tauri-apps/api/core"

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export interface ShowRef {
    id: string
    name?: string
}

/** `DELETE_SHOWS`: elimina una lista de shows del disco. */
export async function deleteShows(shows: ShowRef[]): Promise<string[]> {
    if (!isTauri) return []
    const result = await invoke<{ deleted: string[] }>("DELETE_SHOWS", { data: { shows } })
    return result?.deleted ?? []
}
