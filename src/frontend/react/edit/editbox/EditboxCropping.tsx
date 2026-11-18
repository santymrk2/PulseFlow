import { useEffect, useRef, useState } from "react"
import type { Item } from "../../../../types/Show"
import { activeShow } from "../../../stores"
import { startResizing, stopResizing } from "../../../utils/cursor"
import { clampCrop, clampPan, getCropCenter, getCropValues, isSameCrop, type CropValues } from "../../../components/helpers/cropping"
import { history } from "../../../components/helpers/history"
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
    ref: {
        type?: "show" | "overlay" | "template"
        id: string
    }
    itemElem?: HTMLElement
    plain?: boolean
    isLocked?: boolean
    selected?: boolean
    onCropActiveChange?: (active: boolean) => void
    onCropPreviewChange?: (preview: CropValues) => void
    handleRef?: { current: EditboxCroppingHandle | null } | null
}

// Port de components/edit/editbox/EditboxCropping.svelte (F24.21c).
export function EditboxCropping({ item, index, ref, itemElem, plain = false, isLocked = false, selected = false, onCropActiveChange, onCropPreviewChange, handleRef }: EditboxCroppingProps) {
    const currentActiveShow = useStore(activeShow)

    const [cropEditMode, setCropEditMode] = useState(false)
    const [cropPreview, setCropPreview] = useState<CropValues>({ top: 0, right: 0, bottom: 0, left: 0 })

    const drag = useRef({
        cropDragSide: null as CropSide | null,
        cropMoveActive: false,
        cropStart: { x: 0, y: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 } as CropValues }
    })

    const latest = useRef({ item, index, ref, itemElem, plain, isLocked, selected, currentActiveShow, onCropActiveChange, onCropPreviewChange, cropEditMode, cropPreview })
    latest.current = { item, index, ref, itemElem, plain, isLocked, selected, currentActiveShow, onCropActiveChange, onCropPreviewChange, cropEditMode, cropPreview }

    const cropActive = (item?.type === "media" || item?.type === "camera") && cropEditMode && selected && !plain && !isLocked

    useEffect(() => {
        onCropActiveChange?.(cropActive)
    }, [cropActive, onCropActiveChange])

    useEffect(() => {
        onCropPreviewChange?.(cropPreview)
    }, [cropPreview, onCropPreviewChange])

    function persistMissingTypeAsClipIfNeeded(state?: { item: Item | null; ref: EditboxCroppingProps["ref"]; currentActiveShow: unknown; index: number }) {
        const ctx = state || latest.current
        const refType = ctx.ref?.type || "show"
        if (!ctx.item || (refType === "show" && !ctx.currentActiveShow) || !["show", "overlay", "template"].includes(refType)) return
        if (!ctx.item.cropping || ctx.item.cropping.type) return

        if (refType === "show") {
            history({
                id: "setItems",
                newData: { style: { key: "cropping", values: [{ ...getCropValues(ctx.item.cropping), type: "clip" }] } },
                location: { page: "edit", show: ctx.currentActiveShow, slide: ctx.ref.id, items: [ctx.index] }
            } as Parameters<typeof history>[0])
        } else {
            history({
                id: "UPDATE",
                newData: { key: "items", indexes: [ctx.index], subkey: "cropping", data: [{ ...getCropValues(ctx.item.cropping), type: "clip" }] },
                oldData: { id: ctx.ref.id },
                location: { page: "edit", id: `${refType}_items`, override: true }
            } as Parameters<typeof history>[0])
        }
    }

    function handleDblclick(e: MouseEvent) {
        const { item, isLocked, ref, currentActiveShow, cropEditMode } = latest.current
        const refType = ref?.type || "show"
        if ((item?.type !== "media" && item?.type !== "camera") || isLocked || (refType === "show" && !currentActiveShow) || !["show", "overlay", "template"].includes(refType)) return false
        const target = e.target as HTMLElement | null
        if (target && (target.closest(".line") || target.closest(".square") || target.closest(".rotate") || target.closest(".radius") || target.closest(".editTools"))) return false

        const wasActive = cropEditMode
        setCropEditMode(!wasActive)
        setCropPreview(getCropValues(item?.cropping))
        if (wasActive) persistMissingTypeAsClipIfNeeded(latest.current)
        return true
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key !== "Escape" || !latest.current.cropEditMode) return false

        persistMissingTypeAsClipIfNeeded(latest.current)
        setCropEditMode(false)
        drag.current.cropDragSide = null
        drag.current.cropMoveActive = false
        stopResizing()
        return true
    }

    function getCropCursor(side: CropSide) {
        if (side === "top" || side === "bottom") return "ns-resize"
        if (side === "left" || side === "right") return "ew-resize"
        if (side === "topLeft" || side === "bottomRight") return "nwse-resize"
        if (side === "topRight" || side === "bottomLeft") return "nesw-resize"
        return "default"
    }

    function startCropDrag(side: CropSide, e: MouseEvent) {
        const { item, itemElem, isLocked } = latest.current
        if ((item?.type !== "media" && item?.type !== "camera") || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        startResizing(getCropCursor(side))
        setCropEditMode(true)
        drag.current.cropDragSide = side
        drag.current.cropMoveActive = false
        const preview = getCropValues(item?.cropping)
        setCropPreview(preview)
        drag.current.cropStart = { x: e.clientX, y: e.clientY, crop: { ...preview } }
    }

    function startCropMove(e: MouseEvent) {
        const { item, itemElem, isLocked } = latest.current
        if ((item?.type !== "media" && item?.type !== "camera") || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        startResizing("move")
        setCropEditMode(true)
        drag.current.cropMoveActive = true
        drag.current.cropDragSide = null
        const preview = getCropValues(item?.cropping)
        setCropPreview(preview)
        drag.current.cropStart = { x: e.clientX, y: e.clientY, crop: { ...preview } }
    }

    function cropMousemove(e: MouseEvent) {
        const { itemElem } = latest.current
        const { cropDragSide, cropMoveActive, cropStart } = drag.current
        if ((!cropDragSide && !cropMoveActive) || !itemElem) return

        const rect = itemElem.getBoundingClientRect()
        const width = Math.max(rect.width, 1)
        const height = Math.max(rect.height, 1)
        const dxPercent = ((e.clientX - cropStart.x) / width) * 100
        const dyPercent = ((e.clientY - cropStart.y) / height) * 100

        const next = { ...cropStart.crop }

        if (cropMoveActive) {
            const totalX = cropStart.crop.left + cropStart.crop.right
            const totalY = cropStart.crop.top + cropStart.crop.bottom
            next.left = clampPan(cropStart.crop.left + dxPercent, totalX)
            next.right = totalX - next.left
            next.top = clampPan(cropStart.crop.top + dyPercent, totalY)
            next.bottom = totalY - next.top
        } else if (cropDragSide === "left") next.left = cropStart.crop.left + dxPercent
        else if (cropDragSide === "right") next.right = cropStart.crop.right - dxPercent
        else if (cropDragSide === "top") next.top = cropStart.crop.top + dyPercent
        else if (cropDragSide === "bottom") next.bottom = cropStart.crop.bottom - dyPercent
        else if (cropDragSide === "topLeft") {
            next.top = cropStart.crop.top + dyPercent
            next.left = cropStart.crop.left + dxPercent
        } else if (cropDragSide === "topRight") {
            next.top = cropStart.crop.top + dyPercent
            next.right = cropStart.crop.right - dxPercent
        } else if (cropDragSide === "bottomRight") {
            next.bottom = cropStart.crop.bottom - dyPercent
            next.right = cropStart.crop.right - dxPercent
        } else if (cropDragSide === "bottomLeft") {
            next.bottom = cropStart.crop.bottom - dyPercent
            next.left = cropStart.crop.left + dxPercent
        }

        setCropPreview(clampCrop(next))
    }

    function cropMouseup() {
        if (!drag.current.cropDragSide && !drag.current.cropMoveActive) return

        stopResizing()
        drag.current.cropDragSide = null
        drag.current.cropMoveActive = false

        const { item, ref, currentActiveShow, index, cropPreview } = latest.current
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
                location: { page: "edit", show: currentActiveShow, slide: ref.id, items: [index] }
            } as Parameters<typeof history>[0])
        } else {
            history({
                id: "UPDATE",
                newData: { key: "items", indexes: [index], subkey: "cropping", data: [{ ...nextCrop, type: nextType }] },
                oldData: { id: ref.id },
                location: { page: "edit", id: `${refType}_items`, override: true }
            } as Parameters<typeof history>[0])
        }

        setCropPreview(nextCrop)
    }

    useEffect(() => {
        window.addEventListener("mousemove", cropMousemove)
        window.addEventListener("mouseup", cropMouseup)
        return () => {
            window.removeEventListener("mousemove", cropMousemove)
            window.removeEventListener("mouseup", cropMouseup)
            stopResizing()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Exponer API imperativa.
    useEffect(() => {
        if (!handleRef) return
        handleRef.current = { handleDblclick, handleKeydown }
        return () => {
            if (handleRef) handleRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    })

    // Sync con cambios externos.
    useEffect(() => {
        if (drag.current.cropDragSide || drag.current.cropMoveActive) return
        const externalCrop = getCropValues(item?.cropping)
        if (!isSameCrop(cropPreview, externalCrop)) setCropPreview(externalCrop)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.cropping])

    // Deselect sale del modo recorte.
    useEffect(() => {
        if (selected || !cropEditMode) return
        persistMissingTypeAsClipIfNeeded(latest.current)
        setCropEditMode(false)
        drag.current.cropDragSide = null
        drag.current.cropMoveActive = false
        stopResizing()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected])

    if (!cropActive) return null

    const cropCenter = getCropCenter(cropPreview)

    return (
        <>
            <div className={`cropOverlay ${styles.cropOverlay}`} onMouseDown={(e) => startCropMove(e.nativeEvent)}></div>

            <div className={`cropMask top ${styles.cropMask} ${styles.top}`} style={{ height: `${cropPreview.top}%` }} />
            <div className={`cropMask right ${styles.cropMask} ${styles.right}`} style={{ width: `${cropPreview.right}%` }} />
            <div className={`cropMask bottom ${styles.cropMask} ${styles.bottom}`} style={{ height: `${cropPreview.bottom}%` }} />
            <div className={`cropMask left ${styles.cropMask} ${styles.left}`} style={{ width: `${cropPreview.left}%` }} />

            <div className={`cropHandle top ${styles.cropHandle} ${styles.topHandle}`} style={{ top: `${cropPreview.top}%`, left: `${cropCenter.x}%` }} onMouseDown={(e) => startCropDrag("top", e.nativeEvent)} />
            <div className={`cropHandle right ${styles.cropHandle} ${styles.rightHandle}`} style={{ right: `${cropPreview.right}%`, top: `${cropCenter.y}%` }} onMouseDown={(e) => startCropDrag("right", e.nativeEvent)} />
            <div className={`cropHandle bottom ${styles.cropHandle} ${styles.bottomHandle}`} style={{ bottom: `${cropPreview.bottom}%`, left: `${cropCenter.x}%` }} onMouseDown={(e) => startCropDrag("bottom", e.nativeEvent)} />
            <div className={`cropHandle left ${styles.cropHandle} ${styles.leftHandle}`} style={{ left: `${cropPreview.left}%`, top: `${cropCenter.y}%` }} onMouseDown={(e) => startCropDrag("left", e.nativeEvent)} />

            <div className={`cropHandle corner topLeft ${styles.cropHandle} ${styles.corner} ${styles.topLeft}`} style={{ top: `${cropPreview.top}%`, left: `${cropPreview.left}%` }} onMouseDown={(e) => startCropDrag("topLeft", e.nativeEvent)} />
            <div className={`cropHandle corner topRight ${styles.cropHandle} ${styles.corner} ${styles.topRight}`} style={{ top: `${cropPreview.top}%`, right: `${cropPreview.right}%` }} onMouseDown={(e) => startCropDrag("topRight", e.nativeEvent)} />
            <div className={`cropHandle corner bottomRight ${styles.cropHandle} ${styles.corner} ${styles.bottomRight}`} style={{ bottom: `${cropPreview.bottom}%`, right: `${cropPreview.right}%` }} onMouseDown={(e) => startCropDrag("bottomRight", e.nativeEvent)} />
            <div className={`cropHandle corner bottomLeft ${styles.cropHandle} ${styles.corner} ${styles.bottomLeft}`} style={{ bottom: `${cropPreview.bottom}%`, left: `${cropPreview.left}%` }} onMouseDown={(e) => startCropDrag("bottomLeft", e.nativeEvent)} />
        </>
    )
}
