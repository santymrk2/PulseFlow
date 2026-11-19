import { useEffect, useRef, useState, type ReactNode } from "react"
import { uid } from "uid"
import type { Item, OutSlide, Transition } from "../../../types/Show"
import type { Styles } from "../../../types/Settings"
import { scriptureSettings, templates } from "../../shared/core/stores"
import { clone } from "../../shared/utils/helpers/array"
import { getStyleTemplate, itemNeedsAutoSize, slideHasAutoSizeItem } from "../../shared/utils/helpers/output"
import { useStore } from "../../shared/ui/hooks/useStore"
import { OutputTransition } from "./OutputTransition"

export interface LineInfo {
    start?: number | null
    end?: number | null
    linesStart?: number | null
    linesEnd?: number | null
    clickRevealed?: boolean
}

export interface TransitionRenderProps {
    customItem: Item
    customLines: Record<string, LineInfo>
    customOut: Record<string, unknown>
    customSlide: Record<string, unknown>
    transition: Transition | null
}

export interface SlideItemTransitionProps {
    globalTransition: Transition
    transitionEnabled?: boolean
    transitioningBetween?: boolean
    isClearing?: boolean
    incomingNeedsAutoSize?: boolean
    preview?: boolean
    item: Item
    currentSlide?: Record<string, unknown>
    outSlide?: Record<string, unknown>
    lines?: Record<string, LineInfo>
    currentStyle?: Record<string, unknown>
    children: (props: TransitionRenderProps) => ReactNode
}

interface TransitionState {
    item: Item
    lines: Record<string, LineInfo>
    outSlide: Record<string, unknown>
    currentSlide: Record<string, unknown>
    inTransition: Transition
    outTransition: Transition
    transitionBetween: Transition
    autoSizeDelay: number
}

function getClearingOutTransition(global: Transition, currentItem: Item, preview: boolean): Transition {
    const source = currentItem?.actions?.transition || global || ({} as Transition)
    const out = clone(source.out || source) as Transition
    if (out.type === "none") out.duration = 0
    const hideDuration = preview ? currentItem?.actions?.hideTimer || 0 : 0
    out.delay = hideDuration ? hideDuration * 1000 : 0
    if (out.delay && (out.type === "none" || !out.duration)) return { ...out, type: "fade", duration: 1 }
    return out
}

