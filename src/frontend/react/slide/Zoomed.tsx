import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import type { Cropping, Resolution } from "../../../types/Settings"
import { outputs, previewOutputId, styles } from "../../shared/core/stores"
import { DEFAULT_BOUNDS, getActiveOutputs, getOutputResolution, getResolution } from "../../components/helpers/output"
import { useStore } from "../hooks/useStore"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { observeResize } from "./observeResize"
import stylesModule from "./Zoomed.module.css"

export interface ZoomedProps {
    id?: string
    background?: string
    backgroundDuration?: number
    center?: boolean
    zoom?: boolean
    mirror?: boolean
    disableStyle?: boolean
    isStage?: boolean
    checkered?: boolean
    border?: boolean
    align?: string
    outline?: string
    disabled?: boolean
    relative?: boolean
    aspectRatio?: boolean
    hideOverflow?: boolean
    customZoom?: number
    cropping?: Cropping
    styleIdOverride?: string
    resolution?: Resolution
    style?: string
    children?: ReactNode
    /** Nodo del cascarón Svelte que contiene el `<slot>`; se reubica dentro de `.slide`. */
    slotHost?: HTMLElement | null
    onRatioChange?: (ratio: number) => void
}

interface Size {
    width: number
    height: number
}

function getCropping(cropping: Cropping | undefined, res: Resolution, outRes: Resolution, isOutputResolutionAsRatio = false) {
    let style = ""
    if (!cropping) return ""

    const top = Number(cropping.top) || 0
    const bottom = Number(cropping.bottom) || 0
    const left = Number(cropping.left) || 0
    const right = Number(cropping.right) || 0
    const minusHeight = top + bottom
    const minusWidth = right + left

    if (isOutputResolutionAsRatio) {
        if (!minusHeight && !minusWidth) return ""
        style += `margin-top: ${top}px;`
        style += `margin-bottom: ${bottom}px;`
        style += `margin-inline-start: ${left}px;`
        style += `margin-inline-end: ${right}px;`
        style += `width: calc(100% - ${minusWidth}px);`
        style += `height: calc(100% - ${minusHeight}px);`
        style += `aspect-ratio: auto;`
        return style
    }

    let paddingSides = 0
    let paddingTops = 0
    const slideAR = res.width / res.height
    const availableWidth = outRes.width - minusWidth
    const availableHeight = outRes.height - minusHeight
    const availableAR = availableWidth / availableHeight

    if (availableAR >= slideAR) paddingSides = (availableWidth - availableHeight * slideAR) / 2
    else paddingTops = (availableHeight - availableWidth / slideAR) / 2

    if (!minusHeight && !minusWidth && !paddingSides && !paddingTops) return ""

    style += `margin-top: ${top + paddingTops}px;`
    style += `margin-bottom: ${bottom + paddingTops}px;`
    const totalHorizontalMargin = minusWidth + paddingSides * 2
    style += `width: calc(100% - ${totalHorizontalMargin}px);`
    style += `margin-inline-end: ${right + paddingSides}px;`
    style += `margin-inline-start: ${left + paddingSides}px;`
    style += `height: auto;`
    return style
}

