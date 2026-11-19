import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { MediaStyle } from "../../../types/Main"
import type { StageItem, StageLayout as TStageLayout } from "../../../types/Stage"
import { activePopup, activeStage, activeTimers, allOutputs, dictionary, outputs, outputSlideCache, refreshEditSlide, stageShows, timers, variables } from "../../shared/core/stores"
import { startResizing } from "../../shared/utils/cursor"
import { translateText } from "../../shared/utils/language"
import { sendBackgroundToStage } from "../../utils/stageTalk"
import autosize from "../../components/edit/scripts/autosize"
import { isConditionMet } from "../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { getExtension, loadThumbnail, mediaSize } from "../../shared/utils/helpers/media"
import { videoExtensions } from "../../shared/core/values/extensions"
import { getActiveOutputs, getStageResolution, percentageStylePos } from "../../shared/utils/helpers/output"
import { createCSSVariables, replaceDynamicValues } from "../../shared/utils/helpers/showActions"
import { getStyles } from "../../shared/utils/helpers/style"
import { getCustomStageLabel, getSlideTextItems, stageItemToItem } from "../../components/stage/stage"
import { EditboxLines } from "../edit/editbox/EditboxLines"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { Media } from "../output/Media"
import { Output } from "../output/Output"
import { Clock } from "../system/Clock"
import { Movebox } from "../system/Movebox"
import { Button } from "../ui/button/Button"
import { SlideItems } from "../slide/SlideItems"
import { SlideProgress } from "../slide/views/SlideProgress"
import { Textbox } from "../slide/Textbox"
import { Timer } from "../slide/views/Timer"
import { Variable } from "../slide/views/Variable"
import { SlideNotes } from "./SlideNotes"
import { SlideText } from "./SlideText"
import { StageLayout } from "./StageLayout"
import styles from "./Stagebox.module.css"

export interface StageboxMouse {
    x: number
    y: number
    width: number
    height: number
    top: number
    left: number
    offset: { x: number; y: number; width: number; height: number }
    item: StageItem & { type: string }
    e: MouseEvent
    dragMove?: boolean
    rightClick?: boolean
}

export interface StageboxProps {
    id: string
    item?: StageItem
    stageLayout?: TStageLayout | null
    ratio: number
    preview?: boolean
    edit?: boolean
    disableStagePreview?: boolean
    onMouseChange?: (mouse: StageboxMouse) => void
    getLayoutMounted?: () => boolean
}

type BackgroundFrame = { path?: string; filePath?: string; mediaStyle?: Record<string, unknown> }
type StageBackground = BackgroundFrame & { next?: BackgroundFrame; next2?: BackgroundFrame }

const MAX_AUTOSIZE_RETRIES = 5

