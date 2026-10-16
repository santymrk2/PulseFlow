// Construye el Scene Graph (src/types/SceneGraph.ts) de una salida a partir del estado de Svelte
// y lo envía al engine de render nativo (Rust) con `RENDER_SCENE`.
//
// Reutiliza la misma lógica que el render HTML de la UI de control: layout/slide de la show,
// plantilla del estilo de salida (setTemplateStyle), resolución (getOutputResolution), líneas visibles
// (getOutputLines), valores dinámicos (replaceDynamicValues) y transiciones (getOutputTransitions).

import { get } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { SceneBackground, SceneGraph, SceneTextItem, SceneTextSpan, SceneTransition } from "../../../types/SceneGraph"
import type { Item, OutSlide, Slide } from "../../../types/Show"
import { media, outputs, styles, transitionData } from "../../stores"
import { send } from "../../utils/request"
import { getItemText } from "../edit/scripts/textStyle"
import { shouldItemBeShown } from "../edit/scripts/itemHelpers"
import { clone } from "./array"
import { getExtension, getMediaStyle, getMediaType } from "./media"
import { defaultLayers, getCurrentStyle, getOutputLines, getOutputResolution, getOutputTransitions, getStyleTemplate, percentageStylePos, setTemplateStyle } from "./output"
import { _show } from "./shows"
import { replaceDynamicValues } from "./showActions"
import { applyTextTransform, parseItemBox, parseTextAlign, parseTextStyle, parseVerticalAlign, type ParsedTextStyle } from "./sceneStyle"

const DEFAULT_FONT_SIZE = 100
const DEFAULT_LINE_HEIGHT = 1.1

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

function buildTextItem(item: Item, index: number, allItems: Item[], slide: OutSlide, outputId: string, resolution: { width: number; height: number }, lineWindow: ReturnType<typeof getOutputLines>): SceneTextItem | null {
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
    const dynamicRef = { showId: slide.id, layoutId: slide.layout, slideIndex: slide.index ?? 0, type: "show" }

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

            const span: SceneTextSpan = { text: value }
            if (partStyle.fontFamily) span.fontFamily = partStyle.fontFamily
            if (partStyle.fontSize) span.fontSize = partStyle.fontSize
            if (partStyle.fontWeight !== undefined) span.fontWeight = partStyle.fontWeight
            if (partStyle.fontStyle) span.fontStyle = partStyle.fontStyle
            if (partStyle.color) span.color = partStyle.color
            spans.push(span)
        })

        if (lineIndex < visibleLines.length - 1) spans.push({ text: "\n" })
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

    const textItem: SceneTextItem = {
        type: "text",
        id: item.id || `item-${index}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        align: align || "center",
        verticalAlign: parseVerticalAlign(item.align),
        lineHeight: lineHeight || DEFAULT_LINE_HEIGHT,
        fontSize,
        fontWeight: resolved.fontWeight ?? 400,
        color: resolved.color || [1, 1, 1, 1],
        text,
        spans
    }
    if (resolved.fontFamily) textItem.fontFamily = resolved.fontFamily
    if (resolved.fontStyle) textItem.fontStyle = resolved.fontStyle
    if (resolved.strokeWidth && resolved.strokeWidth > 0) textItem.stroke = { color: resolved.strokeColor || [0, 0, 0, 1], width: resolved.strokeWidth }
    if (resolved.shadow) textItem.shadow = resolved.shadow

    return textItem
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

    return { path, type: mediaType, fit, opacity: 1, loop: outBackground?.path === path ? outBackground.loop !== false : true, muted: outBackground?.muted }
}

// TRANSITION

function getTransition(output: Output, currentStyle: ReturnType<typeof getCurrentStyle>, hasSlide: boolean): SceneTransition | null {
    const slide = output.out?.slide
    const ref = slide?.layout ? _show(slide.id).layouts([slide.layout]).ref()[0] || [] : []
    const slideData = slide ? ref[slide.index ?? -1]?.data || null : null

    const transitions = getOutputTransitions(slideData, currentStyle.transition, get(transitionData), false)
    const transition = hasSlide ? transitions.text : transitions.media
    if (!transition?.type) return null

    return { type: transition.type, durationMs: Math.max(0, Math.round(transition.duration || 0)), easing: transition.easing || undefined }
}

// SCENE

export function buildSceneGraph(outputId: string, output: Output): SceneGraph {
    const currentStyle = getCurrentStyle(get(styles), output.style)
    const resolution = getOutputResolution(outputId, get(outputs), true, output.style || "")
    const layers = Array.isArray(currentStyle.layers) ? currentStyle.layers : defaultLayers

    const slide = output.out?.slide || null
    const showSlide = slide && layers.includes("slide") ? slide : null

    const items: SceneTextItem[] = []
    let plainText = ""

    if (showSlide) {
        const slideItems = getSlideItems(showSlide, outputId, currentStyle)
        const lineWindow = getOutputLines(showSlide, currentStyle.lines)
        slideItems.forEach((item, index) => {
            const textItem = buildTextItem(item, index, slideItems, showSlide, outputId, resolution, lineWindow)
            if (textItem) items.push(textItem)
        })
        plainText = items.map((a) => a.text).join("\n")
        // fallback si ningún item de texto es visible pero la slide tiene texto (stage)
        if (!plainText) plainText = slideItems.map((a) => getItemText(a)).join("\n")
    }

    return {
        outputId,
        stage: !!output.stageOutput,
        width: resolution.width,
        height: resolution.height,
        background: getBackground(output, currentStyle, showSlide, layers),
        items,
        transition: getTransition(output, currentStyle, !!showSlide),
        plainText: plainText.trim()
    }
}

// SEND

/**
 * Envía al engine nativo la escena de la salida principal (la primera activa que no sea stage).
 * El engine sólo tiene una ventana de audiencia: con varias salidas, las demás se ignoran por ahora.
 * El Stage Display se alimenta con el texto de esta misma escena (`plainText`).
 */
export function sendOutputScenes(outputsData: { [id: string]: Output } = get(outputs)) {
    const ids = Object.keys(outputsData || {})
        .filter((id) => outputsData[id]?.enabled && !outputsData[id].stageOutput)
        .sort((a, b) => (outputsData[a].name || a).localeCompare(outputsData[b].name || b))

    const mainId = ids.find((id) => outputsData[id].active) || ids[0]
    if (!mainId) return

    try {
        send(OUTPUT, ["RENDER_SCENE"], buildSceneGraph(mainId, outputsData[mainId]))
    } catch (err) {
        console.error("[sceneGraph] could not build scene for output", mainId, err)
    }
}
