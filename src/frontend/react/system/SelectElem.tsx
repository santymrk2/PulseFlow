import { useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Selected, SelectIds } from "../../../types/Main"
import type { Media, Slide } from "../../../types/Show"
import { arrayHasData, clone } from "../../shared/utils/helpers/array"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { _show } from "../../shared/utils/helpers/shows"
import { cn } from "../../shared/core/lib/utils"
import { activeDropId, activeRename, activeShow, disableDragging, drawerTabsData, os, scriptures, selected } from "../../shared/core/stores"
import { useDerivedState } from "../hooks/useDerivedState"
import { useStore } from "../hooks/useStore"
import styles from "./SelectElem.module.css"

// Port de components/system/SelectElem.svelte. `<slot {elem} />` (nadie usaba `elem`) → children. `class`/`style` → className/style.
// `<svelte:window …>` → listeners de window con limpieza. `fileOver` es una prop que el componente también reasigna (useDerivedState).
// Las clases globales `selectElem` y `TriggerBlock` y los ids `start`/`end` los leen drop.ts y el resto del arrastre: se conservan.
// los items de `selected` son `any` en types/Main.ts: la deuda queda ahí, en un solo lugar
type SelectItem = Selected["data"][number]

// lo que convertDataToSlide lee de cada entrada de la referencia de layout
interface LayoutRefEntry {
    id?: string
    data?: { background?: string; audio?: string[] }
}

export interface SelectElemProps {
    id: SelectIds
    data: SelectItem
    fill?: boolean
    draggable?: boolean
    shiftRange?: SelectItem[]
    onlyRightClickSelect?: boolean
    selectable?: boolean
    trigger?: null | "row" | "column"
    fileOver?: boolean
    borders?: "all" | "center" | "edges"
    triggerOnHover?: boolean
    dropAbove?: boolean
    className?: string
    style?: CSSProperties
    children?: ReactNode
}

// lo que mousedown/deselect leen de un MouseEvent, un DragEvent o un TouchEvent
interface PointerLike {
    button?: number
    buttons?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    target: EventTarget | null
    dataTransfer?: DataTransfer | null
    preventDefault?: () => void
}

const TRIGGER_TIMEOUT = 500
type DragOver = null | "start" | "center" | "end"

function closest(target: EventTarget | null, selector: string) {
    return (target as Element | null)?.closest?.(selector) ?? null
}

function convertDataToSlide(slideRef: { index?: number; id?: string }[]) {
    const currentSlides: { [key: string]: Slide } = _show().get("slides")
    const currentMedia: Media = _show().get("media") || {}
    const currentLayoutRef = getLayoutRef()

    const slideData = slideRef.map(({ index, id }) => {
        let layout: LayoutRefEntry = {}
        if (id) layout = currentLayoutRef.find((a) => a.id === id) || {}
        else if (index !== undefined) layout = currentLayoutRef[index] || {}

        const layoutMedia: { [key: string]: Media } = {}
        if (layout.data?.background) layoutMedia[layout.data.background] = currentMedia[layout.data?.background]
        if (layout.data?.audio) {
            layout.data.audio.forEach((audioId: string) => {
                layoutMedia[audioId] = currentMedia[audioId]
            })
        }

        return { slide: clone(currentSlides[layout.id ?? ""]), layoutData: layout.data, media: layoutMedia }
    })

    return slideData.filter((a) => a.slide)
}

