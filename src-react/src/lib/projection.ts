// ----- FreeShow -----
// Conversión del modelo de diapositiva (coordenadas 1920×1080, estilos CSS) al
// formato enriquecido que consumen las ventanas de salida.

import { parseStyle } from "@/lib/show"
import type { ProjectionBox, ProjectionRichText, ProjectionTextLine, ProjectionTextStyle } from "@/types/Output"
import type { Slide, TextSegment } from "@/types/Show"

/** Alineación textual de FreeShow (`"text-align: left;"`, `"left"`, …) → alias. */
export function parseAlign(value?: string): "left" | "center" {
    if (value && /left/i.test(value)) return "left"
    return "center"
}

/** Estilo de un segmento de texto → estilo de proyección. */
function segmentStyle(segment?: TextSegment): ProjectionTextStyle | undefined {
    if (!segment?.style) return undefined
    const css = parseStyle(segment.style) as Record<string, unknown>
    const style: ProjectionTextStyle = {}

    if (css.fontSize != null) {
        const size = parseFloat(String(css.fontSize))
        if (!Number.isNaN(size)) style.fontSize = size
    }
    if (css.fontFamily) style.fontFamily = String(css.fontFamily)
    if (css.fontWeight) style.fontWeight = css.fontWeight as string | number
    if (css.fontStyle) style.fontStyle = String(css.fontStyle)
    if (css.color) style.color = String(css.color)
    if (css.textShadow) style.textShadow = String(css.textShadow)

    return Object.keys(style).length ? style : undefined
}

/** ¿El estilo (cadena CSS) define posición/tamaño propios? */
function styleHasPosition(style: string): boolean {
    return /(^|;)\s*(top|left|width|height)\s*:/.test(style)
}

/** Estilo de caja de un item de texto, o `null` si no tiene posición propia. */
function itemBoxStyle(item: Slide["items"][number]): string | null {
    if (item.type && item.type !== "text") return null
    const style = typeof item.style === "string" ? item.style : ""
    return styleHasPosition(style) ? style : null
}

/**
 * Construye un bloque de texto enriquecido a partir de los items de texto de una
 * diapositiva. Cada línea del modelo se convierte en una línea proyectada; el
 * estilo se toma del primer segmento de la línea (simplificación documentada).
 *
 * Si algún item de texto define posición/tamaño propios (`style`), se generan
 * `boxes` con su caja absoluta para que la salida reproduzca la disposición del
 * editor; en caso contrario la salida usa el modo centrado (`lines`).
 */
export function slideToRichText(slide: Slide | undefined): ProjectionRichText | null {
    if (!slide) return null

    const lines: ProjectionTextLine[] = []
    const boxes: ProjectionBox[] = []
    let align: "left" | "center" = "center"
    let hasBoxes = false

    for (const item of slide.items ?? []) {
        if (item.type && item.type !== "text") continue

        const boxStyle = itemBoxStyle(item)
        if (boxStyle) hasBoxes = true
        const boxLines: ProjectionTextLine[] = []

        for (const line of item.lines ?? []) {
            const text = (line.text ?? []).map((segment) => segment.value).join("")
            if (!text) continue
            const style = segmentStyle((line.text ?? [])[0])
            lines.push({ text, style })
            boxLines.push({ text, style })
            align = parseAlign(line.align || item.align)
        }

        if (boxStyle) {
            boxes.push({
                style: boxStyle,
                align: parseAlign(item.align),
                auto: item.auto !== false,
                lines: boxLines,
            })
        }
    }

    if (!lines.length) return null
    return hasBoxes ? { lines, align, boxes } : { lines, align }
}
