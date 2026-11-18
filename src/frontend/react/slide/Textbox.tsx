import { useEffect, useRef, useState, type CSSProperties } from "react"
import { OUTPUT } from "../../../types/Channels"
import type { Styles } from "../../../types/Settings"
import type { Item, Slide, Transition } from "../../../types/Show"
import { groups, outputs, overlays, scriptureSettings, showsCache, styles as stylesStore, templates, variables } from "../../stores"
import { wait } from "../../utils/common"
import { send } from "../../utils/request"
import autosize from "../../components/edit/scripts/autosize"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { getActiveOutputs, getAllActiveOutputs, getFirstActiveOutput, getOutputLines, getOutputResolution, percentageStylePos } from "../../components/helpers/output"
import { createCSSVariables } from "../../components/helpers/showActions"
import { isCroppedItem } from "../../components/helpers/cropping"
import { getStyles, getItemStyle } from "../../components/helpers/style"
import { readAutoSizeCache, writeAutoSizeCache } from "../../components/slide/autosizeCache"
import { cn } from "../../lib/utils"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import { SlideItems } from "./SlideItems"
import { TextboxLines, type HighlightedLine } from "./TextboxLines"
import css from "./Textbox.module.css"

export interface TextboxRef {
    type?: "show" | "stage" | "overlay" | "template"
    showId?: string
    slideId?: string
    layoutId?: string
    origin?: string
    id: string
}

interface StageItemLike {
    type?: string
    style?: string
    textFit?: "shrinkToFit" | "growToFit" | "none"
    lines?: Item["lines"]
    chords?: { size?: number; color?: string; offsetY?: number }
    chordsData?: { size?: number; color?: string; offsetY?: number }
}

interface ScriptureReference {
    type?: string
    data?: { translations?: number | string; version?: string }
}

interface HighlightedLineBox extends HighlightedLine {
    styleLines: number
}

export interface TextboxProps {
    item: Item
    itemIndex?: number
    slideIndex?: number
    preview?: boolean
    miniPreview?: boolean
    isTemplatePreview?: boolean
    mirror?: boolean
    isOutputted?: boolean
    ratio?: number
    outputId?: string
    filter?: string
    backdropFilter?: string
    /** Equivale al `key` del Svelte original (alpha key output); se renombra porque React reserva `key`. */
    alphaKey?: boolean
    transition?: Transition | null
    smallFontSize?: boolean
    animationStyle?: { item?: string; text?: string }
    dynamicValues?: boolean
    isStage?: boolean
    originalStyle?: boolean
    useOriginalTextColor?: boolean
    customFontSize?: number | null
    outputStyle?: Styles | null
    ref: TextboxRef
    style?: boolean
    customStyle?: string
    stageItem?: StageItemLike
    chords?: boolean
    linesStart?: number | null
    linesEnd?: number | null
    clickRevealed?: boolean
    stageAutoSize?: boolean
    fontSize?: number
    maxLines?: number
    maxLinesInvert?: boolean
    centerPreview?: boolean
    revealed?: number
    styleIdOverride?: string
    autoSizeKey?: string
    updateDynamicValues?: boolean
    onAutosizeReady?: (detail: { key: string; fontSize: number }) => void
}

function getAlphaValues(colorValue: string | undefined) {
    if (!colorValue) return 0
    const alpha = colorValue.includes("#") ? alphaFromHex(colorValue) : colorValue.includes("rgb") ? alphaFromRgb(colorValue) : 0
    return alpha || 0
}

