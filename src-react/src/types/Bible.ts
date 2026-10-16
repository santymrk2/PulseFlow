// ----- FreeShow -----
// Tipo de una biblia `.fsb`. Espejo de `src/types/Bible.ts` de la app Svelte.

export interface BibleVerse {
    number: number
    /** Campo antiguo (pre v1.3.0); el backend lo migra a `text`. */
    value?: string
    text: string
}

export interface BibleChapter {
    number: number
    verses: BibleVerse[]
}

export interface BibleBook {
    number: number
    name: string
    customName?: string
    abbreviation?: string
    chapters: BibleChapter[]
}

export interface Bible {
    id?: string
    name: string
    metadata?: Record<string, string>
    copyright?: string
    books: BibleBook[]
}
