// ----- FreeShow -----
// Parser de acordes estilo ChordPro para la vista de músicos.
//
// Porta la parte de lectura de `src/frontend/converters/chordpro.ts`:
//   • `[Am]` sobre la letra → acordes posicionados por índice de letra.
//   • Secciones por directivas (`{soc}`, `{start_of_chorus}`, `{c:…}`) o líneas
//     `Coro:` / `Verso:` / `Puente:`, con su grupo y posibles repeticiones (`x2`).
//   • Metadatos (`{title: …}`, `Título: …`) y notas de comentario (`# …`).

import type { Chord } from "@/types/Show"

const META_KEYS = [
    "number",
    "title",
    "artist",
    "composer",
    "lyricist",
    "copyright",
    "year",
    "notes",
    "ccli",
    "t",
    "su",
    "k",
    "key",
    "f",
]

const CHORUS_KEYS = ["start_of_chorus", "soc"]

let chordCounter = 0
function chordId(): string {
    chordCounter += 1
    return `ch-${Date.now().toString(36)}-${chordCounter.toString(36)}`
}

export interface ChordLine {
    text: string
    chords: Chord[]
}

export interface ChordSection {
    /** Etiqueta de sección tal cual aparece (p. ej. "Coro" o "chorus"). */
    group: string
    /** Número de repeticiones detectado (`x2` / `2x`); 1 por defecto. */
    repeat: number
    lines: ChordLine[]
}

export interface ParsedChordPro {
    name: string | null
    metadata: Record<string, string>
    notes: string
    sections: ChordSection[]
}

/** Extrae los acordes `[..]` de una línea de letra. */
export function parseChordLine(line: string): ChordLine {
    const clean = line.replaceAll("[/]", " ").replaceAll("[|]", "")
    const isDirectiveLine = clean.trim().startsWith("{") && clean.includes(":")

    let text = ""
    const chords: Chord[] = []
    let isChord = false
    let letterIndex = 0

    for (const char of clean) {
        if ((char === "[" || char === "]") && !isDirectiveLine) {
            isChord = char === "["
            if (isChord) chords.push({ id: chordId(), pos: letterIndex, key: "" })
            continue
        }
        if (isChord) {
            chords[chords.length - 1].key += char
            continue
        }
        text += char
        letterIndex += 1
    }

    return { text, chords }
}

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const NOTE_INDEX: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
}

