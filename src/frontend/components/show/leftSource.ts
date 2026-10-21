// Lógica pura de la columna izquierda (LIBRARIES · PLAYLISTS · ÍTEMS).
// Sin stores ni IPC: los componentes la usan y los tests la cubren.

import type { ProjectShowRef } from "../../../types/Projects"

/** Fuente activa de ÍTEMS: una library (lista de shows) o una playlist (sus ítems). */
export type LeftSource = { type: "library" | "playlist"; id: string }

type Existing = { playlists: readonly string[]; libraries: readonly string[] }

/** Id de la library por defecto (ver `default_synced_settings` en Rust). */
export const DEFAULT_LIBRARY_ID = "general"

export function isSourceValid(source: LeftSource | null, existing: Existing): boolean {
    if (!source) return false
    const list = source.type === "playlist" ? existing.playlists : existing.libraries
    return list.includes(source.id)
}

/** Última fuente usada → primera playlist → library "General" (o la primera) → nada. */
export function resolveInitialSource(input: { last: LeftSource | null } & Existing): LeftSource | null {
    if (isSourceValid(input.last, input)) return input.last
    if (input.playlists.length) return { type: "playlist", id: input.playlists[0] }
    const library = input.libraries.includes(DEFAULT_LIBRARY_ID) ? DEFAULT_LIBRARY_ID : input.libraries[0]
    return library ? { type: "library", id: library } : null
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/** Filtra por nombre ignorando mayúsculas y acentos. Consulta vacía = todo. */
export function filterShows<T extends { name?: string }>(shows: readonly T[], query: string): T[] {
    const needle = normalize(query)
    if (!needle) return [...shows]
    return shows.filter((show) => normalize(show.name || "").includes(needle))
}

/** Marca o desmarca `id` conservando el orden en que se marcó. */
export function toggleId(selected: readonly string[], id: string): string[] {
    return selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]
}

/** Shows agregados al final de una playlist (se permiten repetidos, como al arrastrar). */
export function appendShowRefs(current: readonly ProjectShowRef[], ids: readonly string[]): ProjectShowRef[] {
    return [...current, ...ids.map((id): ProjectShowRef => ({ id, type: "show" }))]
}

/** Id de la biblioteca virtual de los shows sin categoría (o con una que ya no existe). */
export const UNLABELED_LIBRARY_ID = "unlabeled"

/** Shows visibles de una biblioteca: sin privados y respetando el acceso del perfil. */
export function showsOfLibrary<T extends { category?: string | null; private?: boolean }>(shows: readonly T[], libraryId: string, categories: Record<string, unknown>, profile: Record<string, string | undefined>): T[] {
    return shows.filter((show) => {
        if (!show || show.private) return false
        if (profile[show.category || ""] === "none") return false
        if (libraryId === UNLABELED_LIBRARY_ID) return !show.category || !categories[show.category]
        return show.category === libraryId
    })
}
