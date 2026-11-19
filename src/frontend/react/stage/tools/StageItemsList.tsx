import type { MouseEvent as ReactMouseEvent } from "react"
import type { Item } from "../../../../types/Show"
import type { StageItem } from "../../../../types/Stage"
import { activeStage, dictionary, selected, stageShows, timers } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getSortedStageItems, rearrangeStageItems } from "../../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../../components/edit/scripts/textStyle"
import { clone } from "../../../components/helpers/array"
import { getFileName } from "../../../components/helpers/media"
import { getCustomStageLabel } from "../../../components/stage/stage"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import styles from "./StageItemsList.module.css"

// (F24.19a).
export function StageItemsList() {
    const currentActiveStage = useStore(activeStage)
    const currentDictionary = useStore(dictionary)
    const currentStageShows = useStore(stageShows)
    const currentTimers = useStore(timers)

    const stageId = currentActiveStage.id || ""
    const allItems = getSortedStageItems(stageId, currentStageShows)
    const invertedItemList = Array.isArray(allItems) ? (clone(allItems) as (StageItem & { id: string })[]).reverse() : []

    const getIdentifier: Record<string, (item: StageItem & { id: string }) => string> = {
        text: (item) => getItemText(item as Item).slice(0, 10),
        media: (item) => getFileName(item.src || ""),
        timer: (item) => (item.timer?.id ? currentTimers[item.timer.id]?.name || "" : ""),
        clock: () => ""
    }

    function selectOnRightClick(event: ReactMouseEvent<HTMLDivElement>) {
        if (event.button !== 2) return
        const itemId = ((event.target as Element).closest(".item_button")?.id || "").slice(1)
        activeStage.set({ ...currentActiveStage, items: [itemId] })
    }

    function selectItem(id: string, ctrl: boolean) {
        selected.set({ id: null, data: [] })
        activeStage.update((as) => {
            if (ctrl) {
                if (as.items.includes(id)) as.items.splice(as.items.indexOf(id), 1)
                else as.items.push(id)
            } else if (!as.items.includes(id)) as.items = [id]
            else as.items = []
            return as
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

            <div className={`items ${invertedItemList.length > 1 ? "context #items_list_item_stage" : ""}`} style={{ display: "flex", flexDirection: "column" }} onMouseDown={selectOnRightClick}>
                {invertedItemList.map((currentItem, i) => {
                    const id = currentItem.id
                    const type = currentItem.type || "text"
                    const iconId = type === "icon" ? id || "" : undefined
                    return (
                        <Button key={id} id={`#${id}`} variant="outline" className="item_button" style={{ width: "100%", justifyContent: "space-between", padding: "2px 8px" }} isActive={currentActiveStage.items.includes(id)} tab onClick={(detail) => selectItem(id, detail.ctrl)}>
                            <span style={{ display: "flex", alignItems: "center", maxWidth: "70%" }}>
                                <p style={{ opacity: 0.7, marginInlineEnd: "10px" }}>{i + 1}</p>
                                <Icon id={iconId ?? "text"} custom={type === "icon"} size={0.8} />
                                <p style={{ opacity: 0.9, marginInlineStart: "10px" }}>{getCustomStageLabel(currentItem.type || id, currentItem, currentDictionary) || translateText(`items.${type}`)}</p>
                                {getIdentifier[type] ? <p style={{ marginInlineStart: "10px", maxWidth: "40%", opacity: 0.5, fontSize: "0.8em" }}>{getIdentifier[type](currentItem)}</p> : null}
                            </span>
                            <span>
                                <Button disabled={i === allItems.length - 1} icon="down" title="actions.backward" style={{ padding: "8px" }} onClick={() => rearrangeStageItems("backward", id)} />
                                <Button disabled={i === 0} icon="up" title="actions.forward" style={{ padding: "8px" }} onClick={() => rearrangeStageItems("forward", id)} />
                            </span>
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}
