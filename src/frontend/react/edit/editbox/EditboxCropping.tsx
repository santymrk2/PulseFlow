import { useEffect, useImperativeHandle, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { Item } from "../../../../types/Show"
import { activeShow } from "../../../stores"
import { startResizing, stopResizing } from "../../../utils/cursor"
import { clampCrop, clampPan, getCropCenter, getCropValues, isSameCrop, type CropValues } from "../../../components/helpers/cropping"
import { history } from "../../../components/helpers/history"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"
import styles from "./EditboxCropping.module.css"

type CropSide = "top" | "right" | "bottom" | "left" | "topLeft" | "topRight" | "bottomRight" | "bottomLeft"

export interface EditboxCroppingHandle {
    handleDblclick: (e: MouseEvent) => boolean
    handleKeydown: (e: KeyboardEvent) => boolean
}

export interface EditboxCroppingProps {
    item: Item | null
    index: number
    ref?: { type?: "show" | "overlay" | "template"; id: string }
    itemElem?: HTMLElement
    plain?: boolean
    isLocked?: boolean
    selected?: boolean
    cropActive?: boolean
    cropPreview?: CropValues
    onCropActiveChange?: (active: boolean) => void
    onCropPreviewChange?: (preview: CropValues) => void
    handleRef?: { current: EditboxCroppingHandle | null }
}

function getCropCursor(side: CropSide) {
    if (side === "top" || side === "bottom") return "ns-resize"
    if (side === "left" || side === "right") return "ew-resize"
    if (side === "topLeft" || side === "bottomRight") return "nwse-resize"
    if (side === "topRight" || side === "bottomLeft") return "nesw-resize"
    return "default"
}

// Port de components/edit/editbox/EditboxCropping.svelte (F24.21c).
export function EditboxCropping({ item, index, ref, itemElem, plain = false, isLocked = false, selected = false, onCropActiveChange, onCropPreviewChange, handleRef }: EditboxCroppingProps) {
    const currentActiveShow = useStore(activeShow)

    const [cropEditMode, setCropEditMode] = useState(false)
    const [cropDragSide, setCropDragSide] = useState<CropSide | null>(null)
    const [cropMoveActive, setCropMoveActive] = useState(false)
    const [cropPreview, setCropPreview] = useState<CropValues>(() => getCropValues(item?.cropping))

    const cropStart = useRef({ x: 0, y: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 } as CropValues })
    const latest = useRef({ item, index, ref, itemElem, plain, isLocked, selected, currentActiveShow, cropEditMode, cropDragSide, cropMoveActive, cropPreview })
    latest.current = { item, index, ref, itemElem, plain, isLocked, selected, currentActiveShow, cropEditMode, cropDragSide, cropMoveActive, cropPreview }

    const cropActive = (item?.type === "media" || item?.type === "camera") && cropEditMode && selected && !plain && !isLocked

    useEffect(() => {
        onCropActiveChange?.(cropActive)
    }, [cropActive, onCropActiveChange])

    useEffect(() => {
        onCropPreviewChange?.(cropPreview)
    }, [cropPreview, onCropPreviewChange])

    function persistMissingTypeAsClipIfNeeded() {
        const { item, index, ref, currentActiveShow } = latest.current
        const refType = ref?.type || "show"
        if (!item || (refType === "show" && !currentActiveShow) || !["show", "overlay", "template"].includes(refType)) return
        if (!item.cropping || item.cropping.type) return

        if (refType === "show") {
            history({
                id: "setItems",
                newData: { style: { key: "cropping", values: [{ ...getCropValues(item.cropping), type: "clip" }] } },
                location: { page: "edit", show: currentActiveShow ?? undefined, slide: ref?.id, items: [index] }
            })
        } else {
            history({
                id: "UPDATE",
                newData: { key: "items", indexes: [index], subkey: "cropping", data: [{ ...getCropValues(item.cropping), type: "clip" }] },
                oldData: { id: ref?.id },
                location: { page: "edit", id: `${refType}_items`, override: true }
            })
        }
    }

    function handleDblclick(e: MouseEvent) {
        const { item, ref, isLocked, currentActiveShow } = latest.current
        const refType = ref?.type || "show"
        if ((item?.type !== "media" && item?.type !== "camera") || isLocked || (refType === "show" && !currentActiveShow) || !["show", "overlay", "template"].includes(refType)) return false
        const target = e.target as HTMLElement | null
        if (target && (target.closest(".line") || target.closest(".square") || target.closest(".rotate") || target.closest(".radius") || target.closest(".editTools"))) return false

        const wasActive = latest.current.cropEditMode
        setCropEditMode(!wasActive)
        setCropPreview(getCropValues(item.cropping))
        if (wasActive) persistMissingTypeAsClipIfNeeded()
        return true
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key !== "Escape" || !latest.current.cropEditMode) return false

        persistMissingTypeAsClipIfNeeded()
        setCropEditMode(false)
        setCropDragSide(null)
        setCropMoveActive(false)
        stopResizing()
        return true
    }

    useImperativeHandle(handleRef, () => ({ handleDblclick, handleKeydown }), [])

    function startCropDrag(side: CropSide, e: ReactMouseEvent) {
        const { item, itemElem, isLocked } = latest.current
        if ((item?.type !== "media" && item?.type !== "camera") || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        startResizing(getCropCursor(side))
        setCropEditMode(true)
        setCropDragSide(side)
        setCropMoveActive(false)
        const preview = getCropValues(item.cropping)
        setCropPreview(preview)
        cropStart.current = { x: e.clientX, y: e.clientY, crop: { ...preview } }
    }

    function startCropMove(e: ReactMouseEvent) {
        const { item, itemElem, isLocked } = latest.current
        if ((item?.type !== "media" && item?.type !== "camera") || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        startResizing("move")
        setCropEditMode(true)
        setCropMoveActive(true)
        setCropDragSide(null)
        const preview = getCropValues(item.cropping)
        setCropPreview(preview)
        cropStart.current = { x: e.clientX, y: e.clientY, crop: { ...preview } }
    }

    useEffect(() => {
        function cropMousemove(e: MouseEvent) {
            const { cropDragSide, cropMoveActive, itemElem } = latest.current
            if ((!cropDragSide && !cropMoveActive) || !itemElem) return

            const rect = itemElem.getBoundingClientRect()
            const width = Math.max(rect.width, 1)
            const height = Math.max(rect.height, 1)
            const dxPercent = ((e.clientX - cropStart.current.x) / width) * 100
            const dyPercent = ((e.clientY - cropStart.current.y) / height) * 100

            const next = { ...cropStart.current.crop }

            if (cropMoveActive) {
                const totalX = cropStart.current.crop.left + cropStart.current.crop.right
                const totalY = cropStart.current.crop.top + cropStart.current.crop.bottom

                next.left = clampPan(cropStart.current.crop.left + dxPercent, totalX)
                next.right = totalX - next.left
                next.top = clampPan(cropStart.current.crop.top + dyPercent, totalY)
                next.bottom = totalY - next.top
            } else if (cropDragSide === "left") next.left = cropStart.current.crop.left + dxPercent
            else if (cropDragSide === "right") next.right = cropStart.current.crop.right - dxPercent
            else if (cropDragSide === "top") next.top = cropStart.current.crop.top + dyPercent
            else if (cropDragSide === "bottom") next.bottom = cropStart.current.crop.bottom - dyPercent
            else if (cropDragSide === "topLeft") {
                next.top = cropStart.current.crop.top + dyPercent
                next.left = cropStart.current.crop.left + dxPercent
            } else if (cropDragSide === "topRight") {
                next.top = cropStart.current.crop.top + dyPercent
                next.right = cropStart.current.crop.right - dxPercent
            } else if (cropDragSide === "bottomRight") {
                next.bottom = cropStart.current.crop.bottom - dyPercent
                next.right = cropStart.current.crop.right - dxPercent
            } else if (cropDragSide === "bottomLeft") {
                next.bottom = cropStart.current.crop.bottom - dyPercent
                next.left = cropStart.current.crop.left + dxPercent
            }

            setCropPreview(clampCrop(next))
        }

        function cropMouseup() {
            const { cropDragSide, cropMoveActive, item, index, ref, currentActiveShow, cropPreview } = latest.current
            if (!cropDragSide && !cropMoveActive) return

            stopResizing()
            setCropDragSide(null)
            setCropMoveActive(false)

            const refType = ref?.type || "show"
            if (!item || (refType === "show" && !currentActiveShow) || !["show", "overlay", "template"].includes(refType)) return

            const nextCrop = clampCrop(cropPreview)
            const oldCrop = getCropValues(item.cropping)
            const nextType = item.cropping?.type === "ppt" ? "ppt" : "clip"
            const needsTypeUpdate = !!item.cropping && !item.cropping.type
            if (!needsTypeUpdate && JSON.stringify(nextCrop) === JSON.stringify(oldCrop)) return

            if (refType === "show") {
                history({
                    id: "setItems",
                    newData: { style: { key: "cropping", values: [{ ...nextCrop, type: nextType }] } },
                    location: { page: "edit", show: currentActiveShow ?? undefined, slide: ref?.id, items: [index] }
                })
            } else {
                history({
                    id: "UPDATE",
                    newData: { key: "items", indexes: [index], subkey: "cropping", data: [{ ...nextCrop, type: nextType }] },
                    oldData: { id: ref?.id },
                    location: { page: "edit", id: `${refType}_items`, override: true }
                })
            }

            setCropPreview(nextCrop)
        }

        window.addEventListener("mousemove", cropMousemove)
        window.addEventListener("mouseup", cropMouseup)
        return () => {
            window.removeEventListener("mousemove", cropMousemove)
            window.removeEventListener("mouseup", cropMouseup)
            stopResizing()
        }
    }, [])

    // Keep editbox crop preview in sync with external updates (e.g. BoxStyle values).
    useEffect(() => {
        if (cropDragSide || cropMoveActive) return
        const externalCrop = getCropValues(item?.cropping)
        if (!isSameCrop(cropPreview, externalCrop)) setCropPreview(externalCrop)
    }, [item?.cropping, cropDragSide, cropMoveActive])

    // Deselecting the item should always exit crop mode.
    useEffect(() => {
        if (!selected && cropEditMode) {
            persistMissingTypeAsClipIfNeeded()
            setCropEditMode(false)
            setCropDragSide(null)
            setCropMoveActive(false)
            stopResizing()
        }
    }, [selected, cropEditMode])

    if (!cropActive) return null

    const cropCenter = getCropCenter(cropPreview)
    const cropCenterX = cropCenter.x
    const cropCenterY = cropCenter.y

    return (
        <>
            <div className={styles.cropOverlay} onMouseDown={startCropMove} />
            <div className={`${styles.cropMask} ${styles.top}`} style={cssTextToStyle(`height: ${cropPreview.top}%;`)} />
            <div className={`${styles.cropMask} ${styles.right}`} style={cssTextToStyle(`width: ${cropPreview.right}%;`)} />
            <div className={`${styles.cropMask} ${styles.bottom}`} style={cssTextToStyle(`height: ${cropPreview.bottom}%;`)} />
            <div className={`${styles.cropMask} ${styles.left}`} style={cssTextToStyle(`width: ${cropPreview.left}%;`)} />

            <div className={`${styles.cropHandle} ${styles.top}`} style={cssTextToStyle(`top: ${cropPreview.top}%;left: ${cropCenterX}%;`)} onMouseDown={(e) => startCropDrag("top", e)} />
            <div className={`${styles.cropHandle} ${styles.right}`} style={cssTextToStyle(`right: ${cropPreview.right}%;top: ${cropCenterY}%;`)} onMouseDown={(e) => startCropDrag("right", e)} />
            <div className={`${styles.cropHandle} ${styles.bottom}`} style={cssTextToStyle(`bottom: ${cropPreview.bottom}%;left: ${cropCenterX}%;`)} onMouseDown={(e) => startCropDrag("bottom", e)} />
            <div className={`${styles.cropHandle} ${styles.left}`} style={cssTextToStyle(`left: ${cropPreview.left}%;top: ${cropCenterY}%;`)} onMouseDown={(e) => startCropDrag("left", e)} />

            <div className={`${styles.cropHandle} ${styles.corner} ${styles.topLeft}`} style={cssTextToStyle(`top: ${cropPreview.top}%;left: ${cropPreview.left}%;`)} onMouseDown={(e) => startCropDrag("topLeft", e)} />
            <div className={`${styles.cropHandle} ${styles.corner} ${styles.topRight}`} style={cssTextToStyle(`top: ${cropPreview.top}%;right: ${cropPreview.right}%;`)} onMouseDown={(e) => startCropDrag("topRight", e)} />
            <div className={`${styles.cropHandle} ${styles.corner} ${styles.bottomRight}`} style={cssTextToStyle(`bottom: ${cropPreview.bottom}%;right: ${cropPreview.right}%;`)} onMouseDown={(e) => startCropDrag("bottomRight", e)} />
            <div className={`${styles.cropHandle} ${styles.corner} ${styles.bottomLeft}`} style={cssTextToStyle(`bottom: ${cropPreview.bottom}%;left: ${cropPreview.left}%;`)} onMouseDown={(e) => startCropDrag("bottomLeft", e)} />
        </>
    )
}