/** Transpone un acorde (p. ej. `Am7/G`) N semitonos, conservando el bajo. */
export function transposeChord(chord: string, semitones: number): string {
    if (!chord || !semitones) return chord

    const shift = (note: string): string => {
        const index = NOTE_INDEX[note]
        if (index === undefined) return note
        const next = (((index + semitones) % 12) + 12) % 12
        return (note.includes("b") ? FLAT : SHARP)[next]
    }

    return chord
        .split("/")
        .map((part) => part.replace(/^[A-G](#|b)?/, (note) => shift(note)))
        .join("/")
}

/** ¿La línea parece una línea de acordes sin letra (p. ej. "Am  G  F")? */
export function isChordLine(line: string): boolean {
    const trimmed = line.trim()
    if (!trimmed || trimmed.includes("[")) return false
    return /^([A-G][#b]?(m|maj|min|dim|aug|sus|add|\d)*\s*)+$/.test(trimmed)
}

function detectGroupFromLine(line: string): string | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    const sectionStart = trimmed.includes("start_of_") || trimmed.includes("{c:")
    const labelLine = trimmed.endsWith(":") && !trimmed.startsWith("{")

    if (!sectionStart && !labelLine) {
        if (CHORUS_KEYS.some((key) => line.includes(key))) return "chorus"
        return null
    }

    let group = trimmed.replace(/\d+/g, "").replace(/\(x\)/g, "").trim()
    if (sectionStart) {
        const start = line.includes("{c:") ? group.indexOf(":") : group.lastIndexOf("_")
        const end = group.includes("}") ? group.indexOf("}") : group.length
        group = group.slice(start + 1, end)
    } else {
        group = group.slice(0, -1).trim()
    }
    return group.replace(/\{|\}/g, "").trim() || null
}

function detectRepeat(line: string): number {
    const match = line.trim().match(/(?:x(\d+)|(\d+)x)/)
    if (!match) return 1
    const count = Number(match[1] || match[2])
    return Number.isNaN(count) ? 1 : count
}

/**
 * Convierte el contenido de un archivo ChordPro en secciones estructuradas.
 * Función pura (sin efectos) pensada para importación o para la vista de músicos.
 */
export function parseChordPro(content: string, fallbackName = ""): ParsedChordPro {
    const metadata: Record<string, string> = {}
    let notes = ""
    let name = fallbackName || null

    const sections: ChordSection[] = []
    let current: ChordSection = { group: "", repeat: 1, lines: [] }
    let newSection = false

    for (const rawLine of content.split("\n")) {
        let line = rawLine

        if (line.includes("end_of_")) {
            newSection = true
            continue
        }

        const group = detectGroupFromLine(line)
        if (group) {
            const isExplicitLabel = line.trim().endsWith(":") || line.includes("start_of_") || line.includes("{c:")
            if (newSection || isExplicitLabel) {
                newSection = false
                if (current.lines.length) {
                    sections.push(current)
                }
                current = { group, repeat: detectRepeat(line), lines: [] }
                continue
            }
        }

        line = line.replace("{soc}", "").replace("{eoc}", "")

        // Comentario → notas.
        if (line[0] === "#") {
            notes += line.slice(2) + "\n"
            continue
        }

        // Directivas / metadatos.
        if (line.includes(":")) {
            const trimmed = line.trim()
            const directive = trimmed.match(/^\{([a-z_]+)\s*:\s*(.*)\}$/i)
            const loose = trimmed.match(/^([a-z_]+)\s*:\s*(.*)$/i)
            const key = (directive?.[1] || loose?.[1] || "").toLowerCase()
            const value = (directive?.[2] || loose?.[2] || "").trim()
            if (key && META_KEYS.includes(key)) {
                let mapped = key
                if (key === "t") mapped = "title"
                if (key === "lyricist") mapped = "author"
                if (key === "su") mapped = "publisher"
                if (key === "ccli") mapped = "CCLI"
                if (key === "f") mapped = "copyright"
                if (key === "k") mapped = "key"
                if (mapped === "notes") notes = value
                else metadata[mapped] = value
                if (mapped === "title") name = value
                continue
            }
        }

        // Línea en blanco → separador de sección.
        if (!line.trim()) {
            if (current.lines.length) {
                sections.push(current)
                current = { group: "", repeat: 1, lines: [] }
                newSection = true
            }
            continue
        }

        current.lines.push(parseChordLine(line))
        newSection = false
    }

    if (current.lines.length) sections.push(current)

    return { name, metadata, notes: notes.trim(), sections }
}

/** Transpone todos los acordes de una línea. */
export function transposeLine(line: ChordLine, semitones: number): ChordLine {
    if (!semitones) return line
    return { ...line, chords: line.chords.map((chord) => ({ ...chord, key: transposeChord(chord.key, semitones) })) }
}

export interface ChordSegment {
    text: string
    chord?: string
}

/**
 * Divide una línea en segmentos de letra con su acorde, para renderizar el
 * acorde sobre la sílaba correcta. `semitones` transpone los acordes.
 */
export function buildSegments(line: ChordLine, semitones = 0): ChordSegment[] {
    const chords = [...line.chords].sort((a, b) => a.pos - b.pos)
    const boundaries = [...new Set([...chords.map((chord) => chord.pos), line.text.length])].sort((a, b) => a - b)

    const segments: ChordSegment[] = []
    let prev = 0
    for (const boundary of boundaries) {
        if (boundary < prev) continue
        const found = chords.find((chord) => chord.pos === prev)
        segments.push({
            text: line.text.slice(prev, boundary),
            chord: found && semitones ? transposeChord(found.key, semitones) : found?.key,
        })
        prev = boundary
    }
    return segments
}
