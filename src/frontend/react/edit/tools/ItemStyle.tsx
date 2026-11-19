// @ts-nocheck
import { useMemo } from "react"
import type { Item } from "../../../../types/Show"
import { activeEdit, activeShow, selected, showsCache } from "../../../shared/core/stores"
import { wait } from "../../../shared/utils/common"
import { clone } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { percentageToAspectRatio, stylePosToPercentage } from "../../../shared/utils/helpers/output"
import { getLayoutRef } from "../../../shared/utils/helpers/show"
import { getStyles } from "../../../shared/utils/helpers/style"
import { addFilterString, addStyleString } from "../../../components/edit/scripts/textStyle"
import { setBoxInputValue } from "../../../components/edit/values/boxes"
import { itemSections } from "../../../components/edit/values/item"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { EditValues } from "./EditValues"

export interface ItemStyleProps {
    allSlideItems: Item[]
    item: Item | null
}

export function ItemStyle({ allSlideItems, item }: ItemStyleProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentSelected = useStore(selected)
    const currentShowsCache = useStore(showsCache)

    const isTextbox = (item?.type || "text") === "text"

    const currentItemSections = useMemo(() => {
        const sections = clone(itemSections)
        if (!isTextbox) delete (sections as Record<string, unknown>).shape_outside
        const transform = getStyles(item?.style, true)?.transform || ""
        const showPerspective = String(transform).includes("rotateX") && !String(transform).includes("rotateX(0deg)")
        setBoxInputValue(sections, "transform", "perspective", "hidden", !showPerspective)
        return sections
    }, [item, isTextbox])

    const data = useMemo(() => {
        let d = getStyles(item?.style, true) as { [key: string]: string }
        const styles = getStyles(item?.style)
        const isGradient = styles.background?.includes("gradient")
        if (isGradient) d["background-color"] = styles.background
        d = stylePosToPercentage(d)
        return d
    }, [item])

    const itemBackFilters = getStyles(item?.style)["backdrop-filter"]

    async function updateStyle(e: Record<string, unknown>) {
        let input = e
        input = percentageToAspectRatio(input)

        if (input.id === "backdrop-filter" || input.id === "transform") {
            const oldString = input.id === "backdrop-filter" ? itemBackFilters : data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        if (input.id === "style" && input.key === "background-color") {
            if (typeof input.value !== "string") input.value = ""
            if (input.value.includes("gradient")) input.key = "background"
            else if (data.background) {
                updateStyle({ ...input, key: "background", value: "" })
                await wait(10)
            }
        }

        let allItems: number[] = clone(currentActiveEdit.items)
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))

        const ref = getLayoutRef()
        const slides: string[] = [ref[currentActiveEdit.slide ?? ""]?.id]
        const slideItems: number[][] = [allItems]
        const showSlides = currentShowsCache[currentActiveShow?.id || ""]?.slides || {}

        if (currentSelected.id === "slide" && Array.isArray(currentSelected.data)) {
            const selectedSlides = currentSelected.data.filter(({ index }: { index: number }) => index !== currentActiveEdit.slide!)
            slides.push(...selectedSlides.map(({ index }: { index: number }) => ref[index]?.id))

            slides.forEach((id, i) => {
                if (i === 0) return
                if (!showSlides[id]) {
                    slideItems.push([])
                    return
                }

                const currentItems = showSlides[id].items
                const currentItemIndexes = currentItems.map((_item: unknown, idx: number) => idx)
                slideItems.push(currentItemIndexes)
            })
        }

        const values: { [key: string]: string[] } = {}

        let relativeValue = 0
        if (input.relative) {
            const items = showSlides[slides[0]]?.items || allSlideItems
            const firstItemStyle = items?.[allItems[0]]?.style || ""
            const previousValue = Number(getStyles(firstItemStyle, true)?.[input.key] || "0")
            relativeValue = Number(String(input.value).replace("px", "")) - previousValue
        }

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            values[slide] = []

            slideItems[i].forEach((itemIndex) => {
                const currentSlideItem = showSlides[slide]?.items?.[itemIndex] || allSlideItems[itemIndex]
                if (!currentSlideItem) return

                let newValue = input.value
                if (input.relative) {
                    const previousItemValue = Number(getStyles(currentSlideItem.style, true)?.[input.key] || "0")
                    newValue = previousItemValue + relativeValue + "px"
                }

                values[slide].push(addStyleString(currentSlideItem.style, [input.key, newValue]))
            })
        })

        let finalValues = values
        let finalAllItems = allItems
        if (input.id.includes("CSS")) {
            finalValues = { [slides[0]]: [input.value] }
            finalAllItems = [allItems[0]]
        }

        if (!Object.values(finalValues).length) return

        if (currentActiveEdit.id) {
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", subkey: "style", data: Object.values(finalValues)[0], indexes: finalAllItems },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override: true }
            })
            return
        }

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                id: "setItems",
                newData: { style: { key: "style", values: finalValues[slide] } },
                location: { page: "edit", show: currentActiveShow!, slide, items: slideItems[i], override: "slideitem_" + slide + "_items_" + slideItems[i].join(",") }
            })
        })
    }

    function updateStyle2(input: Record<string, unknown>) {
        const next = { ...input }
        next.value = next.values?.value
        next.input = next.type

        if (next.key === "left" || next.key === "top" || next.key === "width" || next.key === "height") next.relative = true

        updateStyle(next)
    }

    return <EditValues sections={currentItemSections} item={item} styles={data} type="item" onChange={updateStyle2} />
}
