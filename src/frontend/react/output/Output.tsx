import { useEffect, useRef, useState, type CSSProperties } from "react"
import { uid } from "uid"
import type { OutData } from "../../../types/Output"
import type { Styles } from "../../../types/Settings"
import type { AnimationData, Item, OutBackground, OutScene, OutSlide, Overlays as OverlaysData, Slide, SlideData, Transition } from "../../../types/Show"

import { allOutputs, colorbars, effects, media, outputs, overlays, showsCache, styles as stylesStore, templates, transitionData } from "../../shared/core/stores"
import { wait } from "../../shared/utils/common"
import { clone } from "../../shared/utils/helpers/array"
import { defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, getStyleTemplate, setTemplateStyle } from "../../shared/utils/helpers/output"
import { _show } from "../../shared/utils/helpers/shows"
import { updateAnimation } from "../../components/output/animation"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Image } from "../../features/media/Image"
import { Zoomed } from "../../features/slide/Zoomed"
import { Background } from "./Background"
import { EffectOutput } from "./EffectOutput"
import { Overlay } from "./OutputOverlay"
import { OutputTransition } from "./OutputTransition"
import { Overlays as OverlaysLayer } from "./Overlays"
import { PdfOutput } from "./PdfOutput"
import { SceneMedia } from "./SceneMedia"
import { SlideContent } from "./SlideContent"
import { Window as WindowView } from "./Window"
import css from "./Output.module.css"

export interface OutputProps {
    outputId?: string
    style?: string
    ratio?: number
    mirror?: boolean
    preview?: boolean
    styleIdOverride?: string
    outOverride?: OutData | null
}

interface CurrentSlide {
    id?: string
    items?: Item[]
    settings?: { color?: string; [key: string]: unknown }
    customDynamicValues?: Slide["customDynamicValues"]
    timeline?: { actions?: unknown[]; loop?: boolean }
    [key: string]: unknown
}

interface SlideLines {
    start?: number | null
    end?: number | null
    linesStart?: number | null
    linesEnd?: number | null
    clickRevealed?: boolean
}

const NO_TRANSITION: Transition = { type: "none", duration: 0, easing: "" }

function useStable<T>(value: T, key: string = JSON.stringify(value)): T {
    const ref = useRef({ key, value })
    if (ref.current.key !== key) ref.current = { key, value }
    return ref.current.value
}

function withoutLine(slide: OutSlide | null): OutSlide | null {
    if (!slide) return null
    const copy = clone(slide)
    delete copy.line
    return copy
}

