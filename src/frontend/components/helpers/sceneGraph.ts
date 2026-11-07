// Construye el Scene Graph (src/types/SceneGraph.ts) de una salida a partir del estado de Svelte
// y lo envía al engine de render nativo (Rust) con `RENDER_SCENE`.
//
// Reutiliza la misma lógica que el render HTML de la UI de control: layout/slide de la show,
// plantilla del estilo de salida (setTemplateStyle), resolución (getOutputResolution), líneas visibles
// (getOutputLines), valores dinámicos (replaceDynamicValues) y transiciones (getOutputTransitions).
// El payload final lo arma `sceneGraphPayload.ts`, único lugar que enumera las claves del contrato.
//
// F4.5: los items de medio (imagen) se envían con su caja en la resolución lógica de la escena.
// F4.6: los items de las overlays activas viajan en `overlays`, una capa propia que el engine
// dibuja encima de la slide (fondo → medios de la slide → texto de la slide → medios → texto de
// los overlays). El engine no respeta el orden de apilado de la slide (fondo → medios → texto).
import { get } from "svelte/store"
import dayjs from "dayjs"
import localizedFormat from "dayjs/plugin/localizedFormat"
import { OUTPUT } from "../../../types/Channels"
import type { Output, PrefetchPayload } from "../../../types/Output"
import type { SceneBackground, SceneGraph, SceneItem, SceneMediaItem, SceneTextItem, SceneTextSpan, SceneTransition } from "../../../types/SceneGraph"
import type { Item, OutSlide, Slide } from "../../../types/Show"
import { activeTimers, events, media, overlays, outputs, playingVideoState, showsCache, stageShows, styles, timeFormat as timeFormatStore, timers, transitionData, variables } from "../../stores"
import { send } from "../../utils/request"
import { getItemText } from "../edit/scripts/textStyle"
import { shouldItemBeShown } from "../edit/scripts/itemHelpers"
import { clone } from "./array"
import { getSceneSourceId } from "./sceneMirror"
import { videoSyncFields } from "./videoSync"
import { getExtension, getMediaStyle, getMediaType } from "./media"
import { joinTimeBig } from "./time"
import { getCurrentTimerValue } from "../drawer/timers/timers"
import { defaultLayers, getCurrentStyle, getOutputLines, getOutputResolution, getOutputTransitions, getStyleTemplate, percentageStylePos, setTemplateStyle } from "./output"
import { _show } from "./shows"
import { getLayoutRef } from "./show"
import { eventsLines, slideTrackerParts, slideTrackerText, variableText, type CalendarEvent } from "./dynamicItemText"
import { replaceDynamicValues } from "./showActions"
import { contentAlign } from "./outputAspect"
import { imagePathsOf } from "./sceneMedia"
import { applyTextTransform, parseBoxStyle, parseCssColor, parseItemBox, parseTextAlign, parseTextStyle, parseVerticalAlign, type ParsedTextStyle } from "./sceneStyle"
import { sceneBackground, sceneGraphPayload, sceneMediaItem, sceneTextItem, sceneTextSpan, sceneTransition } from "./sceneGraphPayload"
import { markSceneClock, resetSceneClock } from "./sceneClock"
import { buildStageItems, slideOffsetOf, stageItemType, stageRefId, type StageContext } from "./stageScene"
import type { StageItem, StageLayout } from "../../../types/Stage"

dayjs.extend(localizedFormat)

export { scenesHaveClock } from "./sceneClock"

const DEFAULT_FONT_SIZE = 100
const DEFAULT_LINE_HEIGHT = 1.1

/** Contexto para `replaceDynamicValues`: slide de la show o overlay activa (F4.6). */
type DynamicRef = { showId?: string; layoutId?: string; slideIndex?: number; type?: string; id?: string }

/** Ventana de líneas visibles de `getOutputLines` (`null` = sin límite en ese extremo). */
type LineWindow = { start?: number | null; end?: number | null; linesStart?: number | null; linesEnd?: number | null; clickRevealed?: boolean }

// ITEMS

