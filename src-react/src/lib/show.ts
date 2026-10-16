// ----- FreeShow -----
// Utilidades del modelo de Show: normalización del contenido que devuelve Rust,
// resolución del layout activo y aplanado de grupos de diapositivas.

import type { CSSProperties } from "react"
import type { Layout, Show, Slide, SlideData, SlideGroup, SlideSettings } from "@/types/Show"

export const DEFAULT_RESOLUTION = { width: 1920, height: 1080 }

/** Convierte una cadena CSS (`top:10px;font-size:20px;`) en un estilo de React. */
export function parseStyle(style?: string | Record<string, string>): CSSProperties {
    if (!style) return {}
    if (typeof style === "object") return style as CSSProperties

    const out: Record<string, string> = {}
    for (const declaration of style.split(";")) {
        const separator = declaration.indexOf(":")
        if (separator < 0) continue
        const property = declaration.slice(0, separator).trim()
        const value = declaration.slice(separator + 1).trim()
        if (!property || !value) continue
        // `--custom-props` se conservan tal cual; el resto pasa a camelCase.
        const key = property.startsWith("--")
            ? property
            : property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
        out[key] = value
    }
    return out as CSSProperties
}

/** Normaliza la respuesta de `SHOW` (`{ id, content: [id, data] }`) a un `Show`. */
export function normalizeShow(raw: unknown, fallbackId: string): Show | null {
    if (!raw || typeof raw !== "object") return null
    const payload = raw as { id?: string; content?: unknown; error?: string }
    if (payload.error) return null

    let data: any = payload.content
    let id = payload.id || fallbackId

    if (Array.isArray(data)) {
        id = (typeof data[0] === "string" && data[0]) || id
        data = data[1]
    }
    if (!data || typeof data !== "object") return null

    return { ...(data as Record<string, any>), id } as Show
}

/** Identificador del layout activo (con respaldo al primero disponible). */
export function getActiveLayoutId(show: Show | null): string {
    if (!show) return "default"
    return show.settings?.activeLayout || Object.keys(show.layouts ?? {})[0] || "default"
}

export function getActiveLayout(show: Show | null): Layout | null {
    if (!show) return null
    return show.layouts?.[getActiveLayoutId(show)] ?? null
}

/** Aplana recursivamente los grupos de un layout en una lista ordenada de ids. */
export function flattenSlideGroups(groups: SlideGroup[] | undefined): string[] {
    if (!Array.isArray(groups)) return []
    const ids: string[] = []
    const walk = (list: SlideGroup[]) => {
        for (const entry of list) {
            if (!entry) continue
            if (entry.id) ids.push(entry.id)
            if (entry.children?.length) walk(entry.children)
        }
    }
    walk(groups)
    return ids
}

/** Ids de las diapositivas del layout activo, en orden. */
export function getLayoutSlideIds(show: Show | null): string[] {
    return flattenSlideGroups(getActiveLayout(show)?.slides)
}

/** Texto plano de una diapositiva (para previsualización / proyección). */
export function getSlideText(slide: Slide | undefined): string {
    if (!slide) return ""
    const parts: string[] = []
    for (const item of slide.items ?? []) {
        if (item.type && item.type !== "text") continue
        for (const line of item.lines ?? []) {
            const value = (line.text ?? []).map((segment) => segment.value).join("")
            if (value) parts.push(value)
        }
    }
    return parts.join("\n")
}

/** Resolución de una diapositiva (la del show o la estándar 1920×1080). */
export function getShowResolution(show: Show | null) {
    const resolution = show?.settings?.resolution
    if (resolution?.width && resolution?.height) return resolution
    return DEFAULT_RESOLUTION
}

/** Reordena el array de grupos del layout activo (inmutable). */
export function moveLayoutSlide(show: Show, from: number, to: number): Show {
    const layoutId = getActiveLayoutId(show)
    const layout = show.layouts?.[layoutId]
    if (!layout || !Array.isArray(layout.slides)) return show
    if (from < 0 || to < 0 || from >= layout.slides.length || to >= layout.slides.length) return show

    const slides = layout.slides.slice()
    const [moved] = slides.splice(from, 1)
    slides.splice(to, 0, moved)

    return {
        ...show,
        layouts: { ...show.layouts, [layoutId]: { ...layout, slides } },
    }
}

// ---------------------------------------------------------------------------
// Operaciones de diapositivas (añadir / duplicar / eliminar / editar)
// ---------------------------------------------------------------------------