// Port de components/slide/Zoomed.svelte (F24.18b).
export function Zoomed({ id = "", background = "#000000", backgroundDuration = 800, center = false, zoom = true, mirror = false, disableStyle = false, isStage = false, checkered = false, border = false, align = "", outline = "", disabled = false, relative = false, aspectRatio = true, hideOverflow = true, customZoom = 1, cropping = { top: 0, right: 0, bottom: 0, left: 0 }, styleIdOverride = "", resolution: resolutionProp, style = "", children, slotHost, onRatioChange }: ZoomedProps) {
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)
    const currentPreviewOutputId = useStore(previewOutputId)

    const [elemSize, setElemSize] = useState<Size>({ width: 0, height: 0 })
    const [slideSize, setSlideSize] = useState<Size>({ width: 0, height: 0 })
    const outerRef = useRef<HTMLDivElement | null>(null)
    const slideRef = useRef<HTMLDivElement | null>(null)
    const lastRatio = useRef<number | null>(null)

    const outputId = id || getActiveOutputs(currentOutputs, true, true, true)[0] || ""
    const resolution = isStage ? getResolution(resolutionProp ?? null, { outputs: currentOutputs, styles: currentStyles, previewOutputId: currentPreviewOutputId }, false, outputId, styleIdOverride) : getResolution(resolutionProp ?? null, { outputs: currentOutputs, styles: currentStyles }, false, outputId, styleIdOverride)
    const outputRes = isStage ? resolution : getOutputResolution(outputId, currentOutputs)
    const stylesRatio = getResolution(null, currentStyles, false, outputId, styleIdOverride)
    const styleAspectRatio = stylesRatio.width / stylesRatio.height
    const defaultRatio = DEFAULT_BOUNDS.width / DEFAULT_BOUNDS.height

    const currentStyleId = styleIdOverride || currentOutputs[outputId]?.style || ""
    const styleRatioData = (currentStyles[currentStyleId]?.aspectRatio || currentStyles[currentStyleId]?.resolution) as { outputResolutionAsRatio?: boolean } | undefined
    const outputResolutionAsRatio = !isStage && !!styleRatioData?.outputResolutionAsRatio

    const shouldUseHeightRatio = outputRes.width < outputRes.height && stylesRatio.width > stylesRatio.height && styleAspectRatio === defaultRatio
    const ratio = Math.max(0.01, shouldUseHeightRatio ? slideSize.height / outputRes.height : slideSize.width / outputRes.width) / (customZoom || 1)

    const croppedStyle = mirror ? "" : getCropping(cropping, resolution, outputRes, outputResolutionAsRatio)
    const alignStyle = align ? (style.includes("width") ? `align-items: ${align};` : `justify-content: ${align};`) : ""

    useEffect(() => {
        const outer = outerRef.current
        const inner = slideRef.current
        if (!outer || !inner) return
        const outerObs = observeResize(outer, (rect) => setElemSize({ width: rect.width, height: rect.height }))
        const innerObs = observeResize(inner, (rect) => setSlideSize({ width: rect.width, height: rect.height }))
        return () => {
            outerObs.destroy()
            innerObs.destroy()
        }
    }, [])

    useEffect(() => {
        if (lastRatio.current === ratio) return
        lastRatio.current = ratio
        onRatioChange?.(ratio)
    }, [ratio, onRatioChange])

    useEffect(() => {
        const inner = slideRef.current
        if (!inner || !slotHost) return
        inner.appendChild(slotHost)
        return () => {
            if (slotHost.parentNode === inner) inner.removeChild(slotHost)
        }
    }, [slotHost])

    const backgroundStyle = typeof background === "string" && background.includes("-gradient") ? `background-image: ${background};` : `background-color: ${background};`
    const innerStyle = `${style}${backgroundStyle}transition: ${backgroundDuration}ms background-color;${aspectRatio ? `aspect-ratio: ${resolution.width}/${resolution.height};${croppedStyle}` : ""};`

    return (
        <div id={outputId} ref={outerRef} className={["zoomed", center ? `center ${stylesModule.center}` : "", disabled ? `disabled ${stylesModule.disabled}` : ""].filter(Boolean).join(" ")} style={{ width: "100%", height: "100%", ...cssTextToStyle(outline ? `border: 2px solid ${outline};` : ""), ...cssTextToStyle(alignStyle), ...(center ? cssTextToStyle("display: flex;justify-content: safe center;align-items: safe center;overflow: visible;") : {}) } as CSSProperties}>
            <div ref={slideRef} className={[`slide ${stylesModule.slide}`, resolution.width / resolution.height > elemSize.width / elemSize.height ? "landscape" : "", hideOverflow ? `hideOverflow ${stylesModule.hideOverflow}` : "", stylesModule.canOverflow, disableStyle ? stylesModule.disableStyle : "", relative ? stylesModule.relative : "", checkered ? "checkered" : "", border ? `border ${stylesModule.border}` : ""].filter(Boolean).join(" ")} style={cssTextToStyle(innerStyle)}>
                {zoom ? (
                    <span className="zoom" style={{ zoom: ratio }}>
                        {children}
                    </span>
                ) : (
                    children
                )}
            </div>
        </div>
    )
}
