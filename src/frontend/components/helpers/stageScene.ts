// F23.19: ítems de la escena de una salida stage a partir del layout que diseñó el usuario.
// Puro (sin stores): `sceneGraph.ts` arma el `StageContext` con los textos ya resueltos.
import type { SceneItem, SceneTextItem } from "../../../types/SceneGraph"
import type { StageItem, StageLayout } from "../../../types/Stage"
import { imageExtensions, videoExtensions } from "../../shared/core/values/extensions"
import { variableText, type VariableValue } from "./dynamicItemText"
import { sceneMediaItem, sceneTextItem, sceneTextSpan } from "./sceneGraphPayload"
import { parseBoxStyle, parseCssColor, parseItemBox, parseTextAlign, parseTextStyle, parseVerticalAlign } from "./sceneStyle"

export interface SceneResolution {
    width: number
    height: number
}

export interface StageContext {
    resolution: SceneResolution
    /** Texto plano de cada slide del layout activo (`plainTextOf`) */
    slideTexts: string[]
    slideNotes: string[]
    currentIndex: number
    /** Respaldo si falta `clockTexts` */
    clockText: string
    /** Texto de cada reloj por clave del ítem; un reloj sin entrada (analógico) no se dibuja */
    clockTexts?: Record<string, string>
    /** Por id de timer; `first_active_timer` para el ítem antiguo del primer timer activo */
    timerTexts: Record<string, string>
    variableTexts: Record<string, string>
    trackerText: string | null
    /** Convierte posiciones en % a px según la resolución (`percentageStylePos`); sin él, el estilo se usa tal cual */
    positionStyle?: (style: string) => string
}

const LABEL_FONT_SIZE = 28
const LABEL_HEIGHT = 34
const DEFAULT_FONT_SIZE = 100
const MAX_FONT_SIZE = 800
const MIN_FONT_SIZE = 8

/** Tipo del ítem: `item.type` o, en layouts viejos, deducido de la clave (`slide_tracker`, `timers#id`, `next_slide`…). */
export function stageItemType(key: string, item: StageItem): string {
    if (item.type) return item.type
    if (key.includes("slide_tracker")) return "slide_tracker"
    if (key.includes("notes")) return "slide_notes"
    if (key.includes("slide")) return "slide_text"
    if (key.includes("clock")) return "clock"
    if (key.includes("timers") || key.includes("first_active_timer")) return "timer"
    if (key.includes("variables")) return "variable"
    return ""
}

const keyId = (key: string) => key.split("#")[1] || ""

/** Id del timer o de la variable que muestra el ítem (`first_active_timer` para el ítem antiguo del primer timer activo). */
export function stageRefId(key: string, item: StageItem): string {
    return item.timer?.id || item.variable?.id || keyId(key) || (key.includes("first_active_timer") ? "first_active_timer" : "")
}

/** Texto de la variable: `hideText` sólo vale para los ítems antiguos sin tipo; con tipo, una variable deshabilitada se ve (como SlideItems). */
export function stageVariableText(item: StageItem, variable: VariableValue | undefined): string {
    return variableText(variable, !item.type)
}

/** Timer de un ítem: el suyo o, con tipo y sin `timer.id`, el primer activo o el primero que no es contador (como Stagebox). */
export function stageTimerId(key: string, item: StageItem, activeId: string | undefined, firstNonCounterId: string | undefined): string {
    const id = stageRefId(key, item)
    return id === "first_active_timer" || (item.type && !item.timer?.id) ? activeId || firstNonCounterId || "" : id
}

export function slideOffsetOf(key: string, item: StageItem): number {
    return item.type ? Number(item.slideOffset || 0) : key.includes("next") ? 1 : 0
}

/** Texto del ítem, o `null` si no dibuja nada. */
function itemText(key: string, item: StageItem, type: string, ctx: StageContext): string | null {
    const slideAt = (list: string[]) => list[ctx.currentIndex + slideOffsetOf(key, item)]
    switch (type) {
        case "slide_text": {
            const text = slideAt(ctx.slideTexts)
            const count = Number(item.lineCount) || 0
            return text && count > 0 ? text.split("\n").slice(0, count).join("\n") : text
        }
        case "slide_notes":
            return slideAt(ctx.slideNotes)
        case "clock":
            return ctx.clockTexts ? ctx.clockTexts[key] : ctx.clockText
        case "timer":
            return ctx.timerTexts[stageRefId(key, item)]
        case "variable":
            return ctx.variableTexts[stageRefId(key, item)]
        case "slide_tracker":
            return ctx.trackerText
        case "text":
        case "":
            return (item.lines || []).map((line) => (line.text || []).map((part) => (typeof part.value === "string" ? part.value : "")).join("")).join("\n")
        default:
            return null
    }
}

/**
 * Tamaño de letra que hace entrar el texto en la caja (autoajuste del stage).
 * shortcut: ancho medio de letra 0.55 em y corte de línea por cantidad de caracteres, sin medir la fuente; subir a
 * medición real si el stage se ve muy lejos del autoajuste de la vista previa.
 */
