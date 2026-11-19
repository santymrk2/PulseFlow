import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { Item } from "../../../../types/Show"
import { activeEdit, activeShow, openToolsTab, os, outputs, showsCache, special, templates, variables } from "../../../shared/core/stores"
import { startResizing } from "../../../shared/utils/cursor"
import { translateText } from "../../../shared/utils/language"
import { getAccess } from "../../../shared/utils/profile"
import { isComposing } from "../../../app/wiring/shortcuts"
import { deleteAction } from "../../../shared/utils/helpers/clipboard"
import { isCroppedItem } from "../../../shared/utils/helpers/cropping"
import { history } from "../../../shared/utils/helpers/history"
import { getExtension, getFileName, getMediaType } from "../../../shared/utils/helpers/media"
import { getFirstActiveOutput, getOutputResolution, percentageStylePos } from "../../../shared/utils/helpers/output"
import { isSlideLocked } from "../../../shared/utils/helpers/show"
import { createCSSVariables } from "../../../shared/utils/helpers/showActions"
import { getItemStyle, getStyles } from "../../../shared/utils/helpers/style"
import { getShapeGuideStyle } from "../../../components/edit/scripts/shapeOutside"
import { Button } from "../../../shared/ui/kit/button/Button"
import { SlideItems } from "../../slide/SlideItems"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { cssTextToStyle } from "../../../shared/ui/helpers/cssTextToStyle"
import { EditboxCropping, type EditboxCroppingHandle } from "./EditboxCropping"
import { EditboxLines } from "./EditboxLines"
import { EditboxPlain } from "./EditboxPlain"
import styles from "./Editbox.module.css"

export interface EditboxMouseState {
    x: number
    y: number
    width: number
    height: number
    top: number
    left: number
    offset: { x: number; y: number; width: number; height: number }
    item: Item | null
    e: MouseEvent | ReactMouseEvent
    rightClick: boolean
}

export interface EditboxProps {
    item: Item | null
    filter?: string
    backdropFilter?: string
    ref?: {
        type?: "show" | "overlay" | "template"
        showId?: string
        origin?: string
        id: string
    }
    index: number
    editIndex?: number
    ratio?: number
    plain?: boolean
    chordsMode?: boolean
    chordsAction?: string
    mouse?: EditboxMouseState | Record<string, never>
    onMouseChange?: (mouse: EditboxMouseState) => void
}

