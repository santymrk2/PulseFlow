// Parseo de estilos CSS de items/líneas de FreeShow a valores que entiende el engine nativo.
// Funciones puras (sin stores) para poder testearlas.

import type { SceneColor } from "../../../types/SceneGraph"
import { getStyles } from "./style"

const NAMED_COLORS: { [key: string]: SceneColor } = {
    black: [0, 0, 0, 1],
    white: [1, 1, 1, 1],
    red: [1, 0, 0, 1],
    green: [0, 128 / 255, 0, 1],
    blue: [0, 0, 1, 1],
    yellow: [1, 1, 0, 1],
    transparent: [0, 0, 0, 0]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Convierte un color CSS (hex, rgb(), rgba(), nombre) a RGBA normalizado */
export function parseCssColor(value: string | undefined | null, fallback: SceneColor = [1, 1, 1, 1]): SceneColor {
    if (typeof value !== "string") return fallback
    const v = value.trim().toLowerCase()
    if (!v) return fallback

    if (v.startsWith("#")) {
        let hex = v.slice(1)
        if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("")
        if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return fallback
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        return [r, g, b, a]
    }

    if (v.startsWith("rgb")) {
        // rgb(r g b / a) | rgb(r, g, b) | rgba(r, g, b, a)
        const parts = v
            .replace(/rgba?\(|\)/g, "")
            .split(/[\s,/]+/)
            .filter(Boolean)
        if (parts.length < 3) return fallback
        const channel = (p: string) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / 255)
        const [r, g, b] = [channel(parts[0]), channel(parts[1]), channel(parts[2])]
        let a = 1
        if (parts[3] !== undefined) a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
        if ([r, g, b, a].some((n) => Number.isNaN(n))) return fallback
        return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)]
    }

    return NAMED_COLORS[v] || fallback
}

export function parseNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null) return fallback
    const n = parseFloat(String(value))
    return Number.isNaN(n) ? fallback : n
}

export type TextAlign = "left" | "center" | "right" | "justify"
export type VerticalAlign = "top" | "center" | "bottom"

/** `text-align: center;` -> "center" */
export function parseTextAlign(lineAlign: string | undefined): TextAlign | null {
    const value = getStyles(lineAlign)["text-align"]
    if (value === "left" || value === "center" || value === "right" || value === "justify") return value
    if (value === "start") return "left"
    if (value === "end") return "right"
    return null
}

/** `align-items: flex-end;` -> "bottom" */
export function parseVerticalAlign(itemAlign: string | undefined): VerticalAlign {
    const value = getStyles(itemAlign)["align-items"] || getStyles(itemAlign)["align-content"]
    if (value === "flex-start" || value === "start") return "top"
    if (value === "flex-end" || value === "end") return "bottom"
    return "center"
}

export function parseFontWeight(value: string | undefined): number | undefined {
    if (!value) return undefined
    if (value === "bold") return 700
    if (value === "normal") return 400
    const n = parseInt(value, 10)
    return Number.isNaN(n) ? undefined : n
}

/** Primera familia de `font-family`, sin comillas */
export function parseFontFamily(value: string | undefined): string | undefined {
    if (!value) return undefined
    const first = value
        .split(",")[0]
        ?.trim()
        .replace(/^["']|["']$/g, "")
    return first || undefined
}

export function parseTextShadow(value: string | undefined): { color: SceneColor; offsetX: number; offsetY: number } | null {
    if (!value || value === "none") return null

    // "2px 2px 10px #000000" | "2px 2px 10px rgb(0 0 0 / 80%)" | "#000 2px 2px"
    const first = value.split(/,(?![^(]*\))/)[0].trim()
    const tokens = first.match(/[^\s(]+\([^)]*\)|\S+/g) || []
    const isLength = (t: string) => /^-?\d*\.?\d+(px)?$/.test(t)
    const lengths = tokens.filter(isLength)
    const colorPart = tokens.filter((t) => !isLength(t)).join(" ")
    const [offsetX, offsetY] = [parseNumber(lengths[0], 0), parseNumber(lengths[1], 0)]
    const color = parseCssColor(colorPart, [0, 0, 0, 1])
    if (color[3] === 0) return null
    return { color, offsetX, offsetY }
}

export function applyTextTransform(text: string, transform: string | undefined): string {
    if (transform === "uppercase") return text.toUpperCase()
    if (transform === "lowercase") return text.toLowerCase()
    if (transform === "capitalize") return text.replace(/(^|\s)(\S)/g, (_m, space, char) => space + char.toUpperCase())
    return text
}

export interface ParsedBox {
    x: number
    y: number
    width: number
    height: number
}

/** Posición y tamaño (px) del `style` de un item */
export function parseItemBox(style: string | undefined, fallback: ParsedBox): ParsedBox {
    const styles = getStyles(style, true)
    return {
        x: parseNumber(styles.left, fallback.x),
        y: parseNumber(styles.top, fallback.y),
        width: parseNumber(styles.width, fallback.width),
        height: parseNumber(styles.height, fallback.height)
    }
}

export interface ParsedTextStyle {
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    color?: SceneColor
    lineHeight?: number
    strokeWidth?: number
    strokeColor?: SceneColor
    shadow?: { color: SceneColor; offsetX: number; offsetY: number } | null
    textTransform?: string
}

/** Propiedades de texto presentes en un `style` CSS (sólo las que aparecen) */
export function parseTextStyle(style: string | undefined): ParsedTextStyle {
    const raw = getStyles(style)
    const parsed: ParsedTextStyle = {}

    const family = parseFontFamily(raw["font-family"])
    if (family) parsed.fontFamily = family
    if (raw["font-size"]) parsed.fontSize = parseNumber(raw["font-size"], 0) || undefined
    const weight = parseFontWeight(raw["font-weight"])
    if (weight !== undefined) parsed.fontWeight = weight
    if (raw["font-style"]) parsed.fontStyle = raw["font-style"] === "italic" || raw["font-style"] === "oblique" ? "italic" : "normal"
    if (raw.color) parsed.color = parseCssColor(raw.color)
    if (raw["line-height"]) parsed.lineHeight = parseNumber(raw["line-height"], 0) || undefined
    if (raw["-webkit-text-stroke-width"]) parsed.strokeWidth = parseNumber(raw["-webkit-text-stroke-width"], 0)
    if (raw["-webkit-text-stroke-color"]) parsed.strokeColor = parseCssColor(raw["-webkit-text-stroke-color"], [0, 0, 0, 1])
    if (raw["text-shadow"]) parsed.shadow = parseTextShadow(raw["text-shadow"])
    if (raw["text-transform"]) parsed.textTransform = raw["text-transform"]

    return parsed
}