function getSlideItems(slide: OutSlide, outputId: string, currentStyle: ReturnType<typeof getCurrentStyle>): Item[] {
    // PDF, presentaciones, etc. no tienen items de texto
    if (slide.type && (slide.type as string) !== "show") return []

    let slideItems: Item[] = []
    let customDynamicValues: Slide["customDynamicValues"]

    if (slide.id === "temp" || slide.id === "tempText") {
        slideItems = slide.tempItems || []
    } else {
        const layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
        const slideId = layoutRef[slide.index ?? -1]?.id || ""
        const showSlide = _show(slide.id).slides([slideId]).get()[0] as Slide | undefined
        slideItems = clone(showSlide?.items || [])
        customDynamicValues = showSlide?.customDynamicValues
    }

    return setTemplateStyle(slide, currentStyle, slideItems, outputId, customDynamicValues)
}

function buildTextItem(item: Item, index: number, allItems: Item[], dynamicRef: DynamicRef, outputId: string, resolution: { width: number; height: number }, lineWindow: LineWindow): SceneTextItem | null {
    if ((item.type || "text") !== "text") return null
    if (!shouldItemBeShown(item, allItems, { outputId, type: "default" })) return null
    if (item.clickReveal && lineWindow.clickRevealed === false) return null

    const lines = item.lines || []
    if (!lines.length) return null

    const box = parseItemBox(percentageStylePos(item.style, resolution), { x: 0, y: 0, width: resolution.width, height: resolution.height })
    const base = parseTextStyle(item.style)

    // líneas visibles (límite de líneas del estilo / revelado por líneas)
    const start = item.lineReveal ? lineWindow.linesStart : lineWindow.start
    const end = item.lineReveal ? lineWindow.linesEnd : lineWindow.end
    const hasWindow = start !== null && start !== undefined && end !== null && end !== undefined

    const spans: SceneTextSpan[] = []
    let blockStyle: ParsedTextStyle | null = null
    let align: ReturnType<typeof parseTextAlign> = null
    let lineHeight: number | undefined

    const visibleLines = lines.filter((_line, i) => !hasWindow || (i >= (start as number) && i < (end as number)))

    visibleLines.forEach((line, lineIndex) => {
        if (!align) align = parseTextAlign(line.align)
        ;(line.text || []).forEach((part) => {
            const partStyle = parseTextStyle(part.style)
            let value = typeof part.value === "string" ? part.value : ""
            if (value.includes("{")) value = replaceDynamicValues(value, dynamicRef)
            value = applyTextTransform(value, partStyle.textTransform || base.textTransform)
            if (!value) return

            if (!blockStyle) blockStyle = { ...base, ...partStyle }
            if (lineHeight === undefined) lineHeight = partStyle.lineHeight || base.lineHeight

            spans.push(
                sceneTextSpan({
                    text: value,
                    fontFamily: partStyle.fontFamily,
                    fontSize: partStyle.fontSize,
                    fontWeight: partStyle.fontWeight,
                    fontStyle: partStyle.fontStyle,
                    color: partStyle.color,
                    underline: partStyle.underline ?? base.underline,
                    strike: partStyle.strike ?? base.strike
                })
            )
        })

        if (lineIndex < visibleLines.length - 1) spans.push(sceneTextSpan({ text: "\n" }))
    })

    const text = spans.map((s) => s.text).join("")
    if (!text.trim()) return null

    const resolved: ParsedTextStyle = blockStyle || base
    const usesAutoSize = (item.textFit || "none") !== "none" || !!item.auto
    let fontSize = resolved.fontSize || DEFAULT_FONT_SIZE
    if (usesAutoSize && item.autoFontSize) {
        fontSize = item.autoFontSize
        spans.forEach((s) => delete s.fontSize)
    }

    return sceneTextItem({
        id: item.id || `item-${index}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        align: align || "center",
        verticalAlign: parseVerticalAlign(item.align),
        lineHeight: lineHeight || DEFAULT_LINE_HEIGHT,
        fontFamily: resolved.fontFamily,
        fontSize,
        fontWeight: resolved.fontWeight ?? 400,
        fontStyle: resolved.fontStyle,
        color: resolved.color || [1, 1, 1, 1],
        stroke: resolved.strokeWidth && resolved.strokeWidth > 0 ? { color: resolved.strokeColor || [0, 0, 0, 1], width: resolved.strokeWidth } : undefined,
        shadow: resolved.shadow || undefined,
        letterSpacing: resolved.letterSpacing,
        text,
        spans,
        box: parseBoxStyle(item.style)
    })
}

function buildMediaItem(item: Item, index: number, allItems: Item[], outputId: string, resolution: { width: number; height: number }, lineWindow: LineWindow): SceneMediaItem | null {
    if (item.type !== "media") return null
    if (!shouldItemBeShown(item, allItems, { outputId, type: "default" })) return null
    if (item.clickReveal && lineWindow.clickRevealed === false) return null

    const src = item.src || ""
    if (!src) return null

    // cámaras, web, temporizadores… no son archivos en disco: el engine no los puede dibujar
    const mediaType = getMediaType(getExtension(src))
    if (mediaType !== "image" && mediaType !== "video") return null

    const box = parseItemBox(percentageStylePos(item.style, resolution), { x: 0, y: 0, width: resolution.width, height: resolution.height })
    // "blur" no se puede pintar en el engine: cae a "contain" (igual que el render HTML)
    const fit = item.fit === "cover" ? "cover" : item.fit === "fill" ? "fill" : "contain"

    return sceneMediaItem({ id: item.id, x: box.x, y: box.y, width: box.width, height: box.height, src, mediaType, fit, opacity: 1, box: parseBoxStyle(item.style) })
}

// TIMERS / RELOJES (F4.7): el engine dibuja el valor que manda el frontend.

function timerValueText(item: Item, today: Date): string {
    const timerId = item.timer?.id || item.timerId || ""
    const timer = (get(timers) as any)?.[timerId] || {}
    if (!timer?.type) return ""
    try {
        const currentTime = getCurrentTimerValue(timer, { id: timerId }, today, get(activeTimers))
        const showHours = item.timer?.showHours !== false
        const padding = item.timer?.padding !== false
        return joinTimeBig(typeof currentTime === "number" ? currentTime : 0, showHours, padding)
    } catch {
        return ""
    }
}

/** Texto de un reloj (digital o con formato propio); `null` si es analógico (el engine no lo dibuja). */
function clockValueText(item: Item, today: Date): string | null {
    const clock = item.clock || {}
    const type = clock.type || "digital"
    if (type === "analog") return null

    const offsetDays = Number(clock.offsetDays) || 0
    const target = offsetDays ? new Date(today.getTime() + offsetDays * 86400000) : today

    if (type === "custom") return dayjs(target).format(clock.customFormat || "hh:mm a")

    const dateFormat = clock.dateFormat || "none"
    const showTime = clock.showTime !== false
    const seconds = clock.seconds !== false
    const twelve = get(timeFormatStore) === "12"

    let parts: string[] = []
    if (dateFormat && dateFormat !== "none") {
        parts.push(dayjs(target).format(dateFormat))
    }
    if (showTime) {
        const d = target
        let h = d.getHours()
        let m = d.getMinutes()
        let s = d.getSeconds()
        let pm = false
        if (twelve) {
            if (h === 0) h = 12
            else if (h > 12) {
                h -= 12
                pm = true
            }
        }
        const pad = (n: number) => String(n).padStart(2, "0")
        let timeStr = `${pad(h)}:${pad(m)}`
        if (seconds) timeStr += `:${pad(s)}`
        if (twelve) timeStr += pm ? " PM" : " AM"
        parts.push(timeStr)
    }
    return parts.join(" ").trim()
}

function buildTimerItem(item: Item, index: number, allItems: Item[], outputId: string, resolution: { width: number; height: number }, lineWindow: LineWindow): SceneTextItem | null {
    if (item.type !== "timer" && item.type !== "clock") return null
    if (!shouldItemBeShown(item, allItems, { outputId, type: "default" })) return null
    if (item.clickReveal && lineWindow.clickRevealed === false) return null

    const box = parseItemBox(percentageStylePos(item.style, resolution), { x: 0, y: 0, width: resolution.width, height: resolution.height })
    const base = parseTextStyle(item.style)

    const today = new Date()
    let value = ""

    if (item.type === "timer") {
        value = timerValueText(item, today)
        // overflow color not handled in engine (cosmetic)
    } else {
        const text = clockValueText(item, today)
        if (text === null) return null
        markSceneClock()
        value = text
    }

    if (!value) return null

    const fontSize = base.fontSize || 100
    const color = base.color || [1, 1, 1, 1]
    const spans = [sceneTextSpan({ text: value, fontFamily: base.fontFamily, fontSize, fontWeight: base.fontWeight ?? 400, fontStyle: base.fontStyle, color, underline: base.underline, strike: base.strike })]

    return sceneTextItem({
        id: item.id || `item-${index}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        align: parseTextAlign(item.align) || "center",
        verticalAlign: parseVerticalAlign(item.align),
        lineHeight: base.lineHeight || 1.1,
        fontFamily: base.fontFamily,
        fontSize,
        fontWeight: base.fontWeight ?? 400,
        fontStyle: base.fontStyle,
        color,
        letterSpacing: base.letterSpacing,
        text: value,
        spans,
        live: true,
        box: parseBoxStyle(item.style)
    })
}

