import { useRef } from "react"
import type { StageItem } from "../../../../types/Stage"
import { activeStage, stageShows } from "../../../shared/core/stores"
import { addFilterString, addStyleString } from "../../../components/edit/scripts/textStyle"
import type { EditBoxSection, EditInput } from "../../../components/edit/values/boxes"
import { setBoxInputValue } from "../../../components/edit/values/boxes"
import { itemSections } from "../../../components/edit/values/item"
import { clone } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { percentageToAspectRatio, stylePosToPercentage } from "../../../shared/utils/helpers/output"
import { getStyles } from "../../../shared/utils/helpers/style"
import { updateStageShow } from "../../../components/stage/stage"
import { EditValues } from "../../edit/tools/EditValues"
import { useStore } from "../../../shared/ui/hooks/useStore"

// El Svelte original escribía `input.relative` e `input.input` sobre el detail de EditValues (tipado como any).
type ItemStyleInput = EditInput & { relative?: boolean; input?: string }

// `EditValues` migrated to React (F24.24 P9c): `dispatch("change", input)` → `onChange(input)`.
export function ItemStyle() {
    const currentActiveStage = useStore(activeStage)
    const currentStageShows = useStore(stageShows)

    const stageItems = currentStageShows[currentActiveStage.id || ""]?.items || {}
    const activeItemIds: string[] = currentActiveStage.items?.length ? currentActiveStage.items : Object.keys(stageItems)
    const activeItemId = activeItemIds[0] || ""
    const item = (activeItemId ? stageItems[activeItemId] : null) as (StageItem & { [key: string]: unknown }) | null

    const currentItemSections = clone(itemSections) as { [key: string]: EditBoxSection }
    delete currentItemSections.shape_outside

    let data: { [key: string]: string } = {}
    if (item?.style || item === null) {
        data = getStyles(item?.style, true) as { [key: string]: string }

        // gradient
        const styles = getStyles(item?.style) as { [key: string]: string }
        const isGradient = styles.background?.includes("gradient")
        if (isGradient) data["background-color"] = styles.background

        const transform = data["transform"] || ""
        const showPerspective = transform.includes("rotateX") && !transform.includes("rotateX(0deg)")
        setBoxInputValue(currentItemSections, "transform", "perspective", "hidden", !showPerspective)

        data = stylePosToPercentage(data) as { [key: string]: string }
    }

    const itemBackFilters = (getStyles(item?.style) as { [key: string]: string })["backdrop-filter"]
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    function updateStyle(inputArg: ItemStyleInput) {
        const input = percentageToAspectRatio(inputArg)

        if (input.id === "backdrop-filter" || input.id === "transform") {
            const oldString = input.id === "backdrop-filter" ? itemBackFilters : data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        // gradient value
        if (input.id === "style" && input.key === "background-color") {
            if (typeof input.value !== "string") input.value = ""
            if (input.value.includes("gradient")) input.key = "background"
            else if (data.background) updateStyle({ ...input, key: "background", value: "" })
        }

        let value: string = addStyleString(item?.style || "", [input.key, input.value]) || ""
        if (input.id.includes("CSS")) value = input.value
        if (!value) return

        // only update changed value
        const styles: { [key: string]: string } = {}
        activeItemIds.forEach((itemId) => {
            const currentItem = stageItems[itemId] as { style?: string } | undefined
            if (!currentItem) return
            styles[itemId] = input.id.includes("CSS") ? value : addStyleString(currentItem.style || "", [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: styles, key: "items", subkey: "style", keys: Object.keys(styles) },
            oldData: { id: currentActiveStage.id },
            location: { page: "stage" as const, id: "stage_item_style", override: currentActiveStage.id + activeItemIds.join("") }
        })

        if (!timeout.current) {
            updateStageShow()
            timeout.current = setTimeout(() => {
                updateStageShow()
                timeout.current = null
            }, 500)
        }
    }

    function updateStyle2(rawInput: EditInput) {
        const input: ItemStyleInput = { ...rawInput, value: rawInput.values.value }
        input.input = input.type

        if (input.key === "left" || input.key === "top" || input.key === "width" || input.key === "height") input.relative = true

        updateStyle(input)
    }

    return <EditValues sections={currentItemSections} item={item as never} styles={data} isStage={true} onChange={updateStyle2} />
}