export function SelectElem({ id, data, fill = false, draggable = false, shiftRange = [], onlyRightClickSelect = false, selectable = true, trigger = null, fileOver: fileOverProp = false, borders = "all", triggerOnHover = false, dropAbove = false, className = "", style, children }: SelectElemProps) {
    const currentSelected = useStore(selected)
    const activeDrop = useStore(activeDropId)
    const [fileOver, setFileOver] = useDerivedState(fileOverProp, (value) => value)
    const [dragActive, setDragActive] = useState(false)
    const [dragover, setDragoverState] = useState<DragOver>(null)
    const dragoverRef = useRef<DragOver>(null) // el timer de triggerHoverAction lo lee en vivo
    const triggerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [thisId] = useState(() => "_" + uid(5))

    const latest = useRef({ id, data, triggerOnHover })
    useEffect(() => {
        latest.current = { id, data, triggerOnHover }
    })

    function setDragover(value: DragOver) {
        dragoverRef.current = value
        setDragoverState(value)
    }

    // $: if ($activeDropId !== thisId) dragover = null
    useEffect(() => {
        if (activeDrop !== thisId) setDragover(null)
    }, [activeDrop, thisId])

    function enter(e: PointerLike) {
        if (!selectable || get(selected).hoverActive) return
        // Only allow left-click (button 1) for drag selection
        if (!e.buttons || e.buttons !== 1 || dragActive || onlyRightClickSelect) return

        const sel = get(selected)
        if ((id === "project" || id === "folder") && sel.data[0] && data.index < sel.data[0].index) {
            selected.set({ id, data: [data] })
            return
        }

        if (sel.id !== id) selected.set({ id, data: [data] })
        else if (!arrayHasData(sel.data, data)) {
            selected.update((s) => {
                if (!Array.isArray(s.data)) s.data = []
                s.data = [...s.data, data]
                return s
            })
        }
    }

    const triggerHoverActions: Record<string, () => void> = {
        show: () => {
            const sel = get(selected)
            const current = latest.current.data
            if ((sel.id === "slide" || sel.id === "group" || sel.id === "global_group") && (current.type || "show") === "show") {
                // copy slide data
                if ((sel.id === "slide" || sel.id === "group") && !sel.hoverActive) {
                    const slides = convertDataToSlide(clone(sel.data))
                    selected.set({ ...sel, hoverActive: true })

                    // select after show is opened (because a slide is selected in the new show)
                    setTimeout(() => {
                        selected.set({ id: "global_group", data: slides, hoverActive: true })
                    }, 50)
                }

                // open show
                activeShow.set(current)
            }
        }
    }

    function triggerHoverAction() {
        if (!triggerOnHover || triggerTimeout.current) return

        triggerTimeout.current = setTimeout(() => {
            triggerTimeout.current = null
            if (!dragoverRef.current) return
            const action = triggerHoverActions[latest.current.id]
            if (!action) return console.log("MISSING HOVER TRIGGER:", latest.current.id)

            action()
        }, TRIGGER_TIMEOUT)
    }

    function remainSelected(e: PointerLike, dragged = false) {
        const sel = get(selected)
        if (!dragged && sel.id === "slide" && e.button === 0 && closest(e.target, "#template")) return true
        if (sel.id === id) return true
        return false
    }

    function deselect(e: PointerLike) {
        if (e.ctrlKey || e.metaKey || !remainSelected(e)) return
        if (closest(e.target, ".menus") || closest(e.target, ".selectElem") || closest(e.target, ".popup") || closest(e.target, ".edit") || closest(e.target, ".contextMenu") || closest(e.target, ".editTools")) return

        selected.set({ id: null, data: [] })
    }

    function endDrag() {
        setDragActive(false)
        setDragover(null)
        activeDropId.set("")
        if (get(selected).id !== id) selected.set({ id, data: [] })
    }

    function touchend(e: PointerLike) {
        endDrag()
        deselect(e)
    }

    function dragstart() {
        if (get(activeRename) !== null || get(disableDragging)) return

        setDragActive(true)
    }

    // DRAG EVENT

    function mousedown(e: PointerLike, dragged = false) {
        if (!selectable) return
        if (dragged && (get(activeRename) !== null || get(disableDragging))) return e.preventDefault?.()

        if (get(selected).id !== id) {
            if (remainSelected(e, dragged)) return
            selected.set({ id, data: [] })
        }
        const sel = get(selected)

        // this affects the cursor
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/dropEffect
        const type: "copy" | "move" | "link" = "move"
        if (e.dataTransfer) e.dataTransfer.effectAllowed = type

        let newData: SelectItem[] | undefined
        const rightClick: boolean = e.button === 2 || e.buttons === 2 || (get(os).platform === "darwin" && !!e.ctrlKey)

        if (onlyRightClickSelect) {
            if (rightClick) selected.set({ id, data: [data] })
            return
        }

        // shift select range
        if (e.shiftKey && ((shiftRange.length && sel.data[0]) || sel.data[0]?.index !== undefined)) {
            const searchKeys = ["id", "index", "path"]
            const lastSelected = sel.data[sel.data.length - 1]
            if (!lastSelected) return

            const lastSelectedIndex: number = shiftRange.length ? shiftRange.findLastIndex((a) => searchKeys.find((key) => lastSelected[key] !== undefined && lastSelected[key] === a[key])) : lastSelected.index || 0
            const newIndex: number = shiftRange.length ? shiftRange.findIndex((a) => searchKeys.find((key) => data[key] !== undefined && data[key] === a[key])) : data.index || 0
            const lowestNumber = Math.min(lastSelectedIndex, newIndex) + 1
            const highestNumber = Math.max(lastSelectedIndex, newIndex) - 1

            const range = (start: number, end: number) =>
                Array(Math.abs(end - start) + 1)
                    .fill("")
                    .map((_, idx) => start + idx)
            let selectedBetween: number[] = range(lowestNumber, highestNumber)

            // nothing in between
            if (newIndex - 1 === lastSelectedIndex || newIndex + 1 === lastSelectedIndex) selectedBetween = [selectedBetween[0]]

            const dataBetween = selectedBetween.map((index) => (shiftRange.length ? shiftRange[index] : { index }))
            let allNewData = [...sel.data, ...dataBetween, data]

            const keys = Object.keys(data)
            // add all previous keys to new data
            if (shiftRange) {
                allNewData = allNewData
                    .map((item) => {
                        if (!item) return null

                        const picked: Record<string, unknown> = {}
                        keys.forEach((key) => {
                            picked[key] = item[key]
                        })

                        return picked
                    })
                    .filter((a) => a)
            }

            // remove duplicates
            const alreadyAdded: string[] = []
            newData = allNewData.filter((item) => {
                const dataString = JSON.stringify(item)
                if (alreadyAdded.find((a) => JSON.stringify(a) === dataString)) return false

                alreadyAdded.push(dataString)
                return true
            })

            selected.set({ id, data: newData })
            return
        }

        // Special handling for scripture tabs: shift+click to select range from active to clicked
        if (e.shiftKey && id.toString().includes("category_scripture")) {
            // WIP this is bad, find the last selected elem of same type instead of the active one
            const activeScriptureId = get(drawerTabsData).scripture?.activeSubTab
            if (activeScriptureId && activeScriptureId !== data) {
                const allScriptures = get(scriptures)
                // Get all scripture keys of the same type (API or local)
                const activeScripture = allScriptures[activeScriptureId]
                const currentScripture = allScriptures[data]
                if (activeScripture && currentScripture && !!activeScripture.api === !!currentScripture.api) {
                    // Get all scriptures of the same type
                    const allScriptureIds = Object.keys(allScriptures).filter((scriptureId) => {
                        const scripture = allScriptures[scriptureId]
                        return scripture && !!scripture.api === !!activeScripture.api
                    })

                    // Find indices of active and clicked scriptures
                    const activeIndex = allScriptureIds.indexOf(activeScriptureId)
                    const clickedIndex = allScriptureIds.indexOf(data)

                    if (activeIndex !== -1 && clickedIndex !== -1) {
                        const startIndex = Math.min(activeIndex, clickedIndex)
                        const endIndex = Math.max(activeIndex, clickedIndex)

                        // Select all scriptures in the range
                        const selectedRange = allScriptureIds.slice(startIndex, endIndex + 1)
                        selected.set({ id, data: selectedRange })
                        return
                    }
                }
            }
        }

        const alreadySelected: boolean = sel.id === id && arrayHasData(sel.data, data)
        const selectMultiple: boolean = !!(e.ctrlKey || e.metaKey || e.shiftKey || e.buttons === 4) // middle mouse button

        if (dragged) {
            if (alreadySelected) return
            // selectMultiple
            newData = [data]
        } else {
            if (alreadySelected) {
                if (!selectMultiple || rightClick) return

                // remove currently selected
                newData = sel.data.filter((a: SelectItem) => JSON.stringify(a) !== JSON.stringify(data))
            } else if (selectMultiple) {
                let selectedData = sel.data ?? []
                if (!Array.isArray(selectedData)) selectedData = [sel.data]
                newData = [...selectedData, data]
            } else if (rightClick) {
                newData = [data]
            }
        }

        if (!newData?.length) selected.set({ id: null, data: [] })
        else if (newData) selected.set({ id, data: newData })
    }

    function stopDrag(e: ReactDragEvent) {
        const target = e.target as Element | null
        if (target?.classList.contains("TriggerBlock") && target.closest("#" + thisId)) return

        setDragover(null)
    }

    function dragOver(key: Exclude<DragOver, null>) {
        if (!selectable) return
        setDragover(key)
        triggerHoverAction()
        activeDropId.set(thisId)
    }

    // <svelte:window>: se registra una vez y se llama a la versión del último render
    const windowHandlers = useRef({ deselect, dragstart, endDrag, touchend, click: () => {} })
    useEffect(() => {
        windowHandlers.current = {
            deselect,
            dragstart,
            endDrag,
            touchend,
            click: () => {
                setDragActive(false)
                setFileOver(false)
                setDragover(null)
                activeDropId.set("")
            }
        }
    })
    useEffect(() => {
        const handlers: [string, (e: Event) => void][] = [
            ["mousedown", (e) => windowHandlers.current.deselect(e as MouseEvent)],
            ["dragstart", () => windowHandlers.current.dragstart()],
            ["dragend", () => windowHandlers.current.endDrag()],
            ["touchend", (e) => windowHandlers.current.touchend(e as TouchEvent)],
            ["touchcancel", (e) => windowHandlers.current.touchend(e as TouchEvent)],
            ["click", () => windowHandlers.current.click()]
        ]
        handlers.forEach(([name, handler]) => window.addEventListener(name, handler))
        return () => handlers.forEach(([name, handler]) => window.removeEventListener(name, handler))
    }, [])

    const isSelected = selectable && currentSelected.id === id && arrayHasData(currentSelected.data, data)

    return (
        <div id={id} data-item={JSON.stringify(data)} draggable={draggable} style={style} className={cn("selectElem", styles.selectElem, className, fill && styles.fill, isSelected && styles.isSelected)} onMouseEnter={(e: ReactMouseEvent) => enter(e)} onMouseDown={(e: ReactMouseEvent) => mousedown(e)} onDragStart={(e: ReactDragEvent) => mousedown(e, true)}>
            {trigger && (dragActive || fileOver) ? (
                <div id={thisId} className={cn(styles.trigger, styles[trigger], dragover && styles[dragover])} style={{ flexDirection: trigger }} onDragLeave={stopDrag}>
                    {dropAbove ? <span id="start" className={cn("TriggerBlock", styles.over)} /> : null}

                    {borders === "all" || borders === "edges" ? <span id="start" className="TriggerBlock" onDragOver={() => dragOver("start")} /> : null}
                    {borders === "all" || borders === "center" ? (
                        <>
                            <span id="start_center" className="TriggerBlock" onDragOver={() => dragOver("center")} />
                            <span id="end_center" className="TriggerBlock" onDragOver={() => dragOver("center")} />
                        </>
                    ) : null}
                    {borders === "all" || borders === "edges" ? <span id="end" className="TriggerBlock" onDragOver={() => dragOver("end")} /> : null}

                    {/* center drop */}
                    <span id="end" className={cn("TriggerBlock", styles.between)} />
                </div>
            ) : null}
            {children}
        </div>
    )
}
