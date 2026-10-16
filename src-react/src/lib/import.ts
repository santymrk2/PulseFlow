// ----- FreeShow -----
// Constructores de shows a partir de material importado (ChordPro o texto
// plano). Genera un objeto `Show` listo para persistir con `SAVE`.

import type { ChordLine } from "@/lib/chordpro"
import { DEFAULT_RESOLUTION, makeSlideId } from "@/lib/show"
import type { Layout, Line, Show, Slide, SlideGroup } from "@/types/Show"

function buildShow(name: string, sections: { group: string; lines: ChordLine[] }[], notes = ""): Show {
    const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `show-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    const slides: Record<string, Slide> = {}
    const groups: SlideGroup[] = []

    for (const section of sections) {
        if (!section.lines.length) continue
        const slideId = makeSlideId()
        const lines: Line[] = section.lines.map((line) => ({
            text: [{ value: line.text, style: "" }],
            ...(line.chords.length ? { chords: line.chords } : {}),
        }))
        slides[slideId] = {
            items: [{ lines }],
            ...(section.group ? { group: section.group } : {}),
            ...(notes ? { notes } : {}),
        }
        groups.push({ id: slideId })
    }

    if (!groups.length) {
        const slideId = makeSlideId()
        slides[slideId] = { items: [{ lines: [{ text: [{ value: "", style: "" }] }] }] }
        groups.push({ id: slideId })
    }

    const layout: Layout = { name: "Default", slides: groups }

    return {
        id,
        name,
        category: null,
        settings: { activeLayout: "default", resolution: { ...DEFAULT_RESOLUTION } },
        slides,
        layouts: { default: layout },
    }
}

/** Crea un show a partir de secciones ChordPro ya parseadas. */
export function showFromChordPro(name: string, sections: { group: string; lines: ChordLine[] }[], notes = ""): Show {
    return buildShow(name, sections, notes)
}

/** Crea un show a partir de texto plano (cada bloque separado por línea en blanco). */
export function showFromText(name: string, text: string): Show {
    const blocks = text
        .split(/\n\s*\n/)
        .map((block) => block.replace(/\r/g, "").trim())
        .filter(Boolean)

    const sections = blocks.map((block) => ({
        group: "",
        lines: block.split("\n").map((line) => ({ text: line, chords: [] })),
    }))

    return buildShow(name, sections)
}