function alphaFromHex(colorValue: string) {
    const match = colorValue.match(/^#([0-9a-f]{2})[0-9a-f]{6}$/i)
    if (!match) return 1
    return parseInt(match[1], 16) / 255
}

function alphaFromRgb(colorValue: string) {
    if (colorValue.includes(",")) return parseFloat(colorValue.split(",")[3])
    if (colorValue.includes("/")) return parseFloat(colorValue.substring(colorValue.indexOf("/") + 1))
    return 1
}

function getScriptureTranslationCount(reference: ScriptureReference | null) {
    if (!reference?.data) return 1
    if (reference.data.translations !== undefined) return Number(reference.data.translations) || 1
    const versionList = typeof reference.data.version === "string" ? reference.data.version.split("+") : []
    return versionList.filter((value) => value.trim().length).length || 1
}

function buildScriptureTranslationKey(reference: ScriptureReference | null) {
    const translationCount = getScriptureTranslationCount(reference)
    if (translationCount <= 1) return ""
    return `_${Math.min(4, translationCount)}`
}

function getPaddingCorrection(stageItem: StageItemLike | undefined) {
    if (typeof stageItem?.style !== "string" || !stageItem.style.includes("padding")) return ""
    const match = stageItem.style.match(/(?:^|;)\s*padding:\s*(\d+)px/)
    if (match?.[1]) {
        const padding = parseInt(match[1], 10) * 2
        if (padding > 0) return `width: calc(100% - ${padding}px); height: calc(100% - ${padding}px);`
    }
    return ""
}

// Port de components/slide/Textbox.svelte (F24.18b). La medición DOM y la escritura de
// `item.autoFontSize` se conservan: `sceneGraph.ts:124-127` consume ese valor en el proyector.
export function Textbox({
    item,
    itemIndex = -1,
    slideIndex = 0,
    preview = false,
    miniPreview = false,
    isTemplatePreview = false,
    mirror = true,
    isOutputted = false,
    ratio = 1,
    outputId = "",
    filter = "",
    backdropFilter = "",
    alphaKey = false,
    transition = null,
    smallFontSize = false,
    animationStyle = {},
    dynamicValues = true,
    isStage = false,
    originalStyle = false,
    useOriginalTextColor = false,
    customFontSize = null,
    outputStyle = null,
    ref,
    style = true,
    customStyle = "",
    stageItem,
    chords = false,
    linesStart = null,
    linesEnd = null,
    clickRevealed = false,
    stageAutoSize = false,
    fontSize: initialFontSize = 0,
    maxLines = 0,
    maxLinesInvert = false,
    centerPreview = false,
    revealed = -1,
    styleIdOverride = "",
    autoSizeKey = "",
    updateDynamicValues = true,
    onAutosizeReady
}: TextboxProps) {
    const currentGroups = useStore(groups)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentScriptureSettings = useStore(scriptureSettings)
    const currentShows = useStore(showsCache)
    const currentStyles = useStore(stylesStore)
    const currentTemplates = useStore(templates)
    const currentVariables = useStore(variables)

    const [fontSize, setFontSize] = useState(initialFontSize)
    const [loaded, setLoaded] = useState(false)
    const [hideUntilAutosized, setHideUntilAutosized] = useState(false)
    const [hidden, setHidden] = useState(false)
    const [updateTrigger, setUpdateTrigger] = useState(0)

    const itemElem = useRef<HTMLDivElement | null>(null)
    const autoSizeReady = useRef(false)
    const lastRenderedSignature = useRef("")
    const prevAutosizeSignature = useRef("")
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hideSafetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const calculateRef = useRef<() => Promise<void>>(async () => {})

    let localLinesStart = linesStart
    let localLinesEnd = linesEnd
    let lines = clone(item?.lines)
    if (localLinesStart !== null && localLinesEnd !== null && lines?.length) {
        lines = lines.filter((line) => Array.isArray(line.text) && line.text.filter((text) => text.value !== undefined)?.length)
        if (!lines[localLinesStart]) {
            const linesCount = localLinesEnd - localLinesStart
            const length = lines.length - 1
            const index = length - (length % linesCount)
            localLinesStart = index
            localLinesEnd = index + linesCount
        }
    }

    const customOutputId = outputId || getActiveOutputs(currentOutputs, true, true, true)[0] || ""
    const slideData = ref?.showId ? (currentShows[ref.showId]?.slides?.[ref.slideId || ref.id] as Slide | undefined) || null : null
    const showReference = ref?.showId ? (currentShows[ref.showId]?.reference as ScriptureReference | undefined) || null : null
    const groupTemplateId = (() => {
        if (!slideData) return ""
        const groupId = slideData.globalGroup && slideData.globalGroup !== "none" ? slideData.globalGroup : slideData.group
        if (!groupId) return ""
        return currentGroups[groupId]?.template || ""
    })()
    const isScriptureContext = ref?.id === "scripture" || ref?.showId === "temp" || (showReference?.type || "") === "scripture"
    const scriptureTranslationKey = isScriptureContext ? buildScriptureTranslationKey(showReference) : ""
    const styleScriptureTemplateId = (() => {
        if (!isScriptureContext || !outputStyle) return ""
        const translationTemplate = scriptureTranslationKey ? (outputStyle[`templateScripture${scriptureTranslationKey}` as keyof Styles] as string | undefined) : undefined
        return translationTemplate || outputStyle.templateScripture || ""
    })()
    const scriptureSettingsTemplateId = ref?.id === "scripture" || ref?.showId === "temp" ? currentScriptureSettings.template || "" : ""
    const currentShowTemplateId = currentShows[ref.showId || ""]?.settings?.template || ""
    const isFirstLayoutSlide = (() => {
        if (!ref?.showId) return false
        const slideId = ref.slideId || ref.id
        if (!slideId) return false
        const layoutId = ref.layoutId || currentShows[ref.showId]?.settings?.activeLayout || ""
        if (!layoutId) return false
        const layout = currentShows[ref.showId]?.layouts?.[layoutId]
        const firstId = layout?.slides?.[0]?.id || ""
        return !!firstId && firstId === slideId
    })()

    function resolveTemplate(baseId: string) {
        if (!baseId) return ""
        if (isFirstLayoutSlide) {
            const firstSlideTemplateId = currentTemplates[baseId]?.settings?.firstSlideTemplate || ""
            if (firstSlideTemplateId) return firstSlideTemplateId
        }
        return baseId
    }

    const resolvedTemplateId = (() => {
        if (ref?.type === "template" && ref.id) return ref.id
        if (ref?.type === "overlay") return ""
        if (slideData?.settings?.template) return slideData.settings.template
        const styleResolved = resolveTemplate(isScriptureContext ? styleScriptureTemplateId : outputStyle?.template || "")
        if (styleResolved) return styleResolved
        const groupResolved = resolveTemplate(groupTemplateId)
        if (groupResolved) return groupResolved
        const showResolved = resolveTemplate(currentShowTemplateId)
        if (showResolved) return showResolved
        return resolveTemplate(scriptureSettingsTemplateId)
    })()
    const templateStyleOverrides = resolvedTemplateId ? clone(currentTemplates[resolvedTemplateId]?.settings?.styleOverrides || []) : []

    const chordLines = chords && Array.isArray(item?.lines) ? item.lines.filter((line) => line.chords?.length && line.text) : []

    function deriveCustomTypeRatio() {
        const sourceLines: Item["lines"] | undefined = isStage ? stageItem?.lines : item?.lines
        const allText = (sourceLines || []).flatMap((line) => (line?.text ? line.text : []))
        if (!allText.length) return 1
        const verseItemText = allText.filter((text) => text.customType?.includes("disableTemplate"))
        if (!verseItemText.length) return 1
        const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
        if (isStage) {
            const stageFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100
            return stageFontSize ? verseItemSize / stageFontSize || 1 : 1
        }
        return verseItemSize ? verseItemSize / 100 || 1 : 1
    }
    const customTypeRatio = deriveCustomTypeRatio()

    const stateSignature = `${item?.id || itemIndex}_${resolvedTemplateId}_${item?.lines?.length || 0}`
    const autosizeSignature = `${isStage ? stageItem?.style || "" : item?.style || ""}_${resolvedTemplateId}_${chordLines.length ? 1 : 0}_${stageAutoSize ? 1 : 0}_${item?.textFit || ""}_${stageItem?.textFit || ""}_${JSON.stringify(item?.lines || stageItem?.lines || "")}_${ratio}`
    const isDynamicText = getItemText(stageItem ? ({ lines: stageItem.lines } as Item) : item).includes("{")
    const outputSlide = getFirstActiveOutput(currentOutputs)?.out?.slide

    function buildAutoSizeCacheKey() {
        if (!autoSizeKey && !ref?.id) return ""
        const base = autoSizeKey || `${ref?.id || ""}-${item?.id || itemIndex}`
        return `${isStage ? "stage" : ref?.type || "show"}:${base}`
    }

    function buildAutoSizeSignature(measuredWidth?: number, measuredHeight?: number, customChords?: boolean) {
        const activeStyle = (isStage && stageItem?.style ? stageItem.style : item?.style) || ""
        const activeStyles = activeStyle ? getStyles(activeStyle) : {}
        const boxDimensions: Record<string, unknown> = {
            width: activeStyles.width,
            height: activeStyles.height,
            left: activeStyles.left,
            top: activeStyles.top,
            fontSize: activeStyles["font-size"]
        }
        if (preview) {
            boxDimensions.measuredWidth = measuredWidth ? Math.round(measuredWidth / 5) * 5 : 0
            boxDimensions.measuredHeight = measuredHeight ? Math.round(measuredHeight / 5) * 5 : 0
        }
        if (!preview && !isStage && itemElem.current?.parentElement) {
            const container = itemElem.current.parentElement
            boxDimensions.containerWidth = container.clientWidth ? Math.round(container.clientWidth / 5) * 5 : 0
            boxDimensions.containerHeight = container.clientHeight ? Math.round(container.clientHeight / 5) * 5 : 0
        }
        return JSON.stringify({
            lines: item?.lines || null,
            style: activeStyle,
            boxDimensions,
            textFit: item?.textFit || "none",
            list: item?.list || null,
            chords: !!(customChords !== undefined ? customChords : chordLines.length > 0),
            stageAutoSize: !!stageAutoSize,
            stageItem: stageItem || null,
            fontSizeOverride: customFontSize || null,
            ratio: ratio && ratio >= 0.02 ? Math.round(ratio * 10) / 10 : 0.1,
            outputStyle: outputStyle || null,
            styleIdOverride: styleIdOverride || "",
            mirror: !!mirror,
            preview: !!preview,
            smallFontSize: !!smallFontSize,
            maxLines: maxLines || 0,
            maxLinesInvert: !!maxLinesInvert,
            centerPreview: !!centerPreview,
            resolvedTemplateId: resolvedTemplateId || ""
        })
    }

    function shouldHideUntilAutoSizeCompletes() {
        if (preview || isStage) return false
        const isTextItem = (item?.type || "text") === "text"
        const textFit = item?.textFit || (item?.auto ? (isTextItem ? "shrinkToFit" : "growToFit") : "none")
        if (textFit === "none") return false
        const cacheKey = buildAutoSizeCacheKey()
        if (!cacheKey) return true
        const cacheSignature = buildAutoSizeSignature(itemElem.current?.clientWidth, itemElem.current?.clientHeight, chordLines.length > 0)
        const cached = readAutoSizeCache(cacheKey)
        return !(cached && cached.signature === cacheSignature)
    }

    function markAutoSizeReady(value: number) {
        if (autoSizeReady.current) return
        autoSizeReady.current = true
        if (autoSizeKey) onAutosizeReady?.({ key: autoSizeKey, fontSize: value })
        if (hideUntilAutosized) globalThis.requestAnimationFrame?.(() => setHideUntilAutosized(false))
    }

    function setItemAutoFontSize(value: number) {
        if (isStage || itemIndex < 0 || ref.showId === "temp") return
        if (ref.type === "overlay") {
            const target = currentOverlays[ref.id]?.items?.[itemIndex]
            if (!target || target.autoFontSize === value) return
            overlays.update((all) => {
                const current = all[ref.id]?.items?.[itemIndex]
                if (current) current.autoFontSize = value
                return all
            })
        } else if (ref.type === "template") {
            const target = currentTemplates[ref.id]?.items?.[itemIndex]
            if (!target || target.autoFontSize === value) return
            templates.update((all) => {
                const current = all[ref.id]?.items?.[itemIndex]
                if (current) current.autoFontSize = value
                return all
            })
        } else if (ref.showId) {
            const target = currentShows[ref.showId]?.slides?.[ref.id]?.items?.[itemIndex]
            if (!target || target.autoFontSize === value) return
            showsCache.update((all) => {
                const current = all[ref.showId!]?.slides?.[ref.id]?.items?.[itemIndex]
                if (current) current.autoFontSize = value
                return all
            })
        }
    }

    function setItemPreviewAutoFontSize(value: number) {
        if (isStage || itemIndex < 0 || ref.showId === "temp") return
        if (ref.type === "overlay") {
            const target = currentOverlays[ref.id]?.items?.[itemIndex]
            if (!target || target.previewAutoFontSize === value) return
            overlays.update((all) => {
                const current = all[ref.id]?.items?.[itemIndex]
                if (current) current.previewAutoFontSize = value
                return all
            })
        } else if (ref.type === "template") {
            const target = currentTemplates[ref.id]?.items?.[itemIndex]
            if (!target || target.previewAutoFontSize === value) return
            templates.update((all) => {
                const current = all[ref.id]?.items?.[itemIndex]
                if (current) current.previewAutoFontSize = value
                return all
            })
        } else if (ref.showId) {
            const target = currentShows[ref.showId]?.slides?.[ref.id]?.items?.[itemIndex]
            if (!target || target.previewAutoFontSize === value) return
            showsCache.update((all) => {
                const current = all[ref.showId!]?.slides?.[ref.id]?.items?.[itemIndex]
                if (current) current.previewAutoFontSize = value
                return all
            })
        }
    }

    async function calculateAutosize() {
        if (item.type === "media" || item.type === "camera" || item.type === "icon") return
        if (isStage && !stageAutoSize) return

        const isTextItem = (item.type || "text") === "text"
        let textFit = item.textFit || (isTextItem ? (item?.auto ? "shrinkToFit" : "none") : "growToFit")
        if (textFit === "none" && !isStage) {
            setFontSize(0)
            markAutoSizeReady(0)
            return
        }

        if (!itemElem.current) return
        const isDynamic = isTextItem && getItemText(isStage ? ({ lines: stageItem?.lines } as Item) : item).includes("{")
        const cacheKey = buildAutoSizeCacheKey()
        const cacheSignature = buildAutoSizeSignature(undefined, undefined, chordLines.length > 0)
        const cached = cacheKey ? readAutoSizeCache(cacheKey) : undefined
        const useCache = !isDynamic && chordLines.length === 0 && !Number(outputStyle?.lines || 0)

        if (useCache && cached && cached.signature === cacheSignature) {
            setFontSize(cached.fontSize)
            if (item.type === "slide_tracker") {
                markAutoSizeReady(cached.fontSize)
                return
            }
            if (cached.fontSize !== item.autoFontSize) setItemAutoFontSize(cached.fontSize)
            markAutoSizeReady(cached.fontSize)
            return
        }

        await wait(0)

        const isOutputContext = ratio < 0.5 && !preview && !isStage
        if (isOutputContext && itemElem.current) {
            let prevWidth = itemElem.current.clientWidth
            let prevHeight = itemElem.current.clientHeight
            let attempts = 0
            let totalWait = 0
            while (attempts < 20 && totalWait < 500) {
                const waitTime = attempts === 0 ? 150 : attempts === 1 ? 50 : 20
                await wait(waitTime)
                totalWait += waitTime
                if (!itemElem.current) return
                const newWidth = itemElem.current.clientWidth
                const newHeight = itemElem.current.clientHeight
                if (newWidth === prevWidth && newHeight === prevHeight) break
                prevWidth = newWidth
                prevHeight = newHeight
                attempts++
            }
        }

        let defaultFontSize: number
        let maxFontSize: number | undefined

        if (isStage) {
            if (isDynamic) await wait(10)
            if (stageItem?.type !== "text") textFit = stageItem?.textFit || "growToFit"
            const itemFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100
            defaultFontSize = itemFontSize
            if (textFit === "growToFit" && itemFontSize !== 100) maxFontSize = itemFontSize
        } else {
            if (isTextItem && textFit === "none") {
                setFontSize(0)
                return
            }
            const allText = (item?.lines || []).flatMap((line) => (Array.isArray(line.text) ? line.text : []))
            const itemText = allText.filter((text) => !text.customType?.includes("disableTemplate"))
            const itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100
            defaultFontSize = itemFontSize
            if (textFit === "growToFit" && isTextItem) maxFontSize = itemFontSize
        }

        if (!itemElem.current) return
        const finalCacheKey = buildAutoSizeCacheKey()
        const finalCacheSignature = buildAutoSizeSignature(undefined, undefined, chordLines.length > 0)
        const finalCached = finalCacheKey ? readAutoSizeCache(finalCacheKey) : undefined
        if (useCache && finalCached && finalCached.signature === finalCacheSignature) {
            setFontSize(finalCached.fontSize)
            if (item.type === "slide_tracker") {
                markAutoSizeReady(finalCached.fontSize)
                return
            }
            if (finalCached.fontSize !== item.autoFontSize) setItemAutoFontSize(finalCached.fontSize)
            markAutoSizeReady(finalCached.fontSize)
            return
        }

        let elem: HTMLElement = itemElem.current
        let textQuery = ""
        if (isTextItem) {
            const alignElem = elem.querySelector<HTMLElement>(".align")
            if (!alignElem) return
            elem = alignElem
            textQuery = ".lines .break span"
        } else {
            textFit = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }

        let result: number
        try {
            result = autosize(elem, {
                type: textFit as "shrinkToFit" | "growToFit" | "none",
                textQuery,
                defaultFontSize,
                maxFontSize,
                isList: item?.list?.enabled || false
            })
        } catch (error) {
            console.error(error)
            return
        }

        if (item?.list?.enabled) result *= 0.9
        setFontSize(result)

        if (item.type === "slide_tracker") {
            if (finalCacheKey) writeAutoSizeCache(finalCacheKey, { signature: finalCacheSignature, fontSize: result })
            markAutoSizeReady(result)
            return
        }
        if (preview && result !== item.previewAutoFontSize) setItemPreviewAutoFontSize(result)
        if (result !== item.autoFontSize) setItemAutoFontSize(result)
        if (!isDynamic && finalCacheKey) writeAutoSizeCache(finalCacheKey, { signature: finalCacheSignature, fontSize: result })
        markAutoSizeReady(result)
    }
    calculateRef.current = calculateAutosize

    function debouncedCalculateAutosize(delay = 50) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
            debounceTimer.current = null
            void calculateRef.current()
        }, delay)
    }

    useEffect(() => {
        if (preview) {
            setLoaded(true)
            return
        }
        const timeout = setTimeout(() => setLoaded(true), 100)
        return () => clearTimeout(timeout)
    }, [preview])

    useEffect(() => {
        if (stateSignature === lastRenderedSignature.current) return
        lastRenderedSignature.current = stateSignature
        autoSizeReady.current = false
        const isTextItem = (item?.type || "text") === "text"
        const textFit = item?.textFit || (item?.auto ? (isTextItem ? "shrinkToFit" : "growToFit") : "none")
        if (stageAutoSize || textFit !== "none") {
            const willHide = shouldHideUntilAutoSizeCompletes()
            if (isStage) {
                // mantener el fontSize para evitar parpadeos durante el arrastre
            } else if (willHide) {
                setFontSize(0)
            } else if (preview) {
                setFontSize(item?.previewAutoFontSize || item?.autoFontSize || 100)
            } else {
                setFontSize(item?.autoFontSize || 0)
            }
            setHideUntilAutosized(willHide)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- el Svelte original sólo reaccionaba al cambio de esta firma
    }, [stateSignature])

    useEffect(() => {
        if (!hideUntilAutosized) return
        if (hideSafetyTimeout.current) clearTimeout(hideSafetyTimeout.current)
        hideSafetyTimeout.current = setTimeout(() => {
            setHideUntilAutosized(false)
            hideSafetyTimeout.current = null
        }, 600)
        return () => {
            if (hideSafetyTimeout.current) clearTimeout(hideSafetyTimeout.current)
            hideSafetyTimeout.current = null
        }
    }, [hideUntilAutosized])

    useEffect(() => {
        if (!itemElem.current || !loaded) return
        let delay: number | null = null
        if (autosizeSignature !== prevAutosizeSignature.current) {
            prevAutosizeSignature.current = autosizeSignature
            delay = isStage ? 60 : 0
        }
        if (isDynamicText && currentVariables) delay = 50
        if (item.type === "slide_tracker" && outputSlide) delay = 50
        if (delay !== null) debouncedCalculateAutosize(delay)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `debouncedCalculateAutosize` lee la última versión desde `calculateRef`
    }, [autosizeSignature, loaded, isDynamicText, currentVariables, outputSlide, item.type, isStage])

    useEffect(() => {
        const interval = setInterval(() => setUpdateTrigger((value) => value + 1), preview || isTemplatePreview ? 3000 : 1000)
        return () => clearInterval(interval)
    }, [preview, isTemplatePreview])

    const displayDuration = item?.actions?.displayDuration || 0
    useEffect(() => {
        if (!displayDuration || !clickRevealed) return
        setHidden(false)
        if (hideTimeout.current) clearTimeout(hideTimeout.current)
        hideTimeout.current = setTimeout(() => setHidden(true), displayDuration * 1000)
    }, [displayDuration, clickRevealed])

    useEffect(
        () => () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
            if (hideTimeout.current) clearTimeout(hideTimeout.current)
        },
        []
    )

    function getCustomStyle(currentStyleText: string, targetOutputId = "", overrideId = "") {
        let currentStyle = currentStyleText
        if (targetOutputId && !isStage) {
            const outputResolution = getOutputResolution(targetOutputId, currentOutputs, true, overrideId)
            currentStyle = percentageStylePos(currentStyle, outputResolution)
        }
        if (isStage && !originalStyle) currentStyle += "display: contents;"
        if (!alphaKey) return currentStyle
        const parsed = getStyles(currentStyle)
        const bgAlpha = getAlphaValues(parsed["background-color"])
        const textAlpha = getAlphaValues(parsed["color"]) || 1
        let alphaStyles = ";"
        if (bgAlpha) alphaStyles += "background-color: rgb(255 255 255 / " + bgAlpha + ");"
        alphaStyles += "color: rgb(255 255 255 / " + textAlpha + ");"
        return currentStyle + alphaStyles
    }

    function press() {
        if (!item.button?.press) return
        send(OUTPUT, ["ACTION_MAIN"], { id: item.button.press })
    }

    function release() {
        if (!item.button?.release) return
        send(OUTPUT, ["ACTION_MAIN"], { id: item.button.release })
    }

    const paddingCorrection = getPaddingCorrection(stageItem)
    const cssVariables = createCSSVariables(currentVariables, currentOutputs, isStage ? "stage" : "default", updateTrigger)
    const noTransition = !transition || (transition.type || "none") === "none" || transition.duration === 0
    const foregroundFilters = `${filter ? "filter: " + filter + ";" : ""}${backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""}`
    const fixedWidth = item?.type === "timer" || item?.type === "clock" ? "font-feature-settings: 'tnum' 1;" : ""
    const isDisabledVariable = item?.type === "variable" && currentVariables[item?.variable?.id]?.enabled === false
    const noTextMode = ref?.type === "template" && currentTemplates[ref?.id]?.settings?.mode === "item"
    const normalWrap = ref?.origin === "powerpoint"
    const highlighedLines: HighlightedLineBox[] = (() => {
        if (!centerPreview || !isOutputted || !currentOutputs) return []
        const boxes: HighlightedLineBox[] = []
        getAllActiveOutputs().forEach((output) => {
            const outSlide = output.out?.slide
            if (!outSlide) return
            const amount = currentStyles[output.style || ""]?.lines || 0
            if (!amount) return
            const visibleLines = getOutputLines(outSlide, amount)
            if (visibleLines.start === null) return
            boxes.push({ from: visibleLines.start, to: visibleLines.start + amount, color: output.color || "", styleLines: amount })
        })
        return boxes.sort((a, b) => b.styleLines - a.styleLines)
    })()

    const rootStyle = `${style ? getCustomStyle(getItemStyle(item?.style, isCroppedItem(item)), customOutputId, styleIdOverride) : "width: 100%;height: 100%;"};` + `${paddingCorrection}${foregroundFilters}${animationStyle.item || ""}${cssVariables}${fixedWidth}`

    return (
        <div
            ref={itemElem}
            className={cn(
                "item",
                css.item,
                alphaKey && !lines?.length && "white",
                alphaKey && !lines?.length && css.white,
                alphaKey && "key",
                alphaKey && css.key,
                isStage && "isStage",
                isStage && css.isStage,
                isStage && !stageAutoSize && "stageNoAuto",
                isStage && !stageAutoSize && css.stageNoAuto,
                isDisabledVariable && "isDisabledVariable",
                isDisabledVariable && css.isDisabledVariable,
                noTransition && "noTransition",
                noTransition && css.noTransition,
                chordLines.length > 0 && "chords",
                chordLines.length > 0 && css.chords,
                (item?.button?.press || item?.button?.release) && "clickable",
                (item?.button?.press || item?.button?.release) && css.clickable,
                (centerPreview || isStage) && item?.clickReveal && !clickRevealed && "reveal",
                (centerPreview || isStage) && item?.clickReveal && !clickRevealed && css.reveal,
                hidden && "hidden",
                hidden && css.hidden
            )}
            style={cssTextToStyle(rootStyle) as CSSProperties}
            onMouseDown={press}
            onMouseUp={release}
        >
            {lines && !noTextMode ? (
                <TextboxLines
                    item={item}
                    slideIndex={slideIndex}
                    alphaKey={alphaKey}
                    smallFontSize={smallFontSize}
                    animationStyle={animationStyle}
                    dynamicValues={dynamicValues}
                    isStage={isStage}
                    customFontSize={customFontSize}
                    outputStyle={outputStyle}
                    ref={ref}
                    style={style}
                    customStyle={customStyle}
                    stageItem={stageItem}
                    chords={chords}
                    linesStart={localLinesStart}
                    linesEnd={localLinesEnd}
                    fontSize={smallFontSize ? 20 : fontSize}
                    customTypeRatio={customTypeRatio}
                    maxLines={maxLines}
                    maxLinesInvert={maxLinesInvert}
                    centerPreview={centerPreview}
                    revealed={revealed}
                    styleOverrides={templateStyleOverrides}
                    useOriginalTextColor={useOriginalTextColor}
                    hideContent={hideUntilAutosized}
                    highlighedLines={highlighedLines}
                    onUpdateAutoSize={() => void calculateRef.current()}
                    updateDynamicValues={updateDynamicValues}
                    normalWrap={normalWrap}
                />
            ) : (
                <SlideItems item={item} slideIndex={slideIndex} preview={preview} miniPreview={miniPreview || centerPreview} isTemplatePreview={isTemplatePreview} ratio={ratio} smallFontSize={smallFontSize} ref={ref} fontSize={fontSize} outputId={outputId} />
            )}
        </div>
    )
}
