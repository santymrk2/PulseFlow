import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react"
import type { Styles } from "../../../types/Settings"
import type { Item, TemplateStyleOverride } from "../../../types/Show"
import { cn } from "../../lib/utils"
import { createVirtualBreaks } from "../../show/slides"
import { outputs, slidesOptions, styles as stylesStore, variables } from "../../stores"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { replaceDynamicValues } from "../../components/helpers/showActions"
import { getStyles } from "../../components/helpers/style"
import { calculateShapeVerticalOffset, getShapeFloatSide } from "../../components/edit/scripts/shapeOutside"
import { applyStyleOverrides } from "../../components/slide/wordOverride"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import styles from "./TextboxLines.module.css"

interface RenderText {
    value?: string
    style?: string
    baseStyle?: string
    customType?: string
}

interface RenderLine {
    align?: string
    text?: RenderText[]
}

interface ChordsData {
    size?: number
    color?: string
    offsetY?: number
}

interface StageItem {
    chords?: ChordsData
    chordsData?: ChordsData
    style?: string
}

export interface HighlightedLine {
    from: number
    to: number
    color: string
}

interface TextboxLinesRef {
    type?: "show" | "stage" | "overlay" | "template"
    showId?: string
    slideId?: string
    layoutId?: string
    id: string
}

export interface TextboxLinesProps {
    item: Item
    slideIndex?: number
    /** Equivale al `key` del Svelte original (alpha key output); se renombra porque React reserva `key`. */
    alphaKey?: boolean
    smallFontSize?: boolean
    animationStyle?: { text?: string }
    dynamicValues?: boolean
    isStage?: boolean
    customFontSize?: number | null
    outputStyle?: Styles | null
    ref: TextboxLinesRef
    style?: boolean
    customStyle?: string
    stageItem?: StageItem
    useOriginalTextColor?: boolean
    chords?: boolean
    linesStart?: number | null
    linesEnd?: number | null
    fontSize?: number
    customTypeRatio?: number
    maxLines?: number
    maxLinesInvert?: boolean
    centerPreview?: boolean
    revealed?: number
    styleOverrides?: TemplateStyleOverride[]
    hideContent?: boolean
    highlighedLines?: HighlightedLine[]
    normalWrap?: boolean
    updateDynamicValues?: boolean
    onUpdateAutoSize?: () => void
}

function getAlphaValues(colorValue: string | undefined) {
    if (!colorValue) return 0
    let alpha = 0
    if (colorValue.includes("#")) alpha = alphaFromHex(colorValue)
    else if (colorValue.includes("rgb")) alpha = alphaFromRgb(colorValue)
    return alpha || 0
}