// Port de components/output/transitions/SlideItemTransition.svelte (F24.20c).
// El `<slot let:customItem …>` pasa a ser un render prop con el mismo detalle.
export function SlideItemTransition({ globalTransition, transitionEnabled = false, transitioningBetween = false, isClearing = false, incomingNeedsAutoSize = true, preview = false, item, currentSlide = {}, outSlide = {}, lines = {}, currentStyle = {}, children }: SlideItemTransitionProps) {
    const currentTemplates = useStore(templates)
    const currentScriptureSettings = useStore(scriptureSettings)
    const [currentlyTransitioning, setCurrentlyTransitioning] = useState<Record<string, TransitionState>>({})
    const [currentOut, setCurrentOut] = useState<Record<string, TransitionState>>({})
    const knownIds = useRef<string[]>([])
    const values = useRef({ item, lines, outSlide, currentSlide })
    values.current = { item, lines, outSlide, currentSlide }

    const itemKey = JSON.stringify(item)
    const linesKey = JSON.stringify(lines)
    const outSlideKey = JSON.stringify(outSlide)
    const currentSlideKey = JSON.stringify(currentSlide)
    const globalKey = JSON.stringify(globalTransition)

    useEffect(() => {
        const { item: currentItem, lines: currentLines, outSlide: currentOutSlide, currentSlide: slide } = values.current
        setCurrentlyTransitioning((all) => {
            const lastId = Object.keys(all).pop()
            const last = lastId ? all[lastId] : undefined
            if (last && JSON.stringify(last.item) === JSON.stringify(currentItem) && JSON.stringify(last.lines) === JSON.stringify(currentLines) && JSON.stringify(last.outSlide) === JSON.stringify(currentOutSlide) && JSON.stringify(last.currentSlide) === JSON.stringify(slide)) return all

            const itemTransition = currentItem.actions?.transition ? clone(currentItem.actions.transition) : null
            if (itemTransition?.type === "none") itemTransition.duration = 0

            const base = itemTransition || globalTransition
            if (base?.type === "none") base.duration = 0

            let inTransition = clone(base.in || base) as Transition
            let outTransition = clone(base.out || base) as Transition
            let transitionBetween = clone(base.between || base) as Transition
            if (transitioningBetween) inTransition = clone(transitionBetween)

            const showDuration = preview ? currentItem?.actions?.showTimer || 0 : 0
            const hideDuration = preview ? currentItem?.actions?.hideTimer || 0 : 0
            let inDelay = showDuration ? showDuration * 1000 : 0
            let outDelay = hideDuration ? hideDuration * 1000 : 0
            let autoSizeDelay = 0

            if (!outDelay) {
                let customTemplate = getStyleTemplate(currentOutSlide as unknown as OutSlide, currentStyle as unknown as Styles)
                if (!Object.keys(customTemplate).length && currentOutSlide?.id === "temp") customTemplate = currentTemplates[currentScriptureSettings.template] || {}

                const templateNeedsAutoSize = slideHasAutoSizeItem(customTemplate as unknown as import("../../../types/Show").Slide)
                if (templateNeedsAutoSize || itemNeedsAutoSize(currentItem as unknown as Item)) {
                    autoSizeDelay = 500
                    outDelay = autoSizeDelay
                    if (!inDelay) inDelay = outDelay * 0.98
                }
            }

            if (!outDelay && itemTransition?.duration === 0 && currentItem.type === "media") outDelay = 250

            inTransition.delay = inDelay
            outTransition.delay = outDelay
            transitionBetween.delay = outDelay
            if (inDelay && (inTransition.type === "none" || inTransition.duration === 0)) inTransition = { ...inTransition, type: "fade", duration: 1 }
            if (outDelay && (outTransition.type === "none" || outTransition.duration === 0)) outTransition = { ...outTransition, type: "fade", duration: 1 }

            const id = `state_${uid(5)}`
            return {
                ...all,
                [id]: {
                    item: clone(currentItem),
                    lines: clone(currentLines),
                    outSlide: clone(currentOutSlide),
                    currentSlide: clone(slide),
                    inTransition,
                    outTransition,
                    transitionBetween,
                    autoSizeDelay
                }
            }
        })
        // Igual que el statement reactivo del original: reacciona al contenido, no a la identidad del objeto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemKey, linesKey, outSlideKey, currentSlideKey, globalKey, preview, transitioningBetween])

    useEffect(() => {
        const newId = Object.keys(currentlyTransitioning).find((id) => !knownIds.current.includes(id))
        if (!newId) return
        setCurrentOut(clone(currentlyTransitioning))
        knownIds.current = Object.keys(currentlyTransitioning)
    }, [currentlyTransitioning])

    const clearingOutTransition = getClearingOutTransition(globalTransition, item, preview)

    return (
        <>
            {Object.values(currentOut).map((transitioning) => {
                const outTransition = !transitionEnabled ? null : isClearing ? clearingOutTransition : getOutTransition(transitioning, incomingNeedsAutoSize, transitioningBetween)
                return (
                    <OutputTransition key={transitioning.item.id || undefined} inTransition={transitionEnabled ? transitioning.inTransition : null} outTransition={outTransition}>
                        {children({
                            customItem: transitioning.item,
                            customLines: transitioning.lines,
                            customOut: transitioning.outSlide,
                            customSlide: transitioning.currentSlide,
                            transition: transitionEnabled ? transitioning.inTransition : null
                        })}
                    </OutputTransition>
                )
            })}
        </>
    )
}

function getOutTransition(transitioning: TransitionState, needsAutoSize: boolean, transitioningBetween: boolean): Transition {
    const transition = transitioningBetween ? transitioning.transitionBetween : transitioning.outTransition
    if (!needsAutoSize && transitioning.autoSizeDelay) return { ...transition, delay: Math.max(0, (transition.delay || 0) - transitioning.autoSizeDelay) }
    return transition
}

export default SlideItemTransition
