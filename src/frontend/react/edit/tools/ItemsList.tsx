import { type MouseEvent } from "react"
import type { Item, ItemType } from "../../../../types/Show"
import { activeEdit, selected, timers, variables } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { clone } from "../../../shared/utils/helpers/array"
import { getFileName } from "../../../shared/utils/helpers/media"
import { rearrangeItems } from "../../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../../components/edit/scripts/textStyle"
import { itemBoxes } from "../../../components/edit/values/boxes"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Button, type ButtonClickDetail } from "../../../shared/ui/kit/button/Button"
import styles from "./ItemsList.module.css"

export interface ItemsListProps {
    allSlideItems: Item[]
    onAllSlideItemsChange?: (items: Item[]) => void
}

const getIdentifier = {
    text: (item: Item) => {
        const text = getItemText(item)
        return text.slice(0, 10)
    },
    media: (item: Item) => {
        const path = item.src
        return getFileName(path || "")
    },
    timer: (item: Item, timerList: Record<string, { name?: string }>) => {
        const timerId = item.timer?.id || item.timerId
        if (!timerId) return ""
        return timerList[timerId]?.name || ""
    },
    clock: () => "",
    variable: (item: Item, variableList: Record<string, { name?: string }>) => {
        const name = variableList[item.variable?.id || ""]?.name || ""
        return name
    },
    chart: (item: Item) => item.chart?.type || "",
    table: () => ""
} as const

const getType = (item: Item): ItemType => (item?.type as ItemType) || "text"

export function ItemsList({ allSlideItems }: ItemsListProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentTimers = useStore(timers)
    const currentVariables = useStore(variables)

    const invertedItemList = Array.isArray(allSlideItems) ? clone(allSlideItems).reverse() : []

    function handleContainerMouseDown(e: MouseEvent<HTMLDivElement>) {
        if (e.button !== 2) return
        const target = e.target as HTMLElement | null
        const id = target?.closest(".item_button")?.id || ""
        const index = Number(id.slice(1))
        if (Number.isNaN(index)) return
        activeEdit.set({ ...currentActiveEdit, items: [index] })
    }

    function handleItemClick(detail: ButtonClickDetail, index: number) {
        selected.set({ id: null, data: [] })
        activeEdit.update((ae) => {
            if (detail.ctrl) {
                if (ae.items.includes(index)) ae.items.splice(ae.items.indexOf(index), 1)
                else ae.items.push(index)
            } else if (!ae.items.includes(index)) ae.items = [index]
            else ae.items = []
            return ae
        })
    }

    if (!invertedItemList.length) return null

    return (
        <div style={{ marginTop: "10px" }}>
            <div className={styles.title}>
                <span style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px" }}>
                    <Icon id="rearrange" white />
                    <p>{translateText("edit.arrange_items")}</p>
                </span>
            </div>

            <div className={`items ${invertedItemList.length > 1 ? "context #items_list_item" : ""}`} style={{ display: "flex", flexDirection: "column" }} onMouseDown={handleContainerMouseDown}>
                {invertedItemList.map((currentItem, i) => {
                    const index = invertedItemList.length - i - 1
                    const type = getType(currentItem)
                    const identifier = (() => {
                        if (type === "timer") return getIdentifier.timer(currentItem, currentTimers)
                        if (type === "variable") return getIdentifier.variable(currentItem, currentVariables)
                        const fn = (getIdentifier as unknown as Record<string, ((item: Item) => string) | undefined>)[type]
                        return fn ? fn(currentItem) : ""
                    })()

                    return (
                        <Button key={`${index}-${i}`} id={`#${index}`} variant="outline" className="item_button" style={{ width: "100%", justifyContent: "space-between", padding: "2px 8px" }} isActive={currentActiveEdit.items.includes(index)} tab onClick={(detail) => handleItemClick(detail, index)}>
                            <span style={{ display: "flex", alignItems: "center", maxWidth: "70%" }}>
                                <p style={{ opacity: 0.7, marginInlineEnd: "10px" }}>{i + 1}</p>
                                <Icon id={type === "icon" ? currentItem.id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                                <p style={{ opacity: 0.9, marginInlineStart: "10px" }}>{translateText("items." + type)}</p>
                                {identifier ? <p style={{ marginInlineStart: "10px", opacity: 0.5, fontSize: "0.8em", maxWidth: "40%" }}>{identifier}</p> : null}
                            </span>
                            <span>
                                <Button disabled={i === allSlideItems.length - 1} icon="down" title="actions.backward" style={{ padding: "8px" }} onClick={() => rearrangeItems("backward", index)} />
                                <Button disabled={i === 0} icon="up" title="actions.forward" style={{ padding: "8px" }} onClick={() => rearrangeItems("forward", index)} />
                            </span>
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}