// Port de components/output/OutputImpl.svelte (F24.24a). Compone directamente los ports React:
// el cascarón Svelte y el SvelteIsland desaparecen; el estado del componente vive aquí.
export function Output({ outputId = "", style = "", ratio = 0, mirror = false, preview = false, styleIdOverride = "", outOverride = null }: OutputProps) {
    const currentOutputs = useStore(outputs)
    const currentAllOutputs = useStore(allOutputs)
    const allStyles = useStore(stylesStore)
    const currentEffects = useStore(effects)
    const currentOverlays = useStore(overlays)
    const allMedia = useStore(media)
    const allColorbars = useStore(colorbars)
    const allShows = useStore(showsCache)
    const allTemplates = useStore(templates)
    const currentTransitionData = useStore(transitionData)

    const [currentRatio, setCurrentRatio] = useState(ratio || 1)

    const currentOutput = currentOutputs[outputId] || currentAllOutputs[outputId] || {}
    const scene = useStable<OutScene | null>(outOverride?.scene || currentOutput.out?.scene || null, JSON.stringify(outOverride?.scene || currentOutput.out?.scene || null))
    const sceneStyleId = scene?.style || ""
    const styleId = styleIdOverride || sceneStyleId || currentOutput?.style || ""

    // styling (sólo se refresca cuando cambia el contenido, como en el original)
    const stylingKey = JSON.stringify(getCurrentStyle(allStyles, styleId))
    const currentStyle = useStable<Styles>(getCurrentStyle(allStyles, styleId), stylingKey)
    const alignPosition = currentStyle?.aspectRatio?.alignPosition || "center"

    // capas
    const layersKey = JSON.stringify(currentStyle.layers || defaultLayers)
    const layers = useStable<string[]>(Array.isArray(currentStyle.layers) ? clone(currentStyle.layers) : clone(defaultLayers), layersKey)

    const outSource = outOverride || currentOutput.out || {}
    const outKey = JSON.stringify(outSource)
    const out = useStable<OutData>(clone(outSource), outKey)

    const slideSource = out.slide || null
    const slideKey = JSON.stringify(withoutLine(slideSource))
    const slide = useStable<OutSlide | null>(clone(slideSource), slideKey)
    const backgroundSource = out.background || null
    const backgroundKey = JSON.stringify(backgroundSource)
    const background = useStable<OutBackground | null>(clone(backgroundSource), backgroundKey)
    const effectsSource = out.effects || []
    const effectsKey = JSON.stringify(effectsSource)
    const effectsIds = useStable<string[]>(clone(effectsSource), effectsKey)

    const outputtedEffectIds = sceneHideLayers(scene, sceneStyleId, styleIdOverride) ? [] : effectsIds
    const uniqueEffectIds = [...new Set(outputtedEffectIds)]
    const effectsUnderSlide = uniqueEffectIds.filter((id) => currentEffects[id]?.placeUnderSlide === true)
    const effectsOverSlide = uniqueEffectIds.filter((id) => !currentEffects[id]?.placeUnderSlide)

    // escenas
    const sceneMedia = scene?.media || null
    const sceneHiddenOverlays = scene?.hiddenOverlays || []
    const sceneOverlays = (scene?.overlays || []).filter((id) => !sceneHiddenOverlays.includes(id))
    const hideLayers = sceneHideLayers(scene, sceneStyleId, styleIdOverride)

    // overlays
    const outputtedOverlayIds = hideLayers ? [] : out.overlays || []
    const overlayIds = [...new Set([...sceneOverlays, ...(layers.includes("overlays") ? outputtedOverlayIds : [])])]
    const overlayIdsKey = JSON.stringify(overlayIds)
    const overlaysKey = JSON.stringify(currentOverlays)
    const clonedOverlays = useStable<OverlaysData | null>(clone(currentOverlays), `${overlayIdsKey}|${overlaysKey}`)
    const outOverlays = overlayIds.filter((id) => !clonedOverlays?.[id]?.placeUnderSlide)
    const outUnderlays = overlayIds.filter((id) => clonedOverlays?.[id]?.placeUnderSlide)

    // layout & slide data
    const slideData = useStable<SlideData | null>(
        (() => {
            if (!slide) return null
            const currentLayout = clone(_show(slide.id).layouts([slide.layout]).ref()[0] || [])
            return currentLayout[slide?.index ?? -1]?.data || null
        })(),
        `layout:${slideKey}:${outputId}:${styleId}`
    )

    function buildCurrentSlide(): CurrentSlide | null {
        if (!slide) return null
        const currentLayout = clone(_show(slide.id).layouts([slide.layout]).ref()[0] || [])
        if (!currentLayout) return null
        let next: CurrentSlide
        if (slide.id === "temp" || slide.id === "tempText") {
            next = { items: slide.tempItems }
        } else {
            const slideId = currentLayout[slide?.index ?? -1]?.id || ""
            next = clone((_show(slide.id).slides([slideId]).get()[0] || {}) as CurrentSlide) as CurrentSlide
        }
        next.items = setTemplateStyle(slide, currentStyle, next.items, outputId, next.customDynamicValues) || []
        return next
    }
    const currentSlideSource = buildCurrentSlide()
    const currentSlide = useStable<CurrentSlide | null>(currentSlideSource, JSON.stringify(currentSlideSource))

    // estilos de salida
    const resolution = getResolution(null, { currentOutput, currentStyle }, false, outputId, styleId)
    const transitions = getOutputTransitions(slideData, currentStyle.transition, currentTransitionData, mirror && !preview)
    const slideFilter = getSlideFilter(slideData)

    // template de estilo
    const styleTemplate = useStable(getStyleTemplate(slide, currentStyle), `template:${slideKey}:${stylingKey}`)
    const templateBackground = styleTemplate?.settings?.backgroundPath || ""

    // líneas
    const currentLineId = slide?.id
    const [lines, setLines] = useState<Record<string, SlideLines>>({})
    const linesSource = useRef({ slide, currentStyle, currentLineId, lines })
    linesSource.current = { slide, currentStyle, currentLineId, lines }
    const linesStyleKey = JSON.stringify(currentStyle.lines)
    useEffect(() => {
        const id = linesSource.current.currentLineId
        if (!id) return
        const timeout = setTimeout(() => {
            const source = linesSource.current
            if (!source.slide) return
            const value = getOutputLines(source.slide, source.currentStyle.lines)
            setLines((current) => ({ ...current, [id]: value as SlideLines }))
        }, 10)
        return () => clearTimeout(timeout)
    }, [currentLineId, slideKey, linesStyleKey])

    // metadata
    const metadataItems = getMetadata(allShows[(slide as OutSlide | null)?.id || ""], currentStyle, slide, allTemplates)
    const metadataKey = JSON.stringify(metadataItems)
    const [currentMetadataItems, setCurrentMetadataItems] = useState<Item[]>([])
    const [isMetadataClearing, setIsMetadataClearing] = useState(false)
    useEffect(() => {
        if (metadataItems !== null) {
            setIsMetadataClearing(false)
            setCurrentMetadataItems(clone(metadataItems))
            return
        }
        setIsMetadataClearing(true)
        const timeout = setTimeout(() => setCurrentMetadataItems([]))
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metadataKey])

    // ANIMATE
    const slideAnimation = slideData?.actions?.animate || null
    const animationKey = JSON.stringify(slideAnimation)
    const [animationData, setAnimationData] = useState<AnimationData>({})
    const animationGen = useRef(0)
    useEffect(() => {
        const gen = ++animationGen.current
        setAnimationData({})
        const source = slideAnimation
        if (!slide || !source || !Object.keys(source).length) return
        let cancelled = false

        async function animate(data: AnimationData, index: number) {
            const result = await updateAnimation(data, index, slide, background)
            if (cancelled || gen !== animationGen.current) {
                setAnimationData({})
                return
            }
            setAnimationData(result)
            if (typeof result.newIndex !== "number") return
            if (!result.animation?.repeat && !result.animation?.actions[result.newIndex]) return
            await animate(result, result.newIndex)
        }

        async function initialize() {
            let duration = 50
            if (transitions.text?.type !== "none" && transitions.text?.duration) duration = Math.max(duration, transitions.text.duration / 2)
            const id = uid()
            const animation = clone(source!) as AnimationData["animation"]
            setAnimationData({ id, animation })
            await wait(duration)
            if (cancelled || gen !== animationGen.current) return
            await animate({ id, animation }, 0)
        }
        void initialize()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slideKey, animationKey])

    // valores derivados
    const backgroundColor = currentOutput?.transparent ? "transparent" : styleTemplate?.settings?.backgroundColor || currentSlide?.settings?.color || currentStyle?.background || slide?.settings?.backgroundColor || "black"
    const styleBackground = currentStyle?.clearStyleBackgroundOnText && (slide || background) ? "" : currentStyle?.backgroundImage || ""
    const styleBackgroundData: OutBackground = { path: styleBackground, ...(allMedia[styleBackground] || {}), loop: true }
    const templateBackgroundData: OutBackground = { path: templateBackground, loop: true, ...(allMedia[templateBackground] || {}) }
    const backgroundData = templateBackground ? templateBackgroundData : background
    const textTransition = !slide && backgroundData?.ignoreLayer ? NO_TRANSITION : transitions.text
    const slideMediaTransition = !slide && backgroundData ? NO_TRANSITION : transitions.media
    const overlaysActive = !!((scene === null ? layers.includes("overlays") : true) && clonedOverlays)

    // CLEARING
    const actualLayersKey = JSON.stringify(layers)
    const slideDataKey = JSON.stringify(slideData)
    const currentSlideKey = JSON.stringify(currentSlide)
    const [actual, setActual] = useState<{ slide: OutSlide | null; slideData: SlideData | null; currentSlide: CurrentSlide | null; currentLineId: string | undefined }>({ slide: null, slideData: null, currentSlide: null, currentLineId: undefined })
    const [isSlideClearing, setIsSlideClearing] = useState(false)
    useEffect(() => {
        const slideActive = layers.includes("slide") && !hideLayers
        setIsSlideClearing(!slide || !slideActive)
        const timeout = setTimeout(
            () => {
                setActual({
                    slide: slideActive ? clone(slide) : null,
                    slideData: clone(slideData),
                    currentSlide: clone(currentSlide),
                    currentLineId
                })
            },
            slide ? 10 : 0
        )
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slideKey, actualLayersKey, hideLayers, slideDataKey, currentSlideKey, currentLineId])

    function zoomedStyle(value: number): CSSProperties {
        return { zoom: value }
    }

    return (
        <>
            <Zoomed id={outputId} background={backgroundColor} checkered={(preview || mirror) && backgroundColor === "transparent"} backgroundDuration={transitions.media?.type === "none" ? 0 : (transitions.media?.duration ?? 800)} align={alignPosition} center style={style} resolution={resolution} styleIdOverride={styleId} mirror={mirror} onRatioChange={setCurrentRatio}>
                {/* siempre mostrar el background del estilo (detrás del resto) */}
                {styleBackground && actual.slide?.type !== "pdf" ? <Background data={styleBackgroundData} outputId={outputId} transition={transitions.media} currentStyle={currentStyle} slideFilter={slideFilter} ratio={currentRatio} animationStyle={animationData.style?.background || ""} mirror /> : null}

                {sceneMedia ? <SceneMedia media={sceneMedia} /> : null}

                {(backgroundData?.ignoreLayer ? layers.includes("slide") : layers.includes("background")) && !hideLayers && backgroundData ? <Background data={backgroundData} outputId={outputId} transition={transitions.media} currentStyle={currentStyle} slideFilter={slideFilter} ratio={currentRatio} animationStyle={animationData.style?.background || ""} mirror={mirror} /> : null}

                {allColorbars[outputId] ? <Image path={`./assets/${allColorbars[outputId]}`} mediaStyle={{ rendering: "pixelated", fit: "fill" }} /> : null}

                {effectsUnderSlide.length && layers.includes("overlays") ? <EffectOutput ids={effectsUnderSlide} transition={transitions.overlay} mirror={mirror} /> : null}

                {overlaysActive ? <OverlaysLayer outputId={outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} mirror={mirror} preview={preview} styleIdOverride={styleIdOverride || sceneStyleId} /> : null}

                {actual.slide?.type === "pdf" && layers.includes("background") ? (
                    <span style={zoomedStyle(1 / currentRatio)}>
                        <PdfOutput slide={actual.slide} currentStyle={currentStyle} transition={slideMediaTransition} />
                    </span>
                ) : actual.slide?.type === "ppt" && layers.includes("slide") ? (
                    <span style={zoomedStyle(1 / currentRatio)}>{actual.slide?.screen?.id ? <WindowView id={actual.slide.screen.id} class="media" style="width: 100%;height: 100%;" /> : null}</span>
                ) : actual.slide && actual.slide.type !== "pdf" ? (
                    <>
                        <SlideContent outputId={outputId} outSlide={actual.slide} isClearing={isSlideClearing} slideData={actual.slideData} currentSlide={actual.currentSlide as Slide | null} currentStyle={currentStyle} animationData={animationData} currentLineId={actual.currentLineId} lines={lines as never} ratio={currentRatio} mirror={mirror} preview={preview} transition={textTransition} transitionEnabled={!mirror || preview} styleIdOverride={styleIdOverride || sceneStyleId} />
                        <Overlay overlay={{ items: currentMetadataItems }} isClearing={isMetadataClearing || isSlideClearing} outputId={outputId} transition={textTransition} styleIdOverride={styleIdOverride || sceneStyleId} />
                    </>
                ) : null}

                {effectsOverSlide.length && layers.includes("overlays") ? <EffectOutput ids={effectsOverSlide} transition={transitions.overlay} mirror={mirror} /> : null}

                {overlaysActive ? <OverlaysLayer outputId={outputId} overlays={clonedOverlays} activeOverlays={outOverlays} transition={transitions.overlay} mirror={mirror} preview={preview} styleIdOverride={styleIdOverride || sceneStyleId} /> : null}

                {actual.slide?.attributionString && layers.includes("slide") ? (
                    mirror ? (
                        <p className={css.attributionString}>{actual.slide.attributionString.slice(0, 135)}</p>
                    ) : (
                        <OutputTransition inTransition={textTransition} outTransition={textTransition}>
                            <p className={css.attributionString}>{actual.slide.attributionString.slice(0, 135)}</p>
                        </OutputTransition>
                    )
                ) : null}
            </Zoomed>
        </>
    )
}

function sceneHideLayers(scene: OutScene | null, sceneStyleId: string, styleIdOverride: string): boolean {
    return styleIdOverride ? false : scene !== null && !sceneStyleId
}

export default Output
