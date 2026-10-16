// ----- FreeShow -----
// Tipos recortados de la biblioteca de shows (equivalentes a `TrimmedShow`/
// `TrimmedShows` de `src/types/Show.ts`). El comando Rust `SHOWS` devuelve este
// mapa (id → información de biblioteca).

export interface TrimmedShows {
    [key: string]: TrimmedShow
}

export interface TrimmedShow {
    name: string
    origin?: string
    category: null | string
    timestamps: {
        created: number
        modified: null | number
        used: null | number
    }
    quickAccess?: any
    private?: boolean
    locked?: boolean
}

export interface ShowList extends TrimmedShow {
    id: string
}

// ---------------------------------------------------------------------------
// Show completo (slides, layouts, items) — usado por el editor.
// Equivalente a los tipos de `src/types/Show.ts` de la app Svelte.
// ---------------------------------------------------------------------------

export interface Resolution {
    width: number
    height: number
}

export interface TextSegment {
    value: string
    style?: string
    [key: string]: any
}

/** Acorde dentro de una línea (estilo ChordPro) con su posición de letra. */
export interface Chord {
    id: string
    /** Índice de carácter (en el texto limpio) donde colocar el acorde. */
    pos: number
    key: string
}

export interface Line {
    align?: string
    text: TextSegment[]
    /** Acordes posicionados sobre la letra (vacío si la línea no tiene). */
    chords?: Chord[]
    [key: string]: any
}

export interface Item {
    /** Ausente = texto. Otros: "media", "timer", "clock", ... (Bloque 8). */
    type?: string
    /** Cadena CSS absoluta (`top:...;left:...`) o mapa de estilos. */
    style?: string | Record<string, string>
    align?: string
    lines?: Line[]
    [key: string]: any
}

export interface Slide {
    color?: string | null
    group?: string
    /** Id de grupo global (verse/chorus/…); ausente si es un grupo propio. */
    globalGroup?: string
    notes?: string
    items: Item[]
    settings?: SlideSettings
    [key: string]: any
}

/** Entrada de un layout: una diapositiva suelta o un grupo (con hijos). */
export interface SlideGroup {
    id: string
    children?: SlideGroup[]
    /** Datos del layout (transición, fondo) — sólo presentes si se han definido. */
    data?: SlideData
    [key: string]: any
}

export interface Layout {
    name: string
    notes?: string
    slides: SlideGroup[]
    [key: string]: any
}

export interface ShowSettings {
    activeLayout?: string
    template?: string
    resolution?: Resolution
    [key: string]: any
}

// ---------------------------------------------------------------------------
// Diapositiva: settings y transiciones
// ---------------------------------------------------------------------------

/** Ajustes propios de una diapositiva (color/imagen de fondo, plantilla…). */
export interface SlideSettings {
    template?: string
    background?: boolean
    /** Color o degradado CSS de fondo (p. ej. `linear-gradient(...)`). */
    color?: string
    /** Ruta/ruta-id de la imagen de fondo. */
    backgroundImage?: string
    resolution?: Resolution
    [key: string]: any
}

export type TransitionType = "none" | "blur" | "fade" | "crossfade" | "fly" | "scale" | "slide" | "spin"

export interface Transition {
    type: TransitionType
    duration: number
    easing: string
    fadeInOffset?: number
    delay?: number
    custom?: any
}

/** Datos del grupo de layout asociado a una diapositiva (transición, fondo…). */
export interface SlideData {
    transition?: Transition
    mediaTransition?: Transition
    background?: string
    color?: null | string
    [key: string]: any
}

export interface Show {
    id: string
    name: string
    category: string | null
    settings: ShowSettings
    slides: Record<string, Slide>
    layouts: Record<string, Layout>
    media?: Record<string, any>
    timestamps?: TrimmedShow["timestamps"]
    [key: string]: any
}