/** Genera un id único para una diapositiva nueva. */
export function makeSlideId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
    return `slide-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

/** Diapositiva vacía (sin items). */
export function createEmptySlide(): Slide {
    return { items: [] }
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

/** Reemplaza la lista de grupos del layout activo. */
function withLayoutSlides(show: Show, slides: SlideGroup[]): Show {
    const layoutId = getActiveLayoutId(show)
    const layout = show.layouts?.[layoutId]
    if (!layout) return show
    return {
        ...show,
        layouts: { ...show.layouts, [layoutId]: { ...layout, slides } },
    }
}

/** Duplica una diapositiva insertando la copia justo después (inmutable). */
export function duplicateLayoutSlide(show: Show, slideId: string): { show: Show; id: string } | null {
    const layoutId = getActiveLayoutId(show)
    const layout = show.layouts?.[layoutId]
    if (!layout || !Array.isArray(layout.slides)) return null

    const index = layout.slides.findIndex((group) => group.id === slideId)
    if (index < 0) return null

    const source = show.slides[slideId]
    const id = makeSlideId()
    const slides = layout.slides.slice()
    slides.splice(index + 1, 0, { id })

    return {
        show: {
            ...show,
            slides: { ...show.slides, [id]: source ? clone(source) : createEmptySlide() },
            layouts: { ...show.layouts, [layoutId]: { ...layout, slides } },
        },
        id,
    }
}

/** Añade una diapositiva al final del layout activo (inmutable). */
export function appendLayoutSlide(show: Show, slide: Slide = createEmptySlide()): { show: Show; id: string } {
    const id = makeSlideId()
    const layoutId = getActiveLayoutId(show)
    const slides = (show.layouts?.[layoutId]?.slides ?? []).slice()
    slides.push({ id })

    return {
        show: {
            ...show,
            slides: { ...show.slides, [id]: slide },
            layouts: { ...show.layouts, [layoutId]: { ...show.layouts?.[layoutId], slides } },
        },
        id,
    }
}

/** Elimina una diapositiva del layout activo y del mapa de slides (inmutable). */
export function removeLayoutSlide(show: Show, slideId: string): Show {
    const layoutId = getActiveLayoutId(show)
    const layout = show.layouts?.[layoutId]
    if (!layout || !Array.isArray(layout.slides)) return show

    const slides = layout.slides.filter((group) => group.id !== slideId)
    if (slides.length === layout.slides.length) return show

    const slidesMap = { ...show.slides }
    delete slidesMap[slideId]

    return {
        ...show,
        slides: slidesMap,
        layouts: { ...show.layouts, [layoutId]: { ...layout, slides } },
    }
}

/** Reemplaza una diapositiva concreta en el mapa de slides (inmutable). */
export function updateSlideInShow(show: Show, slideId: string, slide: Slide): Show {
    return { ...show, slides: { ...show.slides, [slideId]: slide } }
}

/** Id y posición de una diapositiva dentro del layout activo (o `null`). */
export function findSlideIndex(show: Show | null, slideId: string | null): number {
    if (!show || !slideId) return -1
    return getLayoutSlideIds(show).indexOf(slideId)
}

// ---------------------------------------------------------------------------
// Edición de texto y estilos (editor enriquecido)
// ---------------------------------------------------------------------------

/** Referencia a una línea editable de una diapositiva. */
export interface SlideLineRef {
    itemIndex: number
    lineIndex: number
    value: string
    style: string
}

/** Descompone una cadena CSS kebab-case en un objeto (sin camelCase). */
export function styleToObject(style?: string): Record<string, string> {
    const out: Record<string, string> = {}
    if (!style) return out
    for (const declaration of style.split(";")) {
        const separator = declaration.indexOf(":")
        if (separator < 0) continue
        const property = declaration.slice(0, separator).trim()
        const value = declaration.slice(separator + 1).trim()
        if (property && value) out[property] = value
    }
    return out
}

export function objectToStyle(style: Record<string, string>): string {
    return Object.entries(style)
        .map(([property, value]) => `${property}: ${value};`)
        .join("")
}

/** Fusiona declaraciones CSS en una cadena de estilo (vacío = elimina). */
export function mergeStyleString(style: string | undefined, declarations: Record<string, string>): string {
    const obj = styleToObject(style)
    for (const [property, value] of Object.entries(declarations)) {
        if (value === "") delete obj[property]
        else obj[property] = value
    }
    return objectToStyle(obj)
}

/** Lista las líneas de texto editables de una diapositiva. */
export function getSlideLines(slide: Slide | undefined): SlideLineRef[] {
    const out: SlideLineRef[] = []
    slide?.items?.forEach((item, itemIndex) => {
        if (item.type && item.type !== "text") return
        item.lines?.forEach((line, lineIndex) => {
            const segments = line.text ?? []
            out.push({
                itemIndex,
                lineIndex,
                value: segments.map((segment) => segment.value).join(""),
                style: segments[0]?.style ?? "",
            })
        })
    })
    return out
}

/** Estilo consolidado del primer segmento de texto de una diapositiva. */
export function getSlideStyle(slide: Slide | undefined): Record<string, string> {
    for (const item of slide?.items ?? []) {
        if (item.type && item.type !== "text") continue
        const segment = item.lines?.[0]?.text?.[0]
        if (segment?.style) return styleToObject(segment.style)
    }
    return {}
}

/** Asegura que la diapositiva tenga al menos un item de texto con una línea. */
export function ensureTextItem(slide: Slide): Slide {
    const hasText = (slide.items ?? []).some((item) => !item.type || item.type === "text")
    if (hasText && (slide.items ?? []).length) return slide
    return {
        ...slide,
        items: [...(slide.items ?? []), { lines: [{ text: [{ value: "", style: "" }] }] }],
    }
}

/** Reemplaza el texto de una línea conservando el estilo del primer segmento. */
export function updateLineValue(slide: Slide, itemIndex: number, lineIndex: number, value: string): Slide {
    const items = (slide.items ?? []).map((item, i) => {
        if (i !== itemIndex) return item
        const lines = (item.lines ?? []).map((line, j) => {
            if (j !== lineIndex) return line
            const style = (line.text ?? [])[0]?.style ?? ""
            return { ...line, text: [{ value, style }] }
        })
        return { ...item, lines }
    })
    return { ...slide, items }
}

/** Añade una línea vacía al primer item de texto. */
export function addTextLine(slide: Slide): Slide {
    const items = (slide.items ?? []).map((item, index) => {
        if (index !== 0) return item
        if (item.type && item.type !== "text") return item
        const style = (item.lines?.[0]?.text ?? [])[0]?.style ?? ""
        return { ...item, lines: [...(item.lines ?? []), { text: [{ value: "", style }] }] }
    })
    if (!items.length) return ensureTextItem(slide)
    return { ...slide, items }
}

/** Elimina una línea concreta del primer item de texto. */
export function removeTextLine(slide: Slide, lineIndex: number): Slide {
    const items = (slide.items ?? []).map((item, index) => {
        if (index !== 0) return item
        if (item.type && item.type !== "text") return item
        const lines = (item.lines ?? []).filter((_, j) => j !== lineIndex)
        return { ...item, lines }
    })
    return { ...slide, items }
}

/** Aplica declaraciones CSS a todos los segmentos de texto de la diapositiva. */
export function setSlideTextStyle(slide: Slide, declarations: Record<string, string>): Slide {
    const items = (slide.items ?? []).map((item) => {
        if (item.type && item.type !== "text") return item
        const lines = (item.lines ?? []).map((line) => ({
            ...line,
            text: (line.text ?? []).map((segment) => ({
                ...segment,
                style: mergeStyleString(segment.style, declarations),
            })),
        }))
        return { ...item, lines }
    })
    return { ...slide, items }
}

export { withLayoutSlides }

// ---------------------------------------------------------------------------
// Layout: datos por diapositiva (transición, fondo) y ajustes de la diapositiva
// ---------------------------------------------------------------------------

/** Localiza el grupo de layout correspondiente a una diapositiva (o `null`). */
export function findLayoutGroup(
    show: Show | null,
    slideId: string | null,
): { layoutId: string; index: number; group: SlideGroup } | null {
    if (!show || !slideId) return null
    const layoutId = getActiveLayoutId(show)
    const slides = show.layouts?.[layoutId]?.slides
    if (!Array.isArray(slides)) return null

    const index = slides.findIndex((group) => group?.id === slideId)
    if (index < 0) return null
    return { layoutId, index, group: slides[index] }
}

/**
 * Fusiona datos en el grupo de layout de una diapositiva (inmutable). Las claves
 * con valor `undefined` o `""` se eliminan para no ensuciar el archivo del show.
 */
export function updateLayoutData(show: Show, slideId: string, patch: SlideData): Show {
    const found = findLayoutGroup(show, slideId)
    if (!found) return show
    const { layoutId, index } = found
    const layout = show.layouts?.[layoutId]
    if (!layout) return show

    const data: SlideData = { ...(layout.slides[index].data ?? {}), ...patch }
    for (const key of Object.keys(patch)) {
        if ((patch as Record<string, unknown>)[key] === "" || (patch as any)[key] === undefined) {
            delete (data as Record<string, any>)[key]
        }
    }

    const slides = layout.slides.slice()
    slides[index] = { ...layout.slides[index], data }

    return {
        ...show,
        layouts: { ...show.layouts, [getActiveLayoutId(show)]: { ...layout, slides } },
    }
}

/** Lee los datos de layout de una diapositiva (transición, fondo…). */
export function getLayoutData(show: Show | null, slideId: string | null): SlideData {
    const found = show && slideId ? findLayoutGroup(show, slideId) : null
    return found?.group.data ?? {}
}

/** Ajustes de una diapositiva (objeto vacío si no tiene). */
export function getSlideSettings(slide: Slide | undefined): SlideSettings {
    return slide?.settings ?? {}
}

/** Fusiona ajustes de diapositiva (vacío = elimina la clave) inmutablemente. */
export function updateSlideSettings(slide: Slide, patch: SlideSettings): Slide {
    const settings: SlideSettings = { ...(slide.settings ?? {}) }
    for (const [key, value] of Object.entries(patch)) {
        if (value === "" || value === undefined || value === null) delete settings[key]
        else settings[key] = value
    }
    return { ...slide, settings: Object.keys(settings).length ? settings : undefined }
}