function alphaFromHex(colorValue: string) {
    const m = colorValue.match(/^#([0-9a-f]{2})[0-9a-f]{6}$/i)
    if (!m) return 1
    return parseInt(m[1], 16) / 255
}

function alphaFromRgb(colorValue: string) {
    if (colorValue.includes(",")) return parseFloat(colorValue.split(",")[3])
    if (colorValue.includes("/")) return parseFloat(colorValue.substring(colorValue.indexOf("/") + 1))
    return 1
}

function getLineText(line: RenderLine) {
    return line.text?.reduce((value, text) => value + (text.value || ""), "") || ""
}

// Port de components/slide/TextboxLines.svelte (F24.18b).
export function TextboxLines({
    item,
    slideIndex = 0,
    alphaKey = false,
    smallFontSize = false,
    animationStyle = {},
    dynamicValues = true,
    isStage = false,
    customFontSize = null,
    outputStyle = null,
    ref,
    style = true,
    customStyle = "",
    stageItem = {},
    useOriginalTextColor = false,
    chords = false,
    linesStart = null,
    linesEnd = null,
    fontSize = 0,
    customTypeRatio = 1,
    maxLines = 0,
    maxLinesInvert = false,
    centerPreview = false,
    revealed = -1,
    styleOverrides = [],
    hideContent = false,
    highlighedLines = [],
    normalWrap = false,
    updateDynamicValues = true,
    onUpdateAutoSize
}: TextboxLinesProps) {
    const currentSlidesOptions = useStore(slidesOptions)
    const currentStyles = useStore(stylesStore)
    const currentVariables = useStore(variables)
    const currentOutputs = useStore(outputs)

    // `createVirtualBreaks` muta las líneas: se trabaja siempre sobre una copia, igual que el `$:` original.
    let lines = createVirtualBreaks(clone(item?.lines || []), outputStyle?.skipVirtualBreaks) as RenderLine[]
    let start = linesStart
    let end = linesEnd
    if (start !== null && end !== null && lines.length) {
        lines = lines.filter((line) => Array.isArray(line.text) && line.text.filter((text) => text.value !== undefined)?.length)
        if (!lines[start]) {
            const linesCount = end - start
            const length = lines.length - 1
            const index = length - (length % linesCount)
            start = index
            end = index + linesCount
        }
    }
    const renderedLines = (styleOverrides?.length ? applyStyleOverrides(lines, styleOverrides) : lines) as RenderLine[]

    const shapeOutside = getStyles(item?.style)["shape-outside"] as string | undefined
    const shapeFloatSide = getShapeFloatSide(shapeOutside)
    const [shapeOffsetTop, setShapeOffsetTop] = useState(0)
    const linesElem = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!shapeOutside || !linesElem.current) return
        const timeout = setTimeout(() => setShapeOffsetTop(calculateShapeVerticalOffset(linesElem.current, item?.align)))
        return () => clearTimeout(timeout)
    }, [shapeOutside, item, linesElem])

    function getCustomStyle(customStyleText: string) {
        if (!customStyleText) return ""
        let result = customStyleText
        const gradientCount = (result.match(/-gradient/g) || []).length
        if (result.includes("-gradient") && (gradientCount > 1 || !result.includes("-webkit-mask-image: linear-gradient"))) {
            const parsed = getStyles(result)
            const gradient = parsed.color
            result += `background-image: ${gradient};color: transparent;background-clip: text;`
            if (!result.includes("text-shadow") || result.includes("2px 2px 10px #000000;")) result += "text-shadow: none;"
            if (result.includes("-webkit-mask-image")) result += parsed["-webkit-mask-image"]
        }
        if (!alphaKey) return result
        const parsed = getStyles(result)
        let alphaStyles = ";"
        const bgAlpha = getAlphaValues(parsed["background-color"])
        const textAlpha = getAlphaValues(parsed["color"]) || 1
        if (bgAlpha) alphaStyles += "background-color: rgb(255 255 255 / " + bgAlpha + ");"
        alphaStyles += "color: rgb(255 255 255 / " + textAlpha + ");"
        return result + alphaStyles
    }

    // CONTINUOUS SCROLLING
    const [sizes, setSizes] = useState({ contentWidth: 0, alignWidth: 0, contentHeight: 0, alignHeight: 0 })
    const alignElem = useRef<HTMLDivElement | null>(null)
    const contentElem = useRef<HTMLDivElement | null>(null)
    const isScrolling = !isStage && !!item?.scrolling?.type && item.scrolling.type !== "none"
    const scrollGap = item?.scrolling?.gap ?? 0
    const copyCountHorizontal = sizes.contentWidth > 0 ? Math.ceil(sizes.alignWidth / (sizes.contentWidth + scrollGap)) + 2 : 2
    const copyCountVertical = sizes.contentHeight > 0 ? Math.ceil(sizes.alignHeight / (sizes.contentHeight + scrollGap)) + 2 : 2
    const copyCount = item?.scrolling?.type === "top_bottom" || item?.scrolling?.type === "bottom_top" ? copyCountVertical : copyCountHorizontal

    useEffect(() => {
        if (!isScrolling) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                if (entry.target === alignElem.current) setSizes((value) => ({ ...value, alignWidth: width, alignHeight: height }))
                else setSizes((value) => ({ ...value, contentWidth: width, contentHeight: height }))
            }
        })
        if (alignElem.current) observer.observe(alignElem.current)
        if (contentElem.current) observer.observe(contentElem.current)
        return () => observer.disconnect()
    }, [isScrolling, copyCount])

    function getColor(lineStyle: string | undefined) {
        if (!isStage || !useOriginalTextColor || !lineStyle) return ""
        const parsed = getStyles(lineStyle)
        return parsed.color ? `color: ${parsed.color};` : ""
    }

    const lineGap = item?.specialStyle?.lineGap
    const lineRadius = item?.specialStyle?.lineRadius || 0
    const lineBg = item?.specialStyle?.lineBg
    const lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    const lineStyle = (lineRadius ? `border-radius: ${lineRadius}px;` : "") + (lineBg ? `background: ${lineBg};` : "")
    const textAnimation = animationStyle.text || ""

    function resolveFontSize(resolvedStyle: string | undefined, resolvedOutputStyle: Styles | null) {
        const styleObj = getStyles(resolvedStyle, true)
        const baseFontSize = Number(styleObj["font-size"] || 100) || 100
        let usedOutputStyle = resolvedOutputStyle
        if (!usedOutputStyle) {
            const currentOutput = getFirstActiveOutput()
            usedOutputStyle = currentStyles[currentOutput?.style || ""] || null
        }
        if (!usedOutputStyle) return baseFontSize
        const customFontSizeRatio = (usedOutputStyle.aspectRatio?.fontSizeRatio ?? 100) / 100
        return baseFontSize * customFontSizeRatio
    }

    function getCustomFontSize(resolvedStyle: string | undefined, resolvedOutputStyle: Styles | null) {
        if (resolvedStyle?.includes("--base-font-size") || resolvedStyle?.includes("font-size: calc(")) return ""
        return `;font-size: ${resolveFontSize(resolvedStyle, resolvedOutputStyle)}px;`
    }

    // CHORDS
    const [chordLines, setChordLines] = useState<string[]>([])
    const [chordOnlyLines, setChordOnlyLines] = useState<boolean[]>([])
    const chordsKey = JSON.stringify({ lines: item?.lines, itemChords: item?.chords, stageItem })
    useEffect(() => {
        if (!chords || (!item?.lines && !fontSize)) return
        const nextLines: string[] = []
        const nextOnly: boolean[] = []
        if (Array.isArray(item?.lines)) {
            item.lines.forEach((line, position) => {
                if (!line.chords?.length || !line.text) return
                const sortedChords = clone(line.chords || []).sort((a, b) => (a.pos || 0) - (b.pos || 0))
                const lineText = getLineText(line as unknown as RenderLine)
                const autosizeRatio = getChordSizeRatio()

                if (!lineText.trim().length) {
                    nextLines[position] = getChordOnlyHtml(sortedChords)
                    nextOnly[position] = true
                    return
                }

                let html = ""
                let index = 0
                let prevChordEnd = -1
                line.text.forEach((text) => {
                    const value = (text.value || "").trim().replaceAll("\n", "") || ""
                    for (const letter of value) {
                        const chordIndex = sortedChords.findIndex((chord) => chord.pos === index)
                        if (chordIndex >= 0) {
                            const chord = sortedChords.splice(chordIndex, 1)[0]
                            const shift = Math.max(0, prevChordEnd - index)
                            prevChordEnd = index + shift + chord.key.length * autosizeRatio * 1.1 + 0.6
                            const marginStyle = shift ? `margin-left: ${(shift * 0.65).toFixed(2)}em;` : ""
                            html += `<span class="chord" data-autosize-ratio="${autosizeRatio}" style="${marginStyle}">${chord.key}</span>`
                        }
                        const size = fontSize || 0
                        html += `<span class="invisible" style="${style ? getCustomStyle(text.style) : ""}${size ? `font-size: ${size}px;` : ""}">${letter}</span>`
                        index++
                    }
                })

                if (sortedChords.length > 0) {
                    const leadWidthEm = (0.8 * autosizeRatio).toFixed(2)
                    html += `<span class="invisible trailing-lead-space" style="display: inline-block; width: ${leadWidthEm}em; white-space: nowrap;"></span>`
                    sortedChords.forEach((chord) => {
                        html += `<span class="chord end" data-autosize-ratio="${autosizeRatio}">${chord.key}</span>`
                        const widthEm = Math.max(1.5, chord.key.length * 0.65 * autosizeRatio + 0.8).toFixed(2)
                        html += `<span class="invisible trailing-space" style="display: inline-block; width: ${widthEm}em; white-space: nowrap;"></span>`
                    })
                }
                if (!html) return
                nextLines[position] = html
                nextOnly[position] = false
            })
        }
        setChordLines(nextLines)
        setChordOnlyLines(nextOnly)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- las keys estabilizan las referencias que el Svelte original observaba con `$:`
    }, [chords, chordsKey, fontSize, style])

    function getChordOnlyHtml(sortedChords: { pos?: number; key: string }[]) {
        const autosizeRatio = getChordSizeRatio()
        return sortedChords
            .sort((a, b) => (a.pos || 0) - (b.pos || 0))
            .map((chord, position, sorted) => {
                const previousPos = sorted[position - 1]?.pos ?? 0
                const gap = position === 0 ? Math.max(0, chord.pos || 0) : Math.max(1, (chord.pos || 0) - previousPos)
                return `<span class="chord" data-autosize-ratio="${autosizeRatio}" style="${gap ? `margin-left: ${gap * 0.65}em;` : ""}">${chord.key}</span>`
            })
            .join("")
    }

    function getChordSizeRatio() {
        return (stageItem?.chords?.size || stageItem?.chordsData?.size || item?.chords?.size || 50) / 100
    }

    // DYNAMIC VALUES
    const previousValue = useRef<Record<string, string>>({})
    const textValueCache = useRef(new Map<string, string>())
    const lastUpdater = useRef(0)
    function getTextValue(value: string, lineIndex: number, textIndex: number, updater: number) {
        if (!dynamicValues || !value || typeof value !== "string" || !value.includes("{")) return value || ""
        if (updater !== lastUpdater.current) {
            textValueCache.current.clear()
            lastUpdater.current = updater
        }
        const cacheKey = `${lineIndex}_${textIndex}_${value}`
        const cached = textValueCache.current.get(cacheKey)
        if (cached !== undefined) return cached
        const newValue = replaceDynamicValues(value, { ...ref, slideIndex }, updater)
        const id = `${lineIndex}_${textIndex}`
        if (previousValue.current[id] !== newValue) {
            if (updater > 2) onUpdateAutoSize?.()
            previousValue.current[id] = newValue
        }
        textValueCache.current.set(cacheKey, newValue)
        return newValue
    }

    const slideText = getItemText(item)
    const hasDynamicValues = slideText.includes("{")
    const [updateDynamic, setUpdateDynamic] = useState(0)
    const dynamicFlags = useRef({ hasDynamicValues, mounted: false, updateDynamicValues })
    dynamicFlags.current = { hasDynamicValues, mounted: dynamicFlags.current.mounted, updateDynamicValues }
    const updateRef = useRef<() => void>(() => {})
    updateRef.current = () => {
        const flags = dynamicFlags.current
        if (!flags.hasDynamicValues || !flags.mounted || !flags.updateDynamicValues) return
        setUpdateDynamic((value) => value + 1)
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            dynamicFlags.current.mounted = true
        })
        return () => clearTimeout(timeout)
    }, [])

    useEffect(() => {
        if (!hasDynamicValues) return
        const interval = setInterval(() => updateRef.current(), 1000)
        return () => clearInterval(interval)
    }, [hasDynamicValues])

    useEffect(() => {
        const timeout = setTimeout(() => updateRef.current(), isStage ? 250 : 0)
        return () => clearTimeout(timeout)
    }, [currentVariables, currentOutputs, isStage])

    const firstTextStyle = item?.lines?.[0]?.text?.[0]?.style
    const defaultResolvedFontSize = !firstTextStyle ? 100 : resolveFontSize(firstTextStyle, outputStyle)
    const listStyle = item?.list?.enabled ? `;font-size: ${fontSize || defaultResolvedFontSize || 100}px;display: list-item;list-style: inside ${item.list?.style || "disc"};` : ""
    const mainTextSegment = renderedLines?.flatMap((line) => line?.text || []).find((text) => !text?.customType?.includes("disableTemplate")) || renderedLines?.[0]?.text?.[0]
    const baseFontSize = fontSize || (style ? resolveFontSize(mainTextSegment?.style, outputStyle) : 100)

    const chordFontSize = chordLines.length ? stageItem?.chords?.size || stageItem?.chordsData?.size || item?.chords?.size || 50 : 0
    const chordsStyle = `--chord-size: ${chordLines.length ? (fontSize || defaultResolvedFontSize || 100) * (chordFontSize / 100) : "undefined"}px;--chord-color: ${stageItem?.chords?.color || stageItem?.chordsData?.color || item?.chords?.color || "#FF851B"};`
    const customFontSizeValue = smallFontSize ? (-1.1 * currentSlidesOptions.columns + 10) * 5 : customFontSize
    const fontSizeStyle = smallFontSize || customFontSize !== null ? `--font-size: ${customFontSizeValue}px;` : ""

    function renderLines() {
        return renderedLines.map((line, lineIndex) => {
            const chordOnly = !!chords && !!chordOnlyLines[lineIndex]
            const hasText = line.text?.reduce((value, text) => value + (text.value || ""), "")?.trim()?.length
            const height = chords && chordLines[lineIndex] && !chordOnly && lineIndex < renderedLines.length - 1 && !hasText ? 80 : 0
            const lineHidden = (start !== null && end !== null && (lineIndex < start || lineIndex >= end)) || (!!maxLines && (maxLinesInvert ? lineIndex <= lines.length - maxLines - 1 : lineIndex >= maxLines))
            if (lineHidden && !outputStyle?.showAsFaded) return null

            const isNormalWrap = normalWrap || (isStage ? typeof stageItem?.style === "string" && (stageItem.style.includes("justify") || stageItem.style.includes("nowrap")) : line.align?.includes("justify") || line.align?.includes("left") || JSON.stringify(line).includes("nowrap"))
            const isRevealed = (centerPreview || isStage) && !!(item as Item & { lineReveal?: boolean }).lineReveal && revealed < lineIndex
            const isSmallFontSize = smallFontSize || !!customFontSize || textAnimation.includes("font-size")
            const fadedStyle = lineHidden && outputStyle?.showAsFaded ? `opacity: ${(outputStyle.lineOpacity ?? 50) / 100};` : ""
            const lineTextStyle = `position: relative;${style ? lineStyle : ""}${style ? line.align || "" : ""}${height ? `height: ${height}px;` : ""}` + (item?.list?.enabled && hasText ? listStyle : "") + (item?.list?.enabled ? `color: ${getStyles(line.text?.[0]?.style).color || ""};` : "") + fadedStyle

            return (
                <div key={lineIndex}>
                    {chords && chordLines[lineIndex] ? (
                        <div
                            className={cn("break chords", styles.break, styles.chords, lineIndex === 0 && "first", lineIndex === 0 && styles.first, chordOnly && "chordOnly", chordOnly && styles.chordOnly, !!stageItem && "stageChords", !!stageItem && styles.stageChords)}
                            style={cssTextToStyle(`--font-size: ${fontSize || baseFontSize || defaultResolvedFontSize || 100}px;` + `--offsetY: ${(stageItem?.chords ? stageItem.chords.offsetY : item?.chords?.offsetY) || 0}px;` + (style ? line.align || "" : ""))}
                            dangerouslySetInnerHTML={{ __html: chordLines[lineIndex] }}
                        />
                    ) : null}
                    {!chordOnly ? (
                        <div className={cn("break", styles.break, isNormalWrap && "normalWrap", isNormalWrap && styles.normalWrap, isRevealed && "reveal", isRevealed && styles.reveal, isSmallFontSize && "smallFontSize", isSmallFontSize && styles.smallFontSize)} style={cssTextToStyle(lineTextStyle)}>
                            {highlighedLines.map((box, boxIndex) =>
                                lineIndex >= box.from && lineIndex < box.to ? (
                                    <div key={boxIndex} style={cssTextToStyle(`position: absolute;top: ${lineIndex === box.from ? "0" : "-2px"};bottom: ${lineIndex === box.to - 1 ? "0" : "-2px"};left: 0px;right: 0px;` + `border-left: 2px solid ${box.color};border-right: 2px solid ${box.color};` + (lineIndex === box.from ? `border-top: 2px solid ${box.color};` : "") + (lineIndex === box.to - 1 ? `border-bottom: 2px solid ${box.color};` : "") + "pointer-events: none;")} />
                                ) : null
                            )}
                            {line.text?.length === 0 ? (
                                <span className="textContainer">
                                    <br />
                                </span>
                            ) : (
                                line.text?.map((text, textIndex) => {
                                    const value = text.value?.replaceAll("\n", "<br>") || "<br>"
                                    const fontRatio = text.customType?.includes("disableTemplate") && !text.customType?.includes("jw") ? customTypeRatio : 1
                                    const segmentFontSize = fontSize ? fontSize * fontRatio : style ? resolveFontSize(text.baseStyle || text.style, outputStyle) : 100
                                    const segmentStyle = (style ? getCustomStyle(text.style || "") : "") + getColor(text.style) + customStyle + (text.customType?.includes("disableTemplate") ? text.style || "" : "") + (fontSize ? `;font-size: ${fontSize * fontRatio}px;` : style ? getCustomFontSize(text.style, outputStyle) : "") + `;--base-font-size: ${segmentFontSize}px;`
                                    return <span key={textIndex} className="textContainer" style={cssTextToStyle(segmentStyle)} dangerouslySetInnerHTML={{ __html: getTextValue(value, lineIndex, textIndex, updateDynamic) }} />
                                })
                            )}
                        </div>
                    ) : null}
                </div>
            )
        })
    }

    function renderLinesContainer(withShapeOffset: boolean, containerRef?: Ref<HTMLDivElement>) {
        const linesStyle = (style ? lineStyleBox : "") + (shapeOutside ? `--shape-outside: ${shapeOutside};${withShapeOffset ? `--shape-offset-top: ${shapeOffsetTop}px;` : ""}` : "") + (shapeOutside && typeof item?.align === "string" ? `${item.align.replace(/align-items/g, "align-content")};` : "") + fontSizeStyle + textAnimation + chordsStyle
        return (
            <div ref={withShapeOffset ? linesElem : (containerRef ?? null)} className={cn("lines", styles.lines, !!shapeOutside && "hasShapeOutside", !!shapeOutside && styles.hasShapeOutside)} data-chord-size-ratio={chordFontSize ? chordFontSize / 100 : null} style={cssTextToStyle(linesStyle)}>
                {shapeOutside ? <div className={cn("shape-outside-float", styles.shapeOutsideFloat)} style={{ ...cssTextToStyle(`shape-outside: ${shapeOutside};`), cssFloat: shapeFloatSide } as CSSProperties} /> : null}
                {renderLines()}
            </div>
        )
    }

    const scrollType = item?.scrolling?.type
    const scrollDirectionName = scrollType === "top_bottom" ? "topBottomContinuousScrolling" : scrollType === "bottom_top" ? "bottomTopContinuousScrolling" : scrollType === "left_right" ? "leftRightContinuousScrolling" : scrollType === "right_left" ? "rightLeftContinuousScrolling" : ""
    const scrollDirection = scrollDirectionName ? styles[scrollDirectionName] : ""

    return (
        <div ref={alignElem} className={cn("align", styles.align, !!shapeOutside && "hasShapeOutside", !!shapeOutside && styles.hasShapeOutside, hideContent && "hidden", hideContent && styles.hidden, isStage && "isStage", isStage && styles.isStage, isScrolling && "scrolling", isScrolling && styles.scrolling)} style={cssTextToStyle(`--scrollSpeed: ${(item?.scrolling?.speed ?? 30) * 1.5}s;${style ? item?.align || "" : ""}`)}>
            {!isStage && scrollType && scrollType !== "none" ? (
                <div className={cn("scrollWrapper", styles.scrollWrapper, scrollDirectionName, scrollDirection)} style={cssTextToStyle(`--copyCountHorizontal: ${copyCountHorizontal};--copyCountVertical: ${copyCountVertical};`)}>
                    {Array.from({ length: copyCount }, (_, copyIndex) => (
                        <div key={copyIndex} className={cn("scrollContent", styles.scrollContent)} style={cssTextToStyle(`${scrollType === "top_bottom" || scrollType === "bottom_top" ? "margin-bottom" : "margin-right"}: ${item?.scrolling?.gap ?? 100}px;`)}>
                            {copyIndex === 0 ? renderLinesContainer(false, contentElem) : renderLinesContainer(false)}
                        </div>
                    ))}
                </div>
            ) : (
                renderLinesContainer(true)
            )}
        </div>
    )
}
