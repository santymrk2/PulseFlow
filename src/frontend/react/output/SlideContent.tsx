import { useEffect, useRef, useState } from "react"
import type { AnimationData, Item, OutSlide, Slide, SlideData, TimelineAction, Transition } from "../../../types/Show"
import type { Styles } from "../../../types/Settings"
import { scriptureSettings, showsCache, slideTimelineSpeedMultiplier, templates } from "../../stores"
import { waitUntilValueIsDefined } from "../../utils/common"
import { shouldItemBeShown } from "../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { loadCustomFonts } from "../../components/helpers/fonts"
import { getStyleTemplate, itemNeedsAutoSize, slideHasAutoSizeItem } from "../../components/helpers/output"
import { SlideTimeline } from "../../components/timeline/SlideTimeline"
import { useStore } from "../hooks/useStore"
import { Textbox, type TextboxRef } from "../slide/Textbox"
import { SlideItemTransition, type LineInfo } from "./SlideItemTransition"
import css from "./SlideContent.module.css"

export interface SlideContentProps {
    outputId: string
    outSlide: OutSlide
    isClearing?: boolean
    slideData: SlideData | null
    currentSlide: Slide | null
    currentStyle: Styles | null
    animationData: AnimationData
    currentLineId?: string
    lines: Record<string, LineInfo>
    ratio: number
    mirror?: boolean
    preview?: boolean
    transition?: Transition
    transitionEnabled?: boolean
    styleIdOverride?: string
}

interface SlideContext {
    outSlide: OutSlide | null
    slideData: SlideData | null
    currentSlide: Slide | null
    lines: Record<string, LineInfo>
    currentStyle: Styles | null
}

interface AutoSizeTarget {
    item: Item
    index: number
    key: string
}

const EMPTY_CONTEXT: SlideContext = { outSlide: null, slideData: null, currentSlide: null, lines: {}, currentStyle: null }

function hasLinesContent(item: Item | undefined): boolean {
    if (!item) return false
    return !!getItemText(item).length
}

function itemsAreEqual(oldItem: Item | undefined, newItem: Item | undefined): boolean {
    if (!oldItem || !newItem) return false
    return JSON.stringify(oldItem) === JSON.stringify(newItem)
}

function createAutoSizeKey(item: Item | undefined, index: number): string {
    return item?.id ? String(item.id) : `idx-${index}`
}

function stripOutSlide(outSlide: OutSlide): OutSlide {
    const copy = clone(outSlide)
    delete copy.line
    delete copy.revealCount
    delete copy.itemClickReveal
    return copy
}