// Port de components/edit/editbox/Editbox.svelte (F24.21c).
export function Editbox({ item, filter = "", backdropFilter = "", ref, index, editIndex = -1, ratio = 1, plain = false, chordsMode = false, chordsAction = "", mouse, onMouseChange }: EditboxProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentOutputs = useStore(outputs)
    const currentShowsCache = useStore(showsCache)
    const currentSpecial = useStore(special)
    const currentTemplates = useStore(templates)
    const currentVariables = useStore(variables)
    const currentOs = useStore(os)

    const itemElemRef = useRef<HTMLDivElement>(null)
    const cropHandleRef = useRef<EditboxCroppingHandle | null>(null)

    const [cropActive, setCropActive] = useState(false)
    const [cropPreview, setCropPreview] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
    const [isShiftPressed, setIsShiftPressed] = useState(false)

    const activeId = currentActiveShow?.id
    const layout = activeId && currentShowsCache[activeId]?.settings ? currentShowsCache[activeId].settings.activeLayout : ""

    const latest = useRef({ item, filter, backdropFilter, ref, index, editIndex, ratio, plain, chordsMode, chordsAction, mouse, onMouseChange, currentActiveEdit, currentActiveShow, currentOutputs, currentShowsCache, currentSpecial, currentTemplates, currentVariables, currentOs, cropActive, cropPreview, isShiftPressed, layout, activeId })
    latest.current = { item, filter, backdropFilter, ref, index, editIndex, ratio, plain, chordsMode, chordsAction, mouse, onMouseChange, currentActiveEdit, currentActiveShow, currentOutputs, currentShowsCache, currentSpecial, currentTemplates, currentVariables, currentOs, cropActive, cropPreview, isShiftPressed, layout, activeId }

    function getCustomStyle(style: string, outputId = "") {
        if (outputId) {
            let outputResolution = getOutputResolution(outputId, currentOutputs, true)
            style = percentageStylePos(style, outputResolution)
        }

        // minimum of 50% opacity on all items in the editor
        if (style.includes("opacity:")) {
            style = style.replace(/opacity:\s*([0-9.]+)/, (match, p1) => {
                if (parseFloat(p1) < 0.5) return "opacity: 0.5"
                return match
            })
        }

        return style
    }

    function mousedown(e: ReactMouseEvent<HTMLDivElement>) {
        const target = e.target as HTMLElement | null
        console.warn("SNAPDBG down", target?.className?.toString?.().slice(0, 40), index)
        if (target?.closest(".chords") || target?.closest(".editTools")) return
        if (!e.shiftKey && !target?.closest(".line") && !target?.closest(".square") && !target?.closest(".rotate") && !target?.closest(".radius") && !target?.closest(".cropHandle") && !target?.closest(".cropOverlay")) {
            openToolsTab.set("text")

            // Table shouldn't be draggable from the center
            if (item?.type === "table") return
        }

        const rightClick: boolean = e.button === 2 || e.buttons === 2 || (currentOs.platform === "darwin" && e.ctrlKey)
        const isSelected = currentActiveEdit.items.includes(index)

        if (rightClick) {
            if (!isSelected)
                activeEdit.update((ae) => {
                    ae.items = [index]
                    return ae
                })
        } else if (e.shiftKey) {
            if (!isSelected)
                activeEdit.update((ae) => {
                    ae.items.push(index)
                    return ae
                })
        } else if (!isSelected) {
            activeEdit.update((ae) => {
                ae.items = [index]
                return ae
            })
        } else if (currentActiveEdit.items.length > 1) {
            const startX = e.clientX,
                startY = e.clientY
            window.addEventListener(
                "mouseup",
                (upEvent) => {
                    if (Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY) < 4) {
                        activeEdit.update((ae) => {
                            ae.items = [index]
                            return ae
                        })
                    }
                },
                { once: true }
            )
        }

        // deselect selected text
        if (e.shiftKey) {
            setIsShiftPressed(true)
            e.preventDefault()
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            window.getSelection()?.removeAllRanges()
        }

        const dragTarget = target?.closest(".item") as HTMLElement | null
        if (!dragTarget) return

        const square = target?.closest(".square") as HTMLElement | null
        if (square) {
            const cursor = window.getComputedStyle(square).cursor || "nwse-resize"
            startResizing(cursor)
        }

        const slideElem = dragTarget.closest(".slide") as HTMLElement | null
        const nextMouse: EditboxMouseState = {
            x: e.clientX,
            y: e.clientY,
            width: dragTarget.offsetWidth,
            height: dragTarget.offsetHeight,
            top: dragTarget.offsetTop,
            left: dragTarget.offsetLeft,
            offset: {
                x: (e.clientX - (slideElem?.offsetLeft || 0)) / ratio - dragTarget.offsetLeft,
                y: (e.clientY - (slideElem?.offsetTop || 0)) / ratio - dragTarget.offsetTop,
                width: e.clientX / ratio - dragTarget.offsetWidth,
                height: e.clientY / ratio - dragTarget.offsetHeight
            },
            item,
            e,
            rightClick
        }
        onMouseChange?.(nextMouse)
    }

    function keyup(e: KeyboardEvent) {
        if (e.key === "Shift") setIsShiftPressed(false)
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Shift") setIsShiftPressed(true)

        if (isComposing(e)) return
        if (cropHandleRef.current?.handleKeydown(e)) return

        const { currentActiveEdit, index, layout, ref } = latest.current

        if (e.key === "Escape") {
            ;(document.activeElement as HTMLElement | null)?.blur()
            window.getSelection()?.removeAllRanges()
            if (currentActiveEdit.items.length) {
                // give time so output don't clear
                setTimeout(() => {
                    activeEdit.update((a) => {
                        a.items = []
                        return a
                    })
                })
            }
        }

        if (!currentActiveEdit.items.includes(index) || document.activeElement?.closest(".item") || document.activeElement?.closest("input")) return
        // selected timeline actions
        if (document.querySelector(".timeline-track .action-marker.selected")) return

        if (e.key === "Backspace" || e.key === "Delete") {
            // delete slide item using shortcut
            deleteAction({ id: "item", data: { layout, slideId: ref?.id } })
        }
    }

    function deselect(e: MouseEvent) {
        const target = e.target as HTMLElement | null
        if (target?.closest(".menus") || target?.closest(".popup") || target?.closest(".drawer") || target?.closest(".chords") || target?.closest(".contextMenu") || target?.closest(".editTools") || target?.closest(".group") || target?.closest(".timeline")) return

        const { index } = latest.current
        const currentActiveEdit = latest.current.currentActiveEdit

        if (e.ctrlKey || e.metaKey || target?.closest(".item") === itemElemRef.current || !currentActiveEdit.items.includes(index) || target?.closest(".item")) return

        if (window.getSelection()) window.getSelection()?.removeAllRanges()

        // timeout to allow CSS to update selected items first if any
        setTimeout(() => {
            activeEdit.update((ae) => {
                ae.items = []
                return ae
            })
        })
    }

    function dblclick(e: ReactMouseEvent<HTMLDivElement>) {
        cropHandleRef.current?.handleDblclick(e.nativeEvent)
    }

    // arrastrar texto seleccionado lo "levantaba" con el drag nativo del navegador (y lo soltaba en otro lado) en vez de mover el cuadro
    function noTextDrag(e: React.DragEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement | null)?.closest?.(".edit")) e.preventDefault()
    }

    useEffect(() => {
        window.addEventListener("mousedown", deselect)
        window.addEventListener("keydown", keydown)
        window.addEventListener("keyup", keyup)
        return () => {
            window.removeEventListener("mousedown", deselect)
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("keyup", keyup)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const customOutputId = getFirstActiveOutput(currentOutputs)?.id || ""

    // check if media fills entire slide, if it does it might be intended as a background
    let mediaShouldBeBackground = false
    if (item?.type === "media" && checkMedia()) mediaShouldBeBackground = true
    function checkMedia() {
        if (!item?.src) return false
        if ((ref?.type || "show") !== "show") return false

        // item fills entire width and height
        if (!item.style?.includes("width:1920") || !item.style?.includes("height:1080")) return false

        const currentLayoutSlide = currentShowsCache[activeId || ""]?.layouts?.[layout]?.slides?.[currentActiveEdit.slide ?? -1]
        // background is already set
        if (currentLayoutSlide?.background) return false

        return true
    }

    function convertToBackground() {
        if (!item?.src) return

        history({
            id: "showMedia",
            newData: { name: getFileName(item.src), path: item.src, type: getMediaType(getExtension(item.src)) },
            location: { page: "show", show: { id: activeId || "" }, layout: currentShowsCache[activeId || ""]?.settings?.activeLayout, layoutSlide: currentActiveEdit.slide ?? -1 }
        })

        deleteAction({ id: "item", data: { layout, slideId: ref?.id } })
    }

    const isDisabledVariable = item?.type === "variable" && (currentVariables as Record<string, { enabled?: boolean }>)[item.variable?.id || ""]?.enabled === false
    // SHOW IS LOCKED FOR EDITING
    const profile = getAccess("shows")
    const isGroupLocked = (ref?.type || "show") === "show" ? isSlideLocked(activeId || "", ref?.id || "", currentShowsCache) : false
    const isLocked = (ref?.type || "show") !== "show" ? false : currentShowsCache[activeId || ""]?.locked || isGroupLocked || profile.global === "read" || profile[currentShowsCache[activeId || ""]?.category || ""] === "read"

    // give CSS access to certain dynamic values
    const cssVariables = createCSSVariables(currentVariables)

    const isOptimized = !!currentSpecial.optimizedMode
    let previewCropType: "clip" | "ppt" = "clip"
    if (item?.cropping?.type === "ppt") previewCropType = "ppt"
    const previewItem = cropActive && item ? { ...item, cropping: { ...cropPreview, type: previewCropType } } : item

    // fixed letter width
    const fixedWidth = item?.type === "timer" || item?.type === "clock" ? "font-feature-settings: 'tnum' 1;" : ""

    const noTextMode = ref?.type === "template" && currentTemplates[ref?.id || ""]?.settings?.mode === "item"

    // Cutout Shape
    const shapeGuideStyle = getShapeGuideStyle(getStyles(item?.style)["shape-outside"])

    const selected = currentActiveEdit.items.includes(index)

    const className = [
        plain ? "editItem" : `editItem item ${isLocked ? "" : "context #edit_box"} ${styles.item}`,
        selected ? `selected ${styles.selected}` : "",
        item?.decoration ? `decoration ${styles.decoration}` : "",
        isDisabledVariable ? `isDisabledVariable ${styles.isDisabledVariable}` : "",
        chordsMode ? `chords ${styles.chords}` : "",
        isOptimized ? "isOptimized" : "",
        item?.type === "table" || cropActive ? `showOverflow ${styles.showOverflow}` : "",
        isShiftPressed ? `isShiftPressed ${styles.isShiftPressed}` : ""
    ]
        .filter(Boolean)
        .join(" ")

    const rootStyle = plain ? `width: 100%;${cssVariables}${fixedWidth}` : `${getCustomStyle(getItemStyle(item?.style, isCroppedItem(item)), customOutputId)}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);z-index: ${index + 1 + (selected ? 100 : 0)};${filter ? "filter: " + filter + ";" : ""}${backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""}${cssVariables}${fixedWidth}`

    const slideIndex = currentActiveEdit.slide || 0
    const refPayload = ref || { id: "" }

    return (
        <div ref={itemElemRef} className={className} style={cssTextToStyle(rootStyle)} data-index={index} onMouseDown={mousedown} onDoubleClick={dblclick} onDragStart={noTextDrag}>
            {!plain ? <EditboxPlain item={item} index={index} ratio={ratio} hideMovebox={cropActive} /> : null}
            {item?.lines && !noTextMode ? (
                <EditboxLines item={item} ref={refPayload} index={index} editIndex={editIndex} plain={plain} chordsMode={chordsMode} chordsAction={chordsAction} isLocked={isLocked} />
            ) : previewItem ? (
                previewItem.type === "media" || previewItem.type === "camera" ? (
                    <div className={`mediaFrame ${styles.mediaFrame} ${cropActive ? `showOverflow ${styles.showOverflow}` : ""}`}>
                        <SlideItems item={previewItem} ratio={ratio} ref={refPayload} itemElem={itemElemRef.current ?? undefined} slideIndex={slideIndex} edit={true} cropPreviewMode={cropActive} />
                    </div>
                ) : previewItem.type === "table" ? (
                    <SlideItems item={previewItem} ratio={ratio} ref={refPayload} itemElem={itemElemRef.current ?? undefined} slideIndex={slideIndex} index={index} edit={true} />
                ) : (
                    <SlideItems item={previewItem} ratio={ratio} ref={refPayload} itemElem={itemElemRef.current ?? undefined} slideIndex={slideIndex} edit={true} />
                )
            ) : null}

            <EditboxCropping item={item} index={index} ref={refPayload} itemElem={itemElemRef.current || undefined} plain={plain} isLocked={isLocked} selected={selected} onCropActiveChange={setCropActive} onCropPreviewChange={setCropPreview} handleRef={cropHandleRef} />

            {shapeGuideStyle && !plain ? <div className="shapeOutsideGuide" style={cssTextToStyle(shapeGuideStyle)} /> : null}

            {mediaShouldBeBackground ? (
                <div className={`tip ${styles.tip}`}>
                    {translateText("edit.media_item_tip")}
                    <Button style={{ color: "var(--secondary)" }} onClick={convertToBackground}>
                        {translateText("edit.convert_to_background")}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