function fitFontSize(text: string, width: number, height: number, lineHeight: number, max: number): number {
    const fits = (size: number) => {
        const perLine = Math.max(1, Math.floor(width / (size * 0.55)))
        const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0)
        return lines * size * lineHeight <= height
    }
    let low = MIN_FONT_SIZE
    let high = Math.max(MIN_FONT_SIZE, Math.min(max, height))
    while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (fits(mid)) low = mid
        else high = mid - 1
    }
    return low
}

function textSceneItem(id: string, item: StageItem, type: string, text: string, ctx: StageContext): SceneTextItem {
    const style = ctx.positionStyle ? ctx.positionStyle(item.style) : item.style
    const { width, height } = ctx.resolution
    const box = parseItemBox(style, { x: 0, y: 0, width, height })
    const base = parseTextStyle(item.style)
    const lineHeight = base.lineHeight || 1.1
    const autoFit = type === "text" ? !!item.auto || (!!item.textFit && item.textFit !== "none") : item.auto !== false && item.textFit !== "none"
    const fontSize = autoFit ? fitFontSize(text, box.width, box.height, lineHeight, base.fontSize || MAX_FONT_SIZE) : base.fontSize || DEFAULT_FONT_SIZE
    const color = base.color || [1, 1, 1, 1]

    return sceneTextItem({
        id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        align: parseTextAlign(item.alignX) || "center",
        verticalAlign: parseVerticalAlign(item.align),
        lineHeight,
        fontFamily: base.fontFamily,
        fontSize,
        fontWeight: base.fontWeight ?? 400,
        fontStyle: base.fontStyle,
        color,
        stroke: base.strokeWidth && base.strokeWidth > 0 ? { color: base.strokeColor || [0, 0, 0, 1], width: base.strokeWidth } : undefined,
        shadow: base.shadow || undefined,
        letterSpacing: base.letterSpacing,
        text,
        spans: [sceneTextSpan({ text, fontFamily: base.fontFamily, fontSize, fontWeight: base.fontWeight ?? 400, fontStyle: base.fontStyle, color, underline: base.underline, strike: base.strike })],
        // reloj, timers y variables van `live` (como F23.17); sólo se reenvía cada segundo la escena si hay reloj/timer o una variable con `{…}` (lo marca quien arma el contexto)
        live: type === "clock" || type === "timer" || type === "variable" ? true : undefined,
        box: parseBoxStyle(item.style)
    })
}

function mediaSceneItem(id: string, item: StageItem, ctx: StageContext): SceneItem | null {
    const src = item.src || ""
    const extension = src.slice(src.lastIndexOf(".") + 1).toLowerCase()
    const mediaType = imageExtensions.includes(extension) ? "image" : videoExtensions.includes(extension) ? "video" : null
    if (!mediaType) return null

    const { width, height } = ctx.resolution
    const box = parseItemBox(ctx.positionStyle ? ctx.positionStyle(item.style) : item.style, { x: 0, y: 0, width, height })
    return sceneMediaItem({ id, ...box, src, mediaType, fit: "contain", opacity: 1, box: parseBoxStyle(item.style) })
}

/** Etiqueta del ítem (`settings.labels`): 28 px sobre un fondo tenue, pegada arriba de su caja. */
function labelItem(id: string, label: string, color: string | undefined, placed: { x: number; y: number; width: number }): SceneTextItem {
    const labelColor = parseCssColor(color || "#d0a853")
    return sceneTextItem({
        id: `${id}-label`,
        x: placed.x,
        y: placed.y - LABEL_HEIGHT,
        width: placed.width,
        height: LABEL_HEIGHT,
        align: "center",
        verticalAlign: "center",
        lineHeight: 1.1,
        fontSize: LABEL_FONT_SIZE,
        fontWeight: 400,
        color: labelColor,
        text: label,
        spans: [sceneTextSpan({ text: label, fontSize: LABEL_FONT_SIZE, fontWeight: 400, color: labelColor })],
        box: { background: [0, 0, 0, 0.4] }
    })
}

/** Ítems de la escena de un layout de stage, en el orden del layout (`itemOrder` y, después, el resto). */
export function buildStageItems(layout: StageLayout, ctx: StageContext): SceneItem[] {
    const keys = Object.keys(layout.items || {})
    const ordered = [...(layout.itemOrder || []).filter((key) => keys.includes(key)), ...keys.filter((key) => !(layout.itemOrder || []).includes(key))]
    const out: SceneItem[] = []

    ordered.forEach((key) => {
        const item = layout.items[key]
        if (!item || item.enabled === false) return

        const type = stageItemType(key, item)
        let built: SceneItem | null = null
        if (type === "media") {
            built = mediaSceneItem(key, item, ctx)
        } else {
            const text = itemText(key, item, type, ctx)
            if (text && text.trim()) built = textSceneItem(key, item, type, text, ctx)
        }
        if (!built) return

        out.push(built)
        if (layout.settings?.labels && item.label) out.push(labelItem(key, item.label, layout.settings.labelColor, built))
    })

    return out
}
