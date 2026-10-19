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
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { SceneBackground, SceneGraph, SceneItem, SceneMediaItem, SceneTextItem, SceneTextSpan, SceneTransition } from "../../../types/SceneGraph"
import type { Item, OutSlide, Slide } from "../../../types/Show"
import { media, overlays, outputs, stageShows, styles, transitionData } from "../../stores"
import { send } from "../../utils/request"
import { getItemText } from "../edit/scripts/textStyle"
import { shouldItemBeShown } from "../edit/scripts/itemHelpers"
import { clone } from "./array"
import { getExtension, getMediaStyle, getMediaType } from "./media"
import { defaultLayers, getCurrentStyle, getOutputLines, getOutputResolution, getOutputTransitions, getStyleTemplate, percentageStylePos, setTemplateStyle } from "./output"
import { _show } from "./shows"
import { replaceDynamicValues } from "./showActions"
import { applyTextTransform, parseItemBox, parseTextAlign, parseTextStyle, parseVerticalAlign, type ParsedTextStyle } from "./sceneStyle"
import { sceneBackground, sceneGraphPayload, sceneMediaItem, sceneTextItem, sceneTextSpan, sceneTransition } from "./sceneGraphPayload"

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
                    color: partStyle.color
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
        text,
        spans
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

    return sceneMediaItem({ id: item.id, x: box.x, y: box.y, width: box.width, height: box.height, src, mediaType, fit, opacity: 1 })
}

// BACKGROUND

function getBackground(output: Output, currentStyle: ReturnType<typeof getCurrentStyle>, slide: OutSlide | null, layers: string[]): SceneBackground | null {
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

    return sceneBackground({ path, type: mediaType, fit, opacity: 1, loop: outBackground?.path === path ? outBackground.loop !== false : true, muted: outBackground?.muted })
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
        background: getBackground(output, currentStyle, showSlide, layers),
        items,
        overlays: buildOverlayItems(outputId, output, layers, resolution),
        transition: getTransition(output, currentStyle, !!showSlide),
        plainText: plainText.trim()
    })
}

// STAGE

/** Id de la salida de audiencia que una salida stage refleja (su "fuente"). */
function getStageSourceOutputId(output: Output, outputsData: { [id: string]: Output }): string {
    const configuredId = stageShows[output.stageOutput || ""]?.settings?.output || ""
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

/**
 * Escena de una salida stage (F2.4): el engine sólo usa `plainText`/`nextText`,
 * que se calculan sobre la salida de audiencia fuente (mismo criterio que
 * `receiveSTAGE.OUT` en `utils/stageTalk.ts`).
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

    return sceneGraphPayload({
        outputId,
        stage: true,
        width: resolution.width,
        height: resolution.height,
        background: null,
        items: [],
        overlays: [],
        transition: null,
        plainText,
        nextText
    })
}

// SEND

/**
 * Envía al engine nativo una escena por cada salida habilitada, con su `outputId`.
 * F2.4: el motor rutea la escena por id y la mantiene persistente por pantalla;
 * las salidas stage reciben su propia escena con `plainText` (slide actual de su
 * salida fuente) y `nextText` (slide siguiente).
 */
export function sendOutputScenes(outputsData: { [id: string]: Output } = get(outputs)) {
    const ids = Object.keys(outputsData || {})
        .filter((id) => outputsData[id]?.enabled)
        .sort((a, b) => (outputsData[a].name || a).localeCompare(outputsData[b].name || b))

    if (!ids.length) return

    ids.forEach((id) => {
        try {
            const scene = outputsData[id].stageOutput ? buildStageScene(id, outputsData[id], outputsData) : buildSceneGraph(id, outputsData[id])
            send(OUTPUT, ["RENDER_SCENE"], scene)
        } catch (err) {
            console.error("[sceneGraph] could not build scene for output", id, err)
        }
    })
}
