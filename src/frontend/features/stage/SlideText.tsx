import { useEffect, useRef, useState } from "react"
import type { Item, Line, OutSlide } from "../../../types/Show"
import type { StageItem } from "../../../types/Stage"
import { outputs, previewOutputId, showsCache, styles as stylesStore } from "../../shared/core/stores"
import { getItemText } from "../edit/logic/scripts/textStyle"
import { clone } from "../../shared/utils/helpers/array"
import { getResolution } from "../../shared/utils/helpers/output"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { getStyleResolution } from "../slide/logic/getStyleResolution"
import { getStageTextLayoutOffset } from "./logic/stage"
import { observeResize } from "../slide/observeResize"
import { Textbox } from "../slide/Textbox"
import { Zoomed } from "../slide/Zoomed"
import { useStore } from "../../shared/ui/hooks/useStore"
import styles from "./SlideText.module.css"

export interface SlideTextProps {
    currentSlide: OutSlide
    slideOffset?: number
    chords?: boolean
    style?: boolean
    textStyle?: string
    autoSize?: boolean
    fontSize?: number
    stageItem: StageItem
    ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }
}

function getTempSlides(currentSlide: OutSlide, slideOffset: number) {
    if (slideOffset < 0) {
        const includeLength = currentSlide.previousSlides?.length || 0
        return { items: currentSlide.previousSlides?.[includeLength - (slideOffset + 1 + includeLength)] }
    }
    if (slideOffset > 0) return { items: currentSlide.nextSlides?.[slideOffset - 1] }
    return { items: currentSlide.tempItems }
}

function combineSlideItems(items: Item[], itemNumber: number) {
    let oneItem: Item | null = null
    if (!items.length) return []
    items
        .filter((item) => (item?.type || "text") === "text" && (!item?.bindings?.length || item.bindings.includes("stage")))
        .forEach((item, i) => {
            if (itemNumber && itemNumber - 1 !== i) return
            const text = getItemText(item)
            if (itemNumber || text.length) {
                if (!oneItem) oneItem = item
                else {
                    const emptyLine: Line = { align: "", text: [{ style: "", value: "" }] }
                    oneItem.lines!.push(emptyLine, ...(item.lines || []))
                }
            }
        })
    return oneItem ? [oneItem] : []
}

// (F24.19a).
export function SlideText({ currentSlide, slideOffset = 0, chords = false, style = false, textStyle = "", autoSize = false, fontSize = 0, stageItem, ref }: SlideTextProps) {
    const currentShows = useStore(showsCache)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(stylesStore)
    const currentPreviewId = useStore(previewOutputId)

    const mainRef = useRef<HTMLDivElement>(null)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [firstActive, setFirstActive] = useState(false)
    const [items1, setItems1] = useState<Item[]>([])
    const [items2, setItems2] = useState<Item[]>([])

    const showRef = currentSlide ? getLayoutRef(currentSlide.id) : []
    const slideIndex = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    const customOffset = getStageTextLayoutOffset(showRef, slideOffset, slideIndex)
    const slideId = (customOffset !== null || slideIndex !== null) && showRef ? showRef[(customOffset ?? slideIndex)!]?.id || null : null
    const slide = currentSlide?.id === "temp" ? (getTempSlides(currentSlide, slideOffset) as never) : currentSlide && slideId ? currentShows[currentSlide.id]?.slides?.[slideId] : null

    const itemNumber = Number(stageItem?.itemNumber || 0)
    const reversedItems = !itemNumber && stageItem?.invertItems ? clone(slide?.items || []) : clone(slide?.items || []).reverse()
    const items = style ? clone(slide?.items || []) : combineSlideItems(reversedItems, itemNumber)

    const tempContentKey = currentSlide?.id === "temp" ? JSON.stringify(slide?.items || []) : ""
    const itemsKey = `${slideId || currentSlide?.id || ""}_${slideOffset}_${itemNumber}_${stageItem?.invertItems ? 1 : 0}_${style ? 1 : 0}_${(slide?.items || []).length}_${tempContentKey}`
    const prevItemsKey = useRef("")

    useEffect(() => {
        if (!itemsKey || itemsKey === prevItemsKey.current) return
        prevItemsKey.current = itemsKey
        if (firstActive) setItems2(clone(items))
        else setItems1(clone(items))

        const timeout = setTimeout(
            () => {
                const currentlyLoading = !firstActive
                setFirstActive(currentlyLoading)
                if (currentlyLoading) setItems2([])
                else setItems1([])
            },
            items?.length && stageItem?.auto !== false ? 200 : 0
        )
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` se lee del render vigente
    }, [itemsKey])

    useEffect(() => {
        const node = mainRef.current
        if (!node) return
        const observation = observeResize(node, (rect) => setDimensions({ width: rect.width, height: rect.height }))
        return () => observation.destroy()
    }, [])

    const clickRevealed = slideOffset === 0 && !!currentSlide?.itemClickReveal
    const revealed = slideOffset === 0 ? (currentSlide?.revealCount || 0) - 1 : -1
    const useOriginalTextColor = typeof stageItem?.style === "string" && stageItem.style.includes("color:;")
    const resolution = getResolution(null, { outputs: currentOutputs, styles: currentStyles, previewOutputId: currentPreviewId })
    const maxLines = Number(slideOffset !== 0 && stageItem.lineCount)

    function wrapperClass(loading: boolean) {
        return `fill ${styles.fill} ${loading ? `loading ${styles.loading}` : ""}`
    }

    function textbox(item: Item, key: string) {
        return <Textbox key={key} item={item} style={!style} customStyle={textStyle} stageItem={stageItem} chords={chords} ref={ref} maxLines={maxLines} maxLinesInvert={slideOffset < 0} stageAutoSize={style ? (item.textFit !== "none" || item.auto) && autoSize : autoSize} fontSize={fontSize} clickRevealed={clickRevealed} revealed={revealed} isStage originalStyle={style} useOriginalTextColor={useOriginalTextColor} />
    }

    if (style) {
        if (!slide) return null
        return (
            <div ref={mainRef} className={styles.fill}>
                <Zoomed background="transparent" style={getStyleResolution(resolution, dimensions.width, dimensions.height, "fit")} center>
                    <div className={wrapperClass(!!items1.length && !firstActive)}>{items1.map((item, i) => (!itemNumber || slide?.items?.length === 1 || itemNumber - 1 === i ? textbox(item, `1-${i}`) : null))}</div>
                    <div className={wrapperClass(!!items2.length && firstActive)}>{items2.map((item, i) => (!itemNumber || slide?.items?.length === 1 || itemNumber - 1 === i ? textbox(item, `2-${i}`) : null))}</div>
                </Zoomed>
            </div>
        )
    }

    return (
        <>
            <div className={wrapperClass(!!items1.length && !firstActive)}>{items1.map((item, i) => textbox(item, `1-${i}`))}</div>
            <div className={wrapperClass(!!items2.length && firstActive)}>{items2.map((item, i) => textbox(item, `2-${i}`))}</div>
        </>
    )
}
