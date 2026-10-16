// ----- FreeShow -----
// Utilidades de estilo y disposición de los "items" (cajas de contenido) de una
// diapositiva. Port reducido de `edit/scripts/itemHelpers.ts` y
// `edit/scripts/textStyle.ts` de la versión Svelte, adaptado al modelo de React.
//
// Un item tiene un estilo CSS absoluto sobre el lienzo 1920×1080 (top/left/
// width/height…) y, si es de texto, una lista de líneas con segmentos estilados.

import { makeSlideId, mergeStyleString, styleToObject } from "@/lib/show"
import type { Item, Slide } from "@/types/Show"

/** Posición/tamaño por defecto de un item de texto nuevo. */
export const DEFAULT_ITEM_STYLE = "top:88px;left:50px;height:904px;width:1820px;"

/** Resoluciones de referencia para conversiones px/% (lienzo estándar). */
const CANVAS = { width: 1920, height: 1080 }

export type ItemAlign = "forward" | "backward" | "to_front" | "to_back"

/** Estilo de un item como mapa de declaraciones CSS (clave kebab-case). */
export function getItemStyleMap(item: Item | undefined): Record<string, string> {
    if (!item?.style) return {}
    if (typeof item.style === "object") return { ...(item.style as Record<string, string>) }
    return styleToObject(item.style)
}

/** Estilo de un item como cadena CSS normalizada (`top:..;left:..;`). */
export function getItemStyleString(item: Item | undefined): string {
    const map = getItemStyleMap(item)
    return Object.entries(map)
        .map(([key, value]) => `${key}:${value};`)
        .join("")
}

/** ¿Es un item de texto? (tipo ausente = texto). */
export function isTextItem(item: Item | undefined): boolean {
    return !item?.type || item.type === "text"
}

/** Fusiona declaraciones CSS en el estilo de un item (inmutable). */
export function setItemStyle(item: Item, declarations: Record<string, string>): Item {
    return { ...item, style: mergeStyleString(getItemStyleString(item), declarations) }
}

/** Fusiona declaraciones CSS en varios items de una diapositiva (inmutable). */
export function setItemsStyle(slide: Slide, indices: number[], declarations: Record<string, string>): Slide {
    const set = new Set(indices)
    const items = (slide.items ?? []).map((item, index) =>
        set.has(index) ? setItemStyle(item, declarations) : item
    )
    return { ...slide, items }
}

/** Añade un item de texto vacío al final de la diapositiva (inmutable). */
export function addTextItem(slide: Slide): { slide: Slide; index: number } {
    const items = (slide.items ?? []).slice()
    const index = items.length
    items.push({
        type: "text",
        style: DEFAULT_ITEM_STYLE,
        lines: [{ align: "", text: [{ value: "", style: "" }] }],
    })
    return { slide: { ...slide, items }, index }
}

/** Elimina un item por índice (inmutable). */
export function removeItem(slide: Slide, index: number): Slide {
    const items = (slide.items ?? []).filter((_, i) => i !== index)
    return { ...slide, items }
}

/** Duplica un item insertando la copia después (inmutable). */
export function duplicateItem(slide: Slide, index: number): { slide: Slide; index: number } {
    const items = (slide.items ?? []).slice()
    const source = items[index]
    if (!source) return { slide, index }
    const copy = JSON.parse(JSON.stringify(source)) as Item
    if (copy.id) copy.id = makeSlideId()
    items.splice(index + 1, 0, copy)
    return { slide: { ...slide, items }, index: index + 1 }
}

/** Reordena (z-order) un item dentro de la lista (inmutable). */
export function rearrangeItems(
    slide: Slide,
    type: ItemAlign,
    index: number,
): { slide: Slide; index: number } {
    const items = (slide.items ?? []).slice()
    if (index < 0 || index >= items.length) return { slide, index }

    const [current] = items.splice(index, 1)
    let target = index
    if (type === "forward") target = Math.min(index + 1, items.length)
    else if (type === "backward") target = Math.max(index - 1, 0)
    else if (type === "to_front") target = items.length
    else if (type === "to_back") target = 0

    items.splice(target, 0, current)
    return { slide: { ...slide, items }, index: target }
}

// ---------------------------------------------------------------------------
// Filtros CSS (`filter` / `backdrop-filter`) y transformaciones (`transform`)
// ---------------------------------------------------------------------------

/** Añade/actualiza una función CSS (`blur(8px)`, `rotate(45deg)`…) a un filtro. */
export function addFilterString(oldFilter: string | undefined, filter: [string, string | null]): string {
    let array = (oldFilter ?? "").trim().split(" ").filter((entry) => entry.length)
    const name = filter[0].replace(")", "").trim()
    array = array.filter((entry) => entry.split("(")[0].replace(")", "").trim() !== name && entry.length)
    if (filter[1] !== null) array.push(`${filter[0]}(${filter[1]})`)

    // `perspective(...)` debe ir siempre primero para que `rotateX/Y` funcione.
    const perspectiveIndex = array.findIndex((entry) => entry.includes("perspective"))
    if (perspectiveIndex >= 0) {
        const value = array.splice(perspectiveIndex, 1)[0]
        if (!value.includes("(0px)")) array = [value, ...array]
    }

    return array.join(" ")
}

/** Valor numérico de una función concreta dentro de un filtro (`blur(8px)` → 8). */
export function getFilterValue(filter: string | undefined, name: string): number {
    if (!filter) return 0
    const match = filter.match(new RegExp(`${name}\\(([-\\d.]+)px\\)`))
    return match ? Number(match[1]) : 0
}

/** Convierte `top`/`left`/`width`/`height` de px a % sobre el lienzo estándar. */
export function stylePosToPercentage(style: Record<string, string>): Record<string, string> {
    const out = { ...style }
    const horizontal = ["left", "width"]
    for (const key of ["top", "left", "width", "height"]) {
        const raw = out[key]
        if (!raw || !/px$/.test(raw)) continue
        const value = parseFloat(raw)
        if (Number.isNaN(value)) continue
        const base = horizontal.includes(key) ? CANVAS.width : CANVAS.height
        out[key] = `${Math.round((value / base) * 1000) / 10}%`
    }
    return out
}

/** Convierte `top`/`left`/`width`/`height` de % a px (inverso del anterior). */
export function percentageToAspectRatio(style: Record<string, string>): Record<string, string> {
    const out = { ...style }
    const horizontal = ["left", "width"]
    for (const key of ["top", "left", "width", "height"]) {
        const raw = out[key]
        if (!raw || !/%$/.test(raw)) continue
        const value = parseFloat(raw)
        if (Number.isNaN(value)) continue
        const base = horizontal.includes(key) ? CANVAS.width : CANVAS.height
        out[key] = `${Math.round((value / 100) * base)}px`
    }
    return out
}