// Port de components/stage/Stagebox.svelte (F24.19a). `bind:mouse` → onMouseChange.
// El context Svelte `layoutMounted` se pasa como getLayoutMounted.
export function Stagebox({ id, item, stageLayout = null, ratio, preview = false, edit = false, disableStagePreview = false, onMouseChange, getLayoutMounted }: StageboxProps) {
    const currentActiveStage = useStore(activeStage)
    const currentActivePopup = useStore(activePopup)
    const currentActiveTimers = useStore(activeTimers)
    const currentAllOutputs = useStore(allOutputs)
    const currentDictionary = useStore(dictionary)
    const currentOutputs = useStore(outputs)
    const currentOutputSlideCache = useStore(outputSlideCache)
    const currentRefreshEditSlide = useStore(refreshEditSlide)
    const currentStageShows = useStore(stageShows)
    const currentTimers = useStore(timers)
    const currentVariables = useStore(variables)

    const [today, setToday] = useState(() => new Date())
    const [isShiftPressed, setIsShiftPressed] = useState(false)
    const [size, setSize] = useState(100)
    const [currentBackground, setCurrentBackground] = useState<StageBackground | null>(null)
    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const [updateTrigger, setUpdateTrigger] = useState(0)
    const [flashTriggerId, setFlashTriggerId] = useState(0)

    const alignRef = useRef<HTMLDivElement>(null)
    const prevAutoSizeKey = useRef("")
    const autoSizeRetryCount = useRef(0)
    const autoSizeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastText = useRef("")

    const currentShow = stageLayout === null ? (currentActiveStage.id ? currentStageShows[currentActiveStage.id] : null) : stageLayout
    const slideOffset = item?.type ? Number(item.slideOffset || 0) : id.includes("next") ? 1 : 0

    const sourceOutputId = currentShow?.settings?.output
    const stageOutputId = sourceOutputId && currentOutputs[sourceOutputId] ? sourceOutputId : getActiveOutputs(currentOutputs, false, true, true)[0]
    const currentOutput = currentOutputs[stageOutputId] || {}
    const currentSlide = currentOutput.out?.slide || (slideOffset !== 0 ? currentOutputSlideCache[stageOutputId] || null : null)
    const outputWindowId = item?.currentOutput?.source || stageOutputId

    const fontSize = Number(getStyles(item?.style, true)?.["font-size"] || 0) || 100
    const autoSizeEnabled = item?.type === "current_output" || item?.type === "slide_text" ? false : item?.type?.includes("text") ? item?.auto || (item?.textFit && item?.textFit !== "none") : item?.auto !== false || item?.textFit !== "none"

    const firstTimerId = item?.type === "timer" || id.includes("first_active_timer") ? item?.timer?.id || currentActiveTimers[0]?.id || Object.values(currentTimers).find((timer) => timer.type !== "counter")?.id || "" : ""

    const newItem = item?.type === "timer" && firstTimerId && item.timer?.id !== firstTimerId ? { ...item, timer: { ...(item.timer || {}), id: firstTimerId } } : item

    const currentItemText = item ? (item.type === "slide_text" ? getSlideTextItems(stageLayout!, item).map(getItemText).join("") : getItemText(stageItemToItem(item))) : ""
    const autoSizeKey = `${currentSlide?.id || ""}_${item?.style || ""}_${item?.textFit || ""}_${item?.auto ?? ""}_${currentItemText || ""}`

    const showItemState = edit && item?.conditions?.showItem ? isConditionMet(item.conditions.showItem, currentItemText, "stage", conditionsUpdater) : false
    const isDisabledVariable = id.includes("variables") && currentVariables[id.split("#")[1]]?.enabled === false
    const contextId = item?.type === "text" ? "stage_text_item" : item?.type === "current_output" ? "stage_item_output" : "stage_item"
    const fixedWidth = item?.type === "timer" || item?.type === "clock" ? "font-feature-settings: 'tnum' 1;" : ""
    const cssVariables = createCSSVariables(currentVariables, currentOutputs, "stage", updateTrigger)

    let itemStyle = ""
    let textStyle = ""
    if (item?.style) {
        const isSlideTextWithAutosize = item.type === "slide_text" && (item.auto !== false || (item.textFit && item.textFit !== "none"))
        for (const [key, value] of Object.entries(getStyles(item.style))) {
            if (["line-height", "text-decoration"].includes(key)) textStyle += `${key}: ${value};`
            else if (key === "font-size" && isSlideTextWithAutosize) continue
            else itemStyle += `${key}: ${value};`
        }
    }
    const customStyle = percentageStylePos(itemStyle, getStageResolution())

    const isAutoSized = item?.type?.includes("text") ? item?.auto || (item?.textFit && item?.textFit !== "none") : item?.auto !== false || (item?.textFit && item?.textFit !== "none")
    const autoSizeValue = isAutoSized ? size : fontSize

    const flashColor = item?.flash?.color || "#FF0000"
    const flashCount = edit
        ? 0
        : (() => {
              const value = Number(item?.flash?.count)
              return !value || !Number.isFinite(value) || value < 1 ? 3 : Math.floor(value)
          })()

    const intervalTime = disableStagePreview || preview ? 5000 : 1000
    const condIntervalTime = disableStagePreview || preview ? 5000 : 3000

    useEffect(() => {
        if (!(item?.type === "timer" || id.includes("timer") || id.includes("clock")) || disableStagePreview) return
        const interval = setInterval(() => setToday(new Date()), 1000)
        return () => clearInterval(interval)
    }, [item?.type, id, disableStagePreview])

    useEffect(() => {
        const cond = setInterval(() => setConditionsUpdater((value) => value + 1), condIntervalTime)
        const css = setInterval(() => setUpdateTrigger((value) => value + 1), intervalTime)
        return () => {
            clearInterval(cond)
            clearInterval(css)
        }
    }, [condIntervalTime, intervalTime])

    useEffect(() => {
        if (!currentRefreshEditSlide) return
        const timeout = setTimeout(() => refreshEditSlide.set(false), 100)
        return () => clearTimeout(timeout)
    }, [currentRefreshEditSlide])

    useEffect(() => {
        if (!stageOutputId) return
        let cancelled = false
        const timeout = setTimeout(async () => {
            if (item?.type ? !item.includeMedia : !id.includes("slide")) return
            let bg = (await sendBackgroundToStage(stageOutputId, currentOutputs, true)) as StageBackground | null
            if (bg && slideOffset !== 0) {
                for (const key of ["next", "next2"] as const) {
                    const path = bg[key]?.path
                    if (typeof path !== "string" || !videoExtensions.includes(getExtension(path))) continue
                    const thumbnail = await loadThumbnail(path, mediaSize.big)
                    if (thumbnail) bg[key] = { ...bg[key], path: thumbnail, filePath: thumbnail }
                }
            }
            if (!cancelled) setCurrentBackground(bg)
        }, 100)
        return () => {
            cancelled = true
            clearTimeout(timeout)
        }
    }, [stageOutputId, currentOutputs, item?.type, item?.includeMedia, id, slideOffset])

    useEffect(() => {
        function deselect(event: MouseEvent) {
            if (!edit) return
            const target = event.target instanceof Element ? event.target : null
            if (target?.closest(".stageTools") || target?.closest(".contextMenu") || currentActivePopup) return
            if ((!event.shiftKey && target?.closest(".stage_item")?.id !== id && currentActiveStage.items.includes(id) && !target?.closest(".stage_item")) || target?.closest(".panel")) {
                activeStage.update((ae) => {
                    ae.items = []
                    return ae
                })
            }
        }
        function keydown(event: KeyboardEvent) {
            if (!edit) return
            if (event.key === "Shift") setIsShiftPressed(true)
            if ((event.key === "Backspace" || event.key === "Delete") && currentActiveStage.items.includes(id) && !document.activeElement?.closest(".stage_item") && !document.activeElement?.closest(".edit")) {
                if (document.querySelector(".timeline-track .action-marker.selected")) return
                if (!currentActiveStage.id) return
                stageShows.update((all) => {
                    if (!all[currentActiveStage.id!]) return all
                    delete all[currentActiveStage.id!].items[id]
                    all[currentActiveStage.id!].modified = Date.now()
                    return all
                })
                activeStage.set({ ...currentActiveStage, items: [] })
            }
        }
        function keyup(event: KeyboardEvent) {
            if (!edit) return
            if (event.key === "Shift") setIsShiftPressed(false)
        }
        window.addEventListener("mousedown", deselect)
        window.addEventListener("keydown", keydown)
        window.addEventListener("keyup", keyup)
        return () => {
            window.removeEventListener("mousedown", deselect)
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("keyup", keyup)
        }
    }, [edit, currentActivePopup, currentActiveStage, id])

    useEffect(() => {
        const alignElem = alignRef.current
        if (!alignElem || !autoSizeEnabled || autoSizeKey === prevAutoSizeKey.current) return
        prevAutoSizeKey.current = autoSizeKey
        autoSizeRetryCount.current = 0
        if (autoSizeTimeout.current) clearTimeout(autoSizeTimeout.current)

        function attempt() {
            if (!alignElem) return
            if (alignElem.clientHeight === 0) {
                autoSizeRetryCount.current++
                if (autoSizeRetryCount.current < MAX_AUTOSIZE_RETRIES) {
                    autoSizeTimeout.current = setTimeout(attempt, 50 * autoSizeRetryCount.current)
                    return
                }
                autoSizeTimeout.current = null
                return
            }
            autoSizeRetryCount.current = 0
            const itemFontSize = Number(getStyles(item?.style, true)?.["font-size"] || "") || 100
            const type = item?.textFit || "growToFit"
            const maxFontSize = item?.type === "slide_text" || (item?.type || "text") === "text" ? (type ? itemFontSize : 0) : 0
            setSize(autosize(alignElem, { type, textQuery: ".autoFontSize", defaultFontSize: itemFontSize, maxFontSize }))
            autoSizeTimeout.current = null
        }
        autoSizeTimeout.current = setTimeout(attempt, 20)
        return () => {
            if (autoSizeTimeout.current) clearTimeout(autoSizeTimeout.current)
        }
    }, [autoSizeKey, autoSizeEnabled, item, alignRef])

    useEffect(() => {
        if (!item?.flash?.enabled) return
        const evaluatedText = replaceDynamicValues(currentItemText, { type: "stage", id }, (currentVariables ? 0 : 0) + updateTrigger)
        const currentText = evaluatedText || ""
        const parentIsMounting = getLayoutMounted ? !getLayoutMounted() : false
        if (lastText.current !== currentText && currentText.trim() && !parentIsMounting) setFlashTriggerId((value) => value + 1)
        lastText.current = currentText
    }, [item?.flash?.enabled, currentItemText, id, currentVariables, updateTrigger, getLayoutMounted])

    function mousedown(event: ReactMouseEvent<HTMLDivElement>) {
        if (!edit) return

        const isSelected = currentActiveStage.items.includes(id)
        if (event.shiftKey) {
            if (!isSelected)
                activeStage.update((ae) => {
                    ae.items.push(id)
                    return ae
                })
        } else if (!isSelected) {
            activeStage.update((ae) => {
                ae.items = [id]
                return ae
            })
        } else if (currentActiveStage.items.length > 1) {
            const startX = event.clientX
            const startY = event.clientY
            window.addEventListener(
                "mouseup",
                (upEvent) => {
                    if (Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY) < 4) {
                        activeStage.update((ae) => {
                            ae.items = [id]
                            return ae
                        })
                    }
                },
                { once: true }
            )
        }

        if (event.shiftKey) {
            setIsShiftPressed(true)
            event.preventDefault()
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            window.getSelection()?.removeAllRanges()
        }

        const target = (event.target instanceof Element ? event.target.closest(".stage_item") : null) as HTMLElement | null
        if (!target) return

        const square = event.target instanceof Element ? event.target.closest(".square") : null
        if (square) {
            const cursor = window.getComputedStyle(square).cursor || "nwse-resize"
            startResizing(cursor)
        }

        const slideElem = (target.closest(".slide") || target.closest(".stage")) as HTMLElement | null
        onMouseChange?.({
            x: event.clientX,
            y: event.clientY,
            width: target.offsetWidth,
            height: target.offsetHeight,
            top: target.offsetTop,
            left: target.offsetLeft,
            offset: {
                x: (event.clientX - (slideElem?.offsetLeft || 0)) / ratio - target.offsetLeft,
                y: (event.clientY - (slideElem?.offsetTop || 0)) / ratio - target.offsetTop,
                width: event.clientX / ratio - target.offsetWidth,
                height: event.clientY / ratio - target.offsetHeight
            },
            item: { type: "stage", ...item } as StageboxMouse["item"],
            e: event.nativeEvent
        })
    }

    function removeConditions() {
        stageShows.update((all) => {
            if (!currentActiveStage.id || !all[currentActiveStage.id]?.items?.[id]?.conditions) return all
            delete all[currentActiveStage.id].items[id].conditions
            all[currentActiveStage.id].modified = Date.now()
            return all
        })
    }

    const rootStyle = `${customStyle}${id.includes("slide") && !id.includes("tracker") ? "" : textStyle}${edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ""}--labelColor: ${currentShow?.settings?.labelColor || "#d0a853"};${fixedWidth}${cssVariables}`
    const stageItemClass = ["stage_item", styles.stageItem, "item", edit ? `context #${contextId}` : "", currentShow?.settings?.labels ? `border ${styles.border}` : "", edit ? `outline ${styles.outline}` : "", edit && currentActiveStage.items.includes(id) ? `selected ${styles.selected}` : "", isDisabledVariable ? `isDisabledVariable ${styles.isDisabledVariable}` : "", isShiftPressed ? `isShiftPressed ${styles.isShiftPressed}` : ""].filter(Boolean).join(" ")

    const alignStyle = `--align: ${item?.align};--text-align: ${item?.alignX || "center"};${item?.type !== "slide_text" || item?.keepStyle ? "height: 100%;" : ""}`
    const spanStyle = `pointer-events: none;width: 100%;height: 100%;${item?.type === "current_output" ? "position: relative;" : ""}`
    const stageOutput = (currentOutputs[outputWindowId] || currentAllOutputs[outputWindowId])?.stageOutput

    return (
        <div id={id} className={stageItemClass} style={cssTextToStyle(rootStyle)} onMouseDown={mousedown}>
            {currentShow?.settings?.labels && id && item ? <div className={`label ${styles.label}`}>{getCustomStageLabel(item.type || id, item, currentDictionary)}</div> : null}

            {item?.flash?.enabled && flashTriggerId > 0 ? <div key={flashTriggerId} className={`flashBackground ${styles.flashBackground}`} style={cssTextToStyle(`background-color: ${flashColor};animation-iteration-count: ${flashCount};`)} /> : null}

            {edit && item ? (
                <>
                    <Movebox ratio={ratio} itemStyle={item.style} active={currentActiveStage.items.includes(id)} />

                    <div className={`actions ${styles.actions}`}>
                        {item.button?.press || item.button?.release ? (
                            <div data-title={translateText("popup.action")} className={`actionButton ${styles.actionButton}`} style={cssTextToStyle("zoom: " + 1 / ratio + ";left: 0;inset-inline-end: unset;")}>
                                <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                                    <Icon id="button" white />
                                </span>
                            </div>
                        ) : null}

                        {Object.values(item.conditions || {}).length ? (
                            <div data-title={translateText("actions.conditions")} className={`actionButton ${styles.actionButton}`} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;background-color: var(--${showItemState ? "" : "dis"}connected);`)}>
                                <Button align="start" onClick={removeConditions} redHover>
                                    <Icon id="light" white />
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}

            {item ? (
                <div ref={alignRef} className={`align ${styles.align}`} style={cssTextToStyle(alignStyle)}>
                    <span style={cssTextToStyle(spanStyle)}>
                        {item.type === "current_output" || id.includes("current_output") ? (
                            <>
                                {stageOutput ? disableStagePreview ? null : <StageLayout outputId={outputWindowId} stageId={stageOutput} edit={false} disableStagePreview={true} /> : <Output outputId={outputWindowId} mirror={true} style="width: 100%; height: 100%;" />}

                                {item.currentOutput?.showLabel ? (
                                    <div className={`label ${styles.label}`} style={cssTextToStyle("position: absolute;top: unset;bottom: 10px;left: 50%;transform: translateX(-50%);pointer-events: none;font-size: 28px;background-color: rgba(0, 0, 0, 0.5);padding: 2px 6px;border-radius: 12px;height: 46px;width: 180px;display: flex;justify-content: center;align-items: center;")}>
                                        <p>{(currentOutputs[outputWindowId] || currentAllOutputs[outputWindowId])?.name || ""}</p>
                                    </div>
                                ) : null}
                            </>
                        ) : item.type === "slide_text" || id.includes("slide") ? (
                            <>
                                {(item.type ? item.includeMedia : !id.includes("_text")) && currentBackground ? (
                                    typeof (slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : slideOffset === 2 ? currentBackground.next2 : null)?.path === "string" ? (
                                        <div className="image" style={cssTextToStyle("position: absolute;left: 0;top: 0;width: 100%;height: 100%;")}>
                                            <Media
                                                outputId={outputWindowId}
                                                path={(slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : slideOffset === 2 ? currentBackground.next2 : null)!.path || ""}
                                                path2={(slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : slideOffset === 2 ? currentBackground.next2 : null)!.filePath}
                                                mediaStyle={((slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : slideOffset === 2 ? currentBackground.next2 : null)!.mediaStyle || {}) as MediaStyle}
                                                mirror
                                            />
                                        </div>
                                    ) : null
                                ) : null}

                                <SlideText key={String(currentSlide?.id || currentSlide?.index || "")} currentSlide={currentSlide} slideOffset={slideOffset} stageItem={item} chords={typeof item.chords === "boolean" ? item.chords : item.chords?.enabled} ref={{ type: "stage", id }} autoSize={item.textFit !== "none" && item.auto !== false} fontSize={item.textFit !== "none" && item.auto !== false ? 0 : fontSize} textStyle={textStyle} style={item.type ? item.keepStyle : false} />
                            </>
                        ) : item.type === "slide_notes" || id.includes("notes") ? (
                            <SlideNotes currentSlide={currentSlide} slideOffset={slideOffset} autoSize={item.auto !== false ? autoSizeValue : fontSize} />
                        ) : item.type === "text" ? (
                            edit ? (
                                <span key={String(currentRefreshEditSlide)} className={`edit_item ${styles.editItem}`} style={cssTextToStyle(`pointer-events: initial;--font-size: ${fontSize}px;`)}>
                                    <EditboxLines item={stageItemToItem(item)} ref={{ type: "stage", id }} index={-1} />
                                </span>
                            ) : (
                                <Textbox item={stageItemToItem(item)} stageItem={item} ref={{ type: "stage", id }} fontSize={fontSize} stageAutoSize={item.auto || (item.textFit && item.textFit !== "none")} isStage />
                            )
                        ) : item.type ? (
                            newItem ? (
                                <SlideItems item={stageItemToItem(newItem)} ref={{ type: "stage", id }} fontSize={item.auto !== false || item.textFit !== "none" ? autoSizeValue : fontSize} preview={preview} outputId={stageOutputId} isStage />
                            ) : null
                        ) : (
                            <div>
                                {id.includes("slide_tracker") ? (
                                    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSizeValue : fontSize} outputId={stageOutputId} />
                                ) : id.includes("clock") ? (
                                    <Clock style={false} fontStyle={item.auto === false ? "" : `font-size: ${edit ? autoSizeValue : fontSize}px;`} seconds={item.clock?.seconds ?? true} dateFormat={item.clock?.show_date ? "DD/MM/YYYY" : "none"} />
                                ) : id.includes("first_active_timer") ? (
                                    <Timer item={stageItemToItem(item)} id={firstTimerId} today={today} style={`font-size: ${item.auto !== false ? autoSizeValue : fontSize}px;`} />
                                ) : id.includes("timers") ? (
                                    currentTimers[id.split("#")[1]] ? (
                                        <Timer item={stageItemToItem(item)} id={id.split("#")[1]} today={today} style={`font-size: ${item.auto !== false ? autoSizeValue : fontSize}px;`} />
                                    ) : null
                                ) : id.includes("variables") ? (
                                    currentVariables[id.split("#")[1]] ? (
                                        <Variable id={id.split("#")[1]} style={`font-size: ${item.auto !== false ? autoSizeValue : fontSize}px;`} ref={{ type: "stage", id }} hideText={true} />
                                    ) : null
                                ) : (
                                    id
                                )}
                            </div>
                        )}
                    </span>
                </div>
            ) : null}
        </div>
    )
}