// Port de components/output/layers/SlideContentImpl.svelte (F24.24a). El cascarón Svelte se elimina:
// las transiciones entre items, el precompute de autosize y el timeline viven aquí.
export function SlideContent({ outputId, outSlide, isClearing = false, slideData, currentSlide, currentStyle, animationData, currentLineId, lines, ratio, mirror = false, preview = false, transition, transitionEnabled = false, styleIdOverride = "" }: SlideContentProps) {
    const allShows = useStore(showsCache)
    const allTemplates = useStore(templates)
    const scripture = useStore(scriptureSettings) as { template?: string }
    const timelineSpeed = useStore(slideTimelineSpeedMultiplier)

    const [origin, setOrigin] = useState("")
    const [currentItems, setCurrentItems] = useState<Item[]>([])
    const [show, setShow] = useState(false)
    const [persistentItems, setPersistentItems] = useState<Item[]>([])
    const [persistentItemIndexes, setPersistentItemIndexes] = useState<number[]>([])
    const [precomputeTargets, setPrecomputeTargets] = useState<AutoSizeTarget[]>([])
    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const [transitioningBetween, setTransitioningBetween] = useState(false)
    const [current, setCurrentState] = useState<SlideContext>(EMPTY_CONTEXT)
    const [, setTimelineVersion] = useState(0)

    const values = useRef({ outSlide, slideData, currentSlide, currentStyle, lines, transition, transitionEnabled, isClearing, preview, ratio, mirror, styleIdOverride })
    values.current = { outSlide, slideData, currentSlide, currentStyle, lines, transition, transitionEnabled, isClearing, preview, ratio, mirror, styleIdOverride }

    const currentRef = useRef(current)
    currentRef.current = current
    const currentItemsRef = useRef(currentItems)
    currentItemsRef.current = currentItems
    const persistentItemsRef = useRef(persistentItems)
    persistentItemsRef.current = persistentItems
    const precomputePending = useRef(new Set<string>())
    const onPrecomputeDone = useRef<(() => void) | null>(null)
    const clearingToEmpty = useRef(false)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const updateGeneration = useRef(0)
    const showItemRef = useRef({ outputId, slideIndex: outSlide?.index })

    function setCurrent(next: SlideContext) {
        currentRef.current = next
        setCurrentState(next)
    }

    useEffect(() => {
        const currentShow = allShows[outSlide.id]
        loadCustomFonts(currentShow?.settings?.customFonts || [])
        setOrigin(currentShow?.origin || "")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outSlide.id])

    const isMic = JSON.stringify((currentItems as (Item & { conditions?: unknown })[]).map((a) => a?.conditions) || "").includes('"element":"volume"')
    useEffect(() => {
        const interval = setInterval(
            () => {
                if (values.current.isClearing || !Array.isArray(currentItemsRef.current)) return
                if (currentItemsRef.current.find((a) => a?.conditions)) setConditionsUpdater((value) => value + 1)
            },
            isMic ? 100 : 300
        )
        return () => clearInterval(interval)
    }, [isMic])

    const outSlideKey = JSON.stringify(stripOutSlide(outSlide))
    const outSlideFullKey = JSON.stringify(outSlide)
    const linesKey = JSON.stringify(lines)
    const currentSlideItems = currentSlide?.items
    const currentSlideItemsKey = JSON.stringify(currentSlideItems)

    // el contexto se actualiza en click reveal / línea sin refrescar los items
    useEffect(() => {
        const context = currentRef.current
        if (!context.outSlide) return
        setCurrent({
            ...context,
            outSlide: { ...context.outSlide, itemClickReveal: outSlide.itemClickReveal, revealCount: outSlide.revealCount, line: outSlide.line },
            lines: clone(lines)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outSlideFullKey, linesKey])

    function scheduleAutoSizePrecompute(items: Item[] | undefined) {
        onPrecomputeDone.current = null
        if (values.current.preview || !Array.isArray(items) || !items.length) {
            setPrecomputeTargets([])
            precomputePending.current.clear()
            return
        }
        const targets: AutoSizeTarget[] = []
        const pending = new Set<string>()
        items.forEach((item, index) => {
            if (!itemNeedsAutoSize(item)) return
            const key = createAutoSizeKey(item, index)
            if (!key || item.autoFontSize) return
            pending.add(key)
            targets.push({ item: clone(item), index, key })
        })
        setPrecomputeTargets(targets)
        precomputePending.current = pending
    }

    function handlePrecomputeReady(detail: { key: string; fontSize: number }) {
        const key = detail?.key
        if (!key || !precomputePending.current.has(key)) return
        precomputePending.current.delete(key)
        if (!precomputePending.current.size) {
            setPrecomputeTargets([])
            onPrecomputeDone.current?.()
            onPrecomputeDone.current = null
        }
    }

    function incomingNeedsAutoSize(): boolean {
        const v = values.current
        if ((v.currentSlide as (Slide & { items?: Item[] }) | null)?.items?.some(itemNeedsAutoSize)) return true
        let customTemplate = getStyleTemplate(v.outSlide, v.currentStyle || undefined)
        if (!Object.keys(customTemplate).length && v.outSlide?.id === "temp") customTemplate = (allTemplates[scripture.template || ""] || {}) as typeof customTemplate
        return slideHasAutoSizeItem(customTemplate as unknown as Slide)
    }

    useEffect(() => {
        const v = values.current
        const betweenClearingTransition = clone(v.transition?.between || v.transition || {}) as Transition
        if (betweenClearingTransition?.type === "none") betweenClearingTransition.duration = 0
        const items = v.currentSlide?.items

        async function updateItems() {
            if (!items?.length) {
                scheduleAutoSizePrecompute([])
                setCurrentItems([])
                setPersistentItems([])
                setPersistentItemIndexes([])
                setCurrent({ outSlide: clone(v.outSlide), slideData: clone(v.slideData), currentSlide: clone(v.currentSlide), lines: clone(v.lines), currentStyle: clone(v.currentStyle) })
                if (v.transitionEnabled) {
                    clearingToEmpty.current = true
                    setTimeout(() => (clearingToEmpty.current = false), betweenClearingTransition.duration)
                }
                return
            }

            if (clearingToEmpty.current) await waitUntilValueIsDefined(() => !clearingToEmpty.current, 10, betweenClearingTransition.duration)
            scheduleAutoSizePrecompute(items)

            const oldItemTransition = currentItemsRef.current.find((a) => a.actions?.transition)?.actions?.transition
            const newItemTransition = items.find((a) => a.actions?.transition)?.actions?.transition
            let itemTransitionDuration: number | null = null
            if (oldItemTransition && JSON.stringify(oldItemTransition) === JSON.stringify(newItemTransition)) {
                itemTransitionDuration = oldItemTransition.duration ?? null
                if (oldItemTransition.type === "none") itemTransitionDuration = 0
                else if (items.find((a) => a.actions?.transition?.duration === 0 || a.actions?.transition?.type === "none")) itemTransitionDuration = 0
            }

            const currentTransition = clone(v.transition?.between || v.transition?.in || v.transition || {}) as Transition
            if (currentTransition?.type === "none") currentTransition.duration = 0
            const currentTransitionDuration = v.transitionEnabled ? (itemTransitionDuration ?? currentTransition?.duration ?? 0) : 0
            const waitToShow = currentTransitionDuration * ((currentTransition?.fadeInOffset ?? 50) / 100)

            const newPersistentIndexes: number[] = []
            const newPersistentItems: Item[] = []
            const transitioningItems: Item[] = []
            items.forEach((newItem, newIndex) => {
                const oldItem = currentItemsRef.current[newIndex]
                if (!hasLinesContent(newItem) && itemsAreEqual(oldItem, newItem)) {
                    newPersistentIndexes.push(newIndex)
                    newPersistentItems.push(clone(newItem))
                } else {
                    transitioningItems.push(clone(newItem))
                }
            })
            setPersistentItemIndexes(newPersistentIndexes)
            setPersistentItems(newPersistentItems)

            const previous = currentRef.current
            const isDifferentSlide = previous.currentSlide?.id !== v.currentSlide?.id || previous.outSlide?.index !== v.outSlide?.index || previous.outSlide?.id !== v.outSlide?.id
            if (isDifferentSlide && currentItemsRef.current.length && items.length) setTransitioningBetween(true)

            if (timeout.current) clearTimeout(timeout.current)
            if (transitioningItems.length === 0 && persistentItemsRef.current.length > 0) {
                setCurrent({ outSlide: clone(v.outSlide), slideData: clone(v.slideData), currentSlide: clone(v.currentSlide), lines: clone(v.lines), currentStyle: clone(v.currentStyle) })
                setCurrentItems(clone(items))
                setTransitioningBetween(false)
                return
            }

            const gen = ++updateGeneration.current
            timeout.current = setTimeout(() => {
                if (gen !== updateGeneration.current) return
                setShow(false)
                timeout.current = setTimeout(() => {
                    if (gen !== updateGeneration.current) return
                    setCurrentItems(clone(items))
                    setCurrent({ outSlide: clone(v.outSlide), slideData: clone(v.slideData), currentSlide: clone(v.currentSlide), lines: clone(v.lines), currentStyle: clone(v.currentStyle) })
                    timeout.current = setTimeout(() => {
                        if (gen !== updateGeneration.current) return
                        const showSlide = () => {
                            if (gen !== updateGeneration.current) return
                            setShow(true)
                            timeout.current = setTimeout(() => {
                                if (gen === updateGeneration.current) setTransitioningBetween(false)
                            })
                        }
                        if (precomputePending.current.size) {
                            const safetyTimer = setTimeout(showSlide, 150)
                            onPrecomputeDone.current = () => {
                                clearTimeout(safetyTimer)
                                showSlide()
                            }
                        } else {
                            showSlide()
                        }
                    }, waitToShow)
                })
            })
        }
        void updateItems()
        return () => {
            if (timeout.current) clearTimeout(timeout.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSlideItemsKey, outSlideKey, linesKey])

    // OUTPUT SLIDE TIMELINE
    const timelinePos = useRef(0)
    const timelineItems = useRef(new Map<string, Item[]>())
    const timelineActions = useRef<TimelineAction[]>([])
    const isReady = useRef(false)

    useEffect(() => {
        isReady.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outSlideKey])

    useEffect(() => {
        if (isReady.current) return
        timelinePos.current = 0
        timelineActions.current = (currentSlide?.timeline?.actions as TimelineAction[]) || []
        const timeout = setTimeout(() => (isReady.current = true))
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSlideItemsKey])

    useEffect(() => {
        function getPreviousAction(actions: TimelineAction[], now: number) {
            return actions.reduce((prev, curr) => (curr.time > (prev?.time ?? -1) && curr.time <= now ? curr : prev), null as TimelineAction | null)
        }
        function getNextAction(actions: TimelineAction[], now: number) {
            return actions.reduce((next, curr) => (curr.time > now && (next === null || curr.time < next.time) ? curr : next), null as TimelineAction | null)
        }
        function styleActions(actions: TimelineAction[]) {
            const grouped = new Map<string, TimelineAction[]>()
            for (const action of actions.filter((a) => a.type === "style")) {
                const key = action.data?.key
                if (!key) continue
                const indexes = action.data?.indexes ? action.data.indexes.join(",") : ""
                const groupKey = `${key}-${indexes}`
                if (!grouped.has(groupKey)) grouped.set(groupKey, [])
                grouped.get(groupKey)?.push(action)
            }
            const slideKey = `${values.current.outSlide?.id}-${values.current.outSlide?.layout}-${values.current.outSlide?.index}`
            const items = clone(timelineItems.current.get(slideKey) || currentItemsRef.current)
            grouped.forEach((group) => {
                const previous = getPreviousAction(group, timelinePos.current)
                const next = getNextAction(group, timelinePos.current)
                const value = SlideTimeline.interpolateValue(previous, next, timelinePos.current)
                if (value === null) return
                const action = (previous || next)!
                const indexes = action.data.indexes ?? [0]
                indexes.forEach((itemIndex) => {
                    const item = items[itemIndex]
                    if (!item) return
                    items[itemIndex] = SlideTimeline.updateStyle(action, item, value)
                })
            })
            timelineItems.current.set(slideKey, items)
            setTimelineVersion((version) => version + 1)
        }

        const interval = setInterval(() => {
            const v = values.current
            if (v.isClearing || !isReady.current || !timelineActions.current.length) return
            timelinePos.current += 15 * timelineSpeed
            styleActions(timelineActions.current)
            if ((v.currentSlide?.timeline as { loop?: boolean } | undefined)?.loop) {
                const lastActionTime = Math.max(...timelineActions.current.map((a) => a.time + (a.duration || 0) * 1000))
                if (timelinePos.current >= lastActionTime) timelinePos.current = 0
            }
        }, 15)
        return () => clearInterval(interval)
    }, [timelineSpeed, isClearing])

    const timelineKey = `${current.outSlide?.id}-${current.outSlide?.layout}-${current.outSlide?.index}`
    const needsAutoSize = incomingNeedsAutoSize()

    function textboxRef(output: Record<string, unknown> | OutSlide | null): TextboxRef {
        return {
            type: "show",
            showId: output?.id === undefined ? "" : String(output.id),
            slideId: current.currentSlide?.id || "",
            id: current.currentSlide?.id || "",
            layoutId: output?.layout === undefined ? "" : String(output.layout),
            origin
        }
    }

    return (
        <>
            {currentItems.map((item, index) => {
                if (!item || !shouldItemBeShown(item, [], showItemRef.current, conditionsUpdater) || (item.clickReveal && !current.outSlide?.itemClickReveal)) return null
                const timelineItem = timelineItems.current.get(timelineKey)?.[index] || item
                const autoSizeKey = createAutoSizeKey(item, index)
                if (persistentItemIndexes.includes(index)) {
                    return (
                        <Textbox
                            key={`persistent-${index}`}
                            backdropFilter={String(current.slideData?.["backdrop-filter"] || "")}
                            chords={Boolean(item.chords?.enabled)}
                            animationStyle={(animationData.style || {}) as { item?: string; text?: string }}
                            item={timelineItem}
                            transition={null}
                            ratio={ratio}
                            outputId={outputId}
                            ref={textboxRef(current.outSlide)}
                            linesStart={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
                            linesEnd={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
                            clickRevealed={!!current.lines?.[currentLineId || ""]?.clickRevealed}
                            outputStyle={current.currentStyle}
                            mirror={mirror}
                            preview={preview}
                            slideIndex={current.outSlide?.index}
                            styleIdOverride={styleIdOverride}
                            autoSizeKey={autoSizeKey}
                            updateDynamicValues={!isClearing}
                        />
                    )
                }
                if (!show) return null
                return (
                    <SlideItemTransition
                        key={`${index}-${show}`}
                        preview={preview}
                        transitionEnabled={transitionEnabled}
                        transitioningBetween={transitioningBetween}
                        isClearing={isClearing}
                        incomingNeedsAutoSize={needsAutoSize}
                        globalTransition={transition || ({} as Transition)}
                        currentSlide={current.currentSlide as unknown as Record<string, unknown>}
                        item={item}
                        outSlide={current.outSlide as unknown as Record<string, unknown>}
                        lines={current.lines}
                        currentStyle={current.currentStyle as unknown as Record<string, unknown>}
                    >
                        {({ customItem, customLines, customOut, transition: itemTransition }) => (
                            <Textbox
                                backdropFilter={String(current.slideData?.["backdrop-filter"] || "")}
                                chords={Boolean(customItem.chords?.enabled)}
                                animationStyle={(animationData.style || {}) as { item?: string; text?: string }}
                                item={timelineItems.current.get(`${customOut?.id}-${customOut?.layout}-${customOut?.index}`)?.[index] || customItem}
                                transition={itemTransition}
                                ratio={ratio}
                                outputId={outputId}
                                ref={textboxRef(customOut)}
                                linesStart={customLines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
                                linesEnd={customLines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
                                clickRevealed={!!customLines?.[currentLineId || ""]?.clickRevealed}
                                outputStyle={current.currentStyle}
                                mirror={mirror}
                                preview={preview}
                                slideIndex={typeof customOut?.index === "number" ? customOut.index : undefined}
                                styleIdOverride={styleIdOverride}
                                autoSizeKey={autoSizeKey}
                                updateDynamicValues={!isClearing}
                            />
                        )}
                    </SlideItemTransition>
                )
            })}

            {precomputeTargets.length ? (
                <div className={css.autosizePrecompute} aria-hidden="true">
                    {precomputeTargets.map((target) => (
                        <Textbox key={target.key} item={target.item} ratio={ratio} outputId={outputId} outputStyle={currentStyle} mirror={mirror} preview={preview} styleIdOverride={styleIdOverride} ref={{ type: "show", showId: outSlide?.id, slideId: currentSlide?.id, id: currentSlide?.id || "", layoutId: outSlide?.layout, origin }} autoSizeKey={target.key} onAutosizeReady={handlePrecomputeReady} updateDynamicValues={!isClearing} />
                    ))}
                </div>
            ) : null}
        </>
    )
}

export default SlideContent