// CONTADOR DE SLIDES, EVENTOS Y VARIABLES (F23.17): texto que el engine dibuja tal cual.

function buildDynamicTextItem(item: Item, index: number, allItems: Item[], outputId: string, resolution: { width: number; height: number }, lineWindow: LineWindow, dynamicRef: DynamicRef): SceneTextItem | null {
    if (item.type !== "slide_tracker" && item.type !== "events" && item.type !== "variable") return null
    if (!shouldItemBeShown(item, allItems, { outputId, type: "default" })) return null
    if (item.clickReveal && lineWindow.clickRevealed === false) return null

    const box = parseItemBox(percentageStylePos(item.style, resolution), { x: 0, y: 0, width: resolution.width, height: resolution.height })
    const base = parseTextStyle(item.style)
    const fontSize = base.fontSize || (item.type === "events" ? 80 : 100)
    const color = base.color || [1, 1, 1, 1]
    const plain = (text: string) => sceneTextSpan({ text, fontFamily: base.fontFamily, fontSize, fontWeight: base.fontWeight ?? 400, fontStyle: base.fontStyle, color, underline: base.underline, strike: base.strike })

    let spans: SceneTextSpan[] = []
    let boxStyle = parseBoxStyle(item.style)
    let live = true
    let defaultAlign: "left" | "center" = "center"
    if (item.type === "slide_tracker") {
        // sólo cambia con la slide, que ya dispara la transición: no es "live"
        live = false
        const parts = slideTrackerParts(item.tracker || {}, dynamicRef.slideIndex ?? -1, getLayoutRef(dynamicRef.showId, get(showsCache)).length)
        if (parts) {
            // la vista previa pinta el número actual con --accent (tracker.accent o, si no, --secondary del tema)
            const accent = item.tracker?.accent || getComputedStyle(document.documentElement).getPropertyValue("--secondary").trim()
            spans = [accent ? sceneTextSpan({ ...plain(parts.current), color: parseCssColor(accent, color) }) : plain(parts.current), plain(`/${parts.total}`)]
        }
    } else if (item.type === "events") {
        // los eventos terminados desaparecen con la hora: la escena se reenvía cada segundo
        markSceneClock()
        defaultAlign = "left"
        eventsLines(item.events || {}, Object.values(get(events)) as CalendarEvent[], new Date()).forEach((line, i) => {
            if (i > 0) spans.push(sceneTextSpan({ text: "\n" }))
            line.forEach((a) => spans.push(sceneTextSpan({ ...plain(a.text), fontSize: fontSize * (a.scale ?? 1), fontWeight: a.bold ? 700 : (base.fontWeight ?? 400), fontStyle: a.italic ? "italic" : base.fontStyle, fontFamily: a.family ?? base.fontFamily })))
        })
    } else {
        const variable = get(variables)[item.variable?.id || ""]
        let value = variableText(variable, false)
        if (value.includes("{")) {
            markSceneClock() // {time_}… cambian solos
            value = replaceDynamicValues(value, dynamicRef)
        }
        if (value) spans = [plain(value)]
        // la salida real mostraba la variable deshabilitada a opacidad 0.2
        if (variable?.enabled === false) boxStyle = { ...boxStyle, opacity: (boxStyle?.opacity ?? 1) * 0.2 }
    }
    const value = spans.map((s) => s.text).join("")
    if (!value) return null

    return sceneTextItem({
        id: item.id || `item-${index}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        align: parseTextAlign(item.align) || defaultAlign,
        verticalAlign: parseVerticalAlign(item.align),
        lineHeight: base.lineHeight || 1.1,
        fontFamily: base.fontFamily,
        fontSize,
        fontWeight: base.fontWeight ?? 400,
        fontStyle: base.fontStyle,
        color,
        letterSpacing: base.letterSpacing,
        text: value,
        spans,
        live,
        box: boxStyle
    })
}

// BACKGROUND

function getBackground(outputId: string, output: Output, currentStyle: ReturnType<typeof getCurrentStyle>, slide: OutSlide | null, layers: string[]): SceneBackground | null {
    if (!layers.includes("background")) return null

    const outBackground = output.out?.background || null
    const template = slide ? getStyleTemplate(slide, currentStyle) : null
    const templateBackground = template?.settings?.backgroundPath || ""
    const styleBackground = currentStyle.clearStyleBackgroundOnText && (slide || outBackground) ? "" : currentStyle.backgroundImage || ""

    const path = templateBackground || outBackground?.path || styleBackground
    if (!path) return null

    // cámaras, NDI, ventanas y players de la web no se pueden pintar todavía en el engine
    const outType = templateBackground || !outBackground?.path ? "" : outBackground.type || ""
    if (outType && !["media", "image", "video"].includes(outType)) return null

    const mediaType = getMediaType(getExtension(path))
    if (mediaType !== "image" && mediaType !== "video") return null

    const mediaStyle = getMediaStyle({ ...get(media)[path], ...(outBackground?.path === path ? outBackground : {}) } as any, currentStyle)
    const fit = mediaStyle.fit === "cover" ? "cover" : mediaStyle.fit === "fill" ? "fill" : "contain"

    return sceneBackground({ path, type: mediaType, fit, opacity: 1, loop: outBackground?.path === path ? outBackground.loop !== false : true, muted: outBackground?.muted, ...(mediaType === "video" ? videoSyncFields(get(playingVideoState)[`${path}_${outputId}`]) : {}) })
}

// TRANSITION

function getTransition(output: Output, currentStyle: ReturnType<typeof getCurrentStyle>, hasSlide: boolean): SceneTransition | null {
    const slide = output.out?.slide
    const ref = slide?.layout ? _show(slide.id).layouts([slide.layout]).ref()[0] || [] : []
    const slideData = slide ? ref[slide.index ?? -1]?.data || null : null

    const transitions = getOutputTransitions(slideData, currentStyle.transition, get(transitionData), false)
    const transition = hasSlide ? transitions.text : transitions.media
    if (!transition?.type) return null

    return sceneTransition({ type: transition.type, durationMs: Math.max(0, Math.round(transition.duration || 0)), easing: transition.easing || undefined })
}

// SCENE

/** Items de una slide (texto y medios), con las líneas visibles limitadas por el estilo. */
function buildSlideItems(showSlide: OutSlide, outputId: string, currentStyle: ReturnType<typeof getCurrentStyle>, resolution: { width: number; height: number }) {
    const slideItems = getSlideItems(showSlide, outputId, currentStyle)
    const lineWindow = getOutputLines(showSlide, currentStyle.lines)

    const items: SceneItem[] = []
    const textItems: SceneTextItem[] = []
    const dynamicRef: DynamicRef = { showId: showSlide.id, layoutId: showSlide.layout, slideIndex: showSlide.index ?? 0, type: "show" }
    slideItems.forEach((item, index) => {
        const textItem = buildTextItem(item, index, slideItems, dynamicRef, outputId, resolution, lineWindow)
        if (textItem) {
            items.push(textItem)
            textItems.push(textItem)
            return
        }

        const timerItem = buildTimerItem(item, index, slideItems, outputId, resolution, lineWindow)
        if (timerItem) {
            items.push(timerItem)
            textItems.push(timerItem)
            return
        }

        const dynamicItem = buildDynamicTextItem(item, index, slideItems, outputId, resolution, lineWindow, dynamicRef)
        if (dynamicItem) {
            items.push(dynamicItem)
            textItems.push(dynamicItem)
            return
        }

        const mediaItem = buildMediaItem(item, index, slideItems, outputId, resolution, lineWindow)
        if (mediaItem) items.push(mediaItem)
    })

    return { items, textItems, slideItems }
}

/** Texto plano de una slide: items visibles o, si no los hay, todo su texto (para stage). */
function plainTextOf(items: SceneTextItem[], slideItems: Item[]): string {
    let text = items.map((a) => a.text).join("\n")
    if (!text) text = slideItems.map((a) => getItemText(a)).join("\n")
    return text.trim()
}

// OVERLAYS (F4.6)

/** Sin límite de líneas y sin revelado: los overlays no participan del líneas del estilo. */
const OVERLAY_LINE_WINDOW: LineWindow = { start: null, end: null, clickRevealed: true }

/**
 * Items de la capa de overlays (F4.6): los ids activos en la salida, con el mismo criterio
 * que `Output.svelte` — overlays de la escena (siempre) más los activados en la salida si la
 * capa `overlays` está habilitada (y la escena no manda sobre las capas por no tener `style`).
 * La capa incluye también los overlays con `placeUnderSlide`, que el engine todavía no dibuja
 * debajo de la slide.
 */
function buildOverlayItems(outputId: string, output: Output, layers: string[], resolution: { width: number; height: number }): SceneItem[] {
    const scene = output.out?.scene || null
    const sceneHiddenOverlays = scene?.hiddenOverlays || []
    const sceneOverlays = (scene?.overlays || []).filter((id) => !sceneHiddenOverlays.includes(id))
    const sceneHideLayers = scene !== null && !scene.style
    const outputtedOverlayIds = sceneHideLayers ? [] : output.out?.overlays || []
    const overlayIds = [...new Set([...sceneOverlays, ...(layers.includes("overlays") ? outputtedOverlayIds : [])])]

    const items: SceneItem[] = []
    const overlayStore = get(overlays)
    // Overlay.svelte evalúa las condiciones de cada item sólo contra su propio texto (`allItems` = [])
    const noAllItems: Item[] = []

    overlayIds.forEach((overlayId) => {
        const overlay = overlayStore[overlayId]
        if (!Array.isArray(overlay?.items)) return

        const dynamicRef: DynamicRef = { type: "overlay", id: overlayId }
        overlay.items.forEach((item, index) => {
            const textItem = buildTextItem(item, index, noAllItems, dynamicRef, outputId, resolution, OVERLAY_LINE_WINDOW)
            if (textItem) {
                items.push(textItem)
                return
            }

            const timerItem = buildTimerItem(item, index, noAllItems, outputId, resolution, OVERLAY_LINE_WINDOW)
            if (timerItem) {
                items.push(timerItem)
                return
            }

            const mediaItem = buildMediaItem(item, index, noAllItems, outputId, resolution, OVERLAY_LINE_WINDOW)
            if (mediaItem) items.push(mediaItem)
        })
    })

    return items
}

export function buildSceneGraph(outputId: string, output: Output): SceneGraph {
    const currentStyle = getCurrentStyle(get(styles), output.style)
    const resolution = getOutputResolution(outputId, get(outputs), true, output.style || "")
    const layers = Array.isArray(currentStyle.layers) ? currentStyle.layers : defaultLayers

    const slide = output.out?.slide || null
    const showSlide = slide && layers.includes("slide") ? slide : null

    let items: SceneItem[] = []
    let plainText = ""

    if (showSlide) {
        const built = buildSlideItems(showSlide, outputId, currentStyle, resolution)
        items = built.items
        plainText = plainTextOf(built.textItems, built.slideItems)
    }

    return sceneGraphPayload({
        outputId,
        stage: !!output.stageOutput,
        width: resolution.width,
        height: resolution.height,
        background: getBackground(outputId, output, currentStyle, showSlide, layers),
        items,
        overlays: buildOverlayItems(outputId, output, layers, resolution),
        transition: getTransition(output, currentStyle, !!showSlide),
        plainText: plainText.trim(),
        // si la relación de aspecto no coincide con la ventana, el engine encuadra el contenido
        align: contentAlign(output.aspectRatio?.alignPosition, (currentStyle?.aspectRatio as { alignPosition?: string } | undefined)?.alignPosition)
    })
}

// STAGE

/** Id de la salida de audiencia que una salida stage refleja (su "fuente"). */
function getStageSourceOutputId(output: Output, outputsData: { [id: string]: Output }): string {
    const configuredId = get(stageShows)[output.stageOutput || ""]?.settings?.output || ""
    if (configuredId && outputsData[configuredId] && !outputsData[configuredId].stageOutput) return configuredId

    return (
        Object.keys(outputsData)
            .filter((id) => outputsData[id]?.enabled && !outputsData[id].stageOutput)
            .sort((a, b) => (outputsData[a].name || a).localeCompare(outputsData[b].name || b))[0] || ""
    )
}

/** Siguiente slide del layout (ignora las desactivadas); `null` si no hay. */
function getNextSlideRef(slide: OutSlide): OutSlide | null {
    if (!slide.id || slide.id === "temp" || slide.id === "tempText") return null

    const layoutRef = _show(slide.id).layouts([slide.layout]).ref()[0] || []
    let index = slide.index ?? -1
    do {
        index++
    } while (layoutRef[index]?.data?.disabled)
    if (!layoutRef[index]) return null

    return { id: slide.id, layout: slide.layout, index }
}

/** Textos de la escena de un layout de stage (F23.19): slides y notas sólo en las posiciones que usa el layout. */
function buildStageContext(layout: StageLayout, slide: OutSlide | null, sourceOutputId: string, currentStyle: ReturnType<typeof getCurrentStyle>, resolution: { width: number; height: number }): StageContext {
    const today = new Date()
    const ctx: StageContext = { resolution, slideTexts: [], slideNotes: [], currentIndex: 0, clockText: "", timerTexts: {}, variableTexts: {}, trackerText: null, positionStyle: (style) => percentageStylePos(style, resolution) }
    const items = Object.entries(layout.items || {}).filter(([, item]) => item && item.enabled !== false) as [string, StageItem][]

    // las slides desactivadas se saltean; la actual cuenta aunque esté desactivada
    const refs = slide && (slide.type || "show") === "show" ? _show(slide.id).layouts([slide.layout]).ref()[0] || [] : []
    const enabled = refs.map((ref, index) => ({ ref, index })).filter(({ ref, index }) => !ref.data?.disabled || index === slide?.index)
    const current = slide ? enabled.findIndex(({ index }) => index === slide.index) : -1
    ctx.currentIndex = Math.max(current, 0)

    items.forEach(([key, item]) => {
        const type = stageItemType(key, item)
        if (type === "slide_text" || type === "slide_notes") {
            const position = ctx.currentIndex + slideOffsetOf(key, item)
            const target = current >= 0 ? enabled[position] : undefined
            if (!slide || !target || ctx.slideTexts[position] !== undefined || ctx.slideNotes[position] !== undefined) return
            const built = buildSlideItems({ id: slide.id, layout: slide.layout, index: target.index }, sourceOutputId, currentStyle, resolution)
            ctx.slideTexts[position] = plainTextOf(built.textItems, built.slideItems)
            ctx.slideNotes[position] = get(showsCache)[slide.id]?.slides?.[target.ref.id]?.notes || ""
        } else if (type === "clock") {
            markSceneClock()
            ctx.clockText ||= clockValueText(item as unknown as Item, today) || ""
        } else if (type === "timer") {
            markSceneClock()
            const id = stageRefId(key, item)
            // como Stagebox: el ítem antiguo del "primer timer activo" usa el primero que corre o, si no, el primero que no es contador
            const timerId = id === "first_active_timer" ? get(activeTimers)[0]?.id || Object.entries(get(timers)).find(([, timer]) => timer.type !== "counter")?.[0] || "" : id
            ctx.timerTexts[id] = timerValueText({ ...item, timer: { ...(item.timer || {}), id: timerId } } as unknown as Item, today)
        } else if (type === "variable") {
            // Stagebox muestra las variables con `hideText`: un texto deshabilitado no se ve
            const id = stageRefId(key, item)
            let value = variableText(get(variables)[id], true)
            if (value.includes("{")) {
                markSceneClock() // {time_}… cambian solos
                value = replaceDynamicValues(value, { type: "stage", id: key })
            }
            ctx.variableTexts[id] = value
        } else if (type === "slide_tracker" && slide) {
            ctx.trackerText = slideTrackerText(item.tracker || {}, slide.index ?? -1, refs.length)
        }
    })

    return ctx
}

/**
 * Escena de una salida stage. Con un layout con ítems (F23.19) la escena trae `items`, que el engine dibuja como
 * los de una audiencia; sin ellos, el engine sólo usa `plainText`/`nextText` (F2.4), que se calculan sobre la
 * salida de audiencia fuente (mismo criterio que `receiveSTAGE.OUT` en `utils/stageTalk.ts`).
 */
function buildStageScene(outputId: string, output: Output, outputsData: { [id: string]: Output }): SceneGraph {
    const sourceOutputId = getStageSourceOutputId(output, outputsData)
    const sourceOutput = sourceOutputId ? outputsData[sourceOutputId] : null
    const currentStyle = getCurrentStyle(get(styles), sourceOutput?.style)
    const resolution = getOutputResolution(outputId, outputsData, true, output.style || "")

    let plainText = ""
    let nextText = ""

    const slide = sourceOutput?.out?.slide || null
    if (slide && (slide.type || "show") === "show") {
        const current = buildSlideItems(slide, sourceOutputId, currentStyle, resolution)
        plainText = plainTextOf(current.textItems, current.slideItems)

        const nextSlide = getNextSlideRef(slide)
        if (nextSlide) {
            const next = buildSlideItems(nextSlide, sourceOutputId, currentStyle, resolution)
            nextText = plainTextOf(next.textItems, next.slideItems)
        }
    }

    const layout = get(stageShows)[output.stageOutput || ""]
    const items = layout && Object.keys(layout.items || {}).length ? buildStageItems(layout, buildStageContext(layout, slide, sourceOutputId, currentStyle, resolution)) : []

    return sceneGraphPayload({
        outputId,
        stage: true,
        width: resolution.width,
        height: resolution.height,
        background: null,
        items,
        overlays: [],
        transition: null,
        plainText,
        nextText
    })
}

// PREFETCH (F19.2)

/** Cuántas slides hacia adelante se precargan. */
const PREFETCH_AHEAD = 2

/** Imágenes de las próximas slides de una salida de audiencia (items de medio y fondo de la plantilla). */
function nextSlidesImagePaths(outputId: string, output: Output): string[] {
    const currentStyle = getCurrentStyle(get(styles), output.style)
    const layers = Array.isArray(currentStyle.layers) ? currentStyle.layers : defaultLayers
    const slide = output.out?.slide
    if (!slide || !layers.includes("slide")) return []

    const resolution = getOutputResolution(outputId, get(outputs), true, output.style || "")
    const paths: string[] = []
    let next = getNextSlideRef(slide)
    for (let ahead = 0; ahead < PREFETCH_AHEAD && next; ahead++) {
        const built = buildSlideItems(next, outputId, currentStyle, resolution)
        const background = getStyleTemplate(next, currentStyle)?.settings?.backgroundPath || ""
        const backgroundIsImage = background && getMediaType(getExtension(background)) === "image"
        paths.push(...imagePathsOf(built.items, backgroundIsImage ? [background] : []))
        next = getNextSlideRef(next)
    }
    return paths
}

// SEND

/**
 * Envía al engine nativo una escena por cada salida habilitada, con su `outputId`.
 * F2.4: el motor rutea la escena por id y la mantiene persistente por pantalla;
 * las salidas stage reciben su propia escena con `plainText` (slide actual de su
 * salida fuente) y `nextText` (slide siguiente).
 */
export function sendOutputScenes(outputsData: { [id: string]: Output } = get(outputs)) {
    resetSceneClock()
    const ids = Object.keys(outputsData || {})
        .filter((id) => outputsData[id]?.enabled)
        .sort((a, b) => (outputsData[a].name || a).localeCompare(outputsData[b].name || b))

    if (!ids.length) return

    ids.forEach((id) => {
        try {
            const sourceId = getSceneSourceId(id, outputsData)
            const source = outputsData[sourceId]
            const scene = source.stageOutput ? buildStageScene(sourceId, source, outputsData) : buildSceneGraph(sourceId, source)
            send(OUTPUT, ["RENDER_SCENE"], { ...scene, outputId: id })
        } catch (err) {
            console.error("[sceneGraph] could not build scene for output", id, err)
        }
    })

    prefetchNextSlides(ids, outputsData)
}

/** Pide al engine las imágenes de las próximas slides de las audiencias (sin repetir entre salidas). */
function prefetchNextSlides(ids: string[], outputsData: { [id: string]: Output }) {
    const paths: string[] = []
    ids.forEach((id) => {
        try {
            const sourceId = getSceneSourceId(id, outputsData)
            const source = outputsData[sourceId]
            if (!source || source.stageOutput) return
            nextSlidesImagePaths(sourceId, source).forEach((path) => {
                if (!paths.includes(path)) paths.push(path)
            })
        } catch (err) {
            console.error("[sceneGraph] could not collect prefetch paths for output", id, err)
        }
    })

    if (paths.length) send(OUTPUT, ["RENDER_PREFETCH"], { paths } satisfies PrefetchPayload)
}
