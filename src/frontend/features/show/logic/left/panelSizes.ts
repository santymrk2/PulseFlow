// Reparto de alto de la columna izquierda: porcentajes de LIBRARIES y PLAYLISTS;
// ÍTEMS ocupa el resto. Sin DOM, para poder testear los límites del arrastre.

export type PanelSizes = { libraries: number; playlists: number }

export const MIN_PANEL = 10
export const MIN_ITEMS = 25
export const DEFAULT_SIZES: PanelSizes = { libraries: 18, playlists: 22 }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** Mueve un divisor `deltaPct` puntos (positivo = hacia abajo) respetando los mínimos. */
export function dragSplitter(sizes: PanelSizes, handle: "libraries" | "playlists", deltaPct: number): PanelSizes {
    if (handle === "libraries") {
        // el divisor de arriba reparte entre LIBRARIES y PLAYLISTS; ÍTEMS no cambia
        const total = sizes.libraries + sizes.playlists
        return { libraries: clamp(sizes.libraries + deltaPct, MIN_PANEL, total - MIN_PANEL), playlists: total - clamp(sizes.libraries + deltaPct, MIN_PANEL, total - MIN_PANEL) }
    }

    return { ...sizes, playlists: clamp(sizes.playlists + deltaPct, MIN_PANEL, 100 - MIN_ITEMS - sizes.libraries) }
}
