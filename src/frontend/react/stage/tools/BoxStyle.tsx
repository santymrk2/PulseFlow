import { useRef } from "react"
import type { StageItem } from "../../../../types/Stage"
import { activeStage, stageShows, theme, themes } from "../../../stores"
import { MAX_FONT_SIZE } from "../../../components/edit/scripts/autosize"
import { addStyleString } from "../../../components/edit/scripts/textStyle"
import type { EditBoxSection, EditInput } from "../../../components/edit/values/boxes"
import { itemBoxes, setBoxInputValue } from "../../../components/edit/values/boxes"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getCustomMetadata } from "../../../components/helpers/show"
import { getStyles } from "../../../components/helpers/style"
import { updateStageShow } from "../../../components/stage/stage"
import { slideTextSections } from "../../../components/stage/values/text"
import EditValues from "../../../components/edit/tools/EditValues.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"

type StyleInput = Partial<EditInput> & { id: string; value: unknown; name?: string; key?: string; values?: { [key: string]: unknown } }

// `EditValues` sigue en Svelte (F24.21a): se monta como isla y su `dispatch("change", input)` llega como events.change.
export function BoxStyle() {
    const currentActiveStage = useStore(activeStage)
    const currentStageShows = useStore(stageShows)
    const currentTheme = useStore(theme)
    const currentThemes = useStore(themes)

    const stageItems = currentStageShows[currentActiveStage.id || ""]?.items || {}
    const activeItemIds: string[] = currentActiveStage.items?.length ? currentActiveStage.items : Object.keys(stageItems)
    const activeItemId = activeItemIds[0] || ""
    const item = (activeItemId ? stageItems[activeItemId] : null) as (StageItem & { [key: string]: unknown }) | null

    let type = item?.type || ""
    if (activeItemId.includes("tracker")) type = "slide_tracker"
    else if (item?.type === "slide_text" || item?.type === "slide_notes" || item?.type === "variable" || activeItemId.includes("text") || activeItemId.includes("slide") || activeItemId.includes("notes") || activeItemId.includes("variable")) type = "text"
    else if (activeItemId.includes("clock")) type = "clock"
    else if (activeItemId.includes("timer")) type = "timer"

    const isSlideText = item?.type === "slide_text"
    const isTextItem = item?.type === "slide_text" || item?.type === "text"

    let stageSections: { [key: string]: EditBoxSection } = item ? (clone(isSlideText ? slideTextSections : itemBoxes[item.type || ""]?.sections) as { [key: string]: EditBoxSection }) || {} : {}

    if (item?.type === "text" && stageSections) {
        delete stageSections.chords
        delete stageSections.scrolling

        // item background flash
        if (stageSections.special) {
            const flashEnabled = !!(item.flash as { enabled?: boolean } | undefined)?.enabled
            stageSections.special = {
                ...stageSections.special,
                inputs: [
                    ...stageSections.special.inputs,
                    [{ id: "flash.enabled", type: "checkbox", value: false, values: { label: "timer.flash" } } as EditInput],
                    [{ id: "flash.color", type: "color", value: (item.flash as { color?: string } | undefined)?.color || "#FF0000", hidden: !flashEnabled, values: { label: "edit.color" } } as EditInput, { id: "flash.count", type: "number", value: (item.flash as { count?: number } | undefined)?.count ?? 3, hidden: !flashEnabled, values: { label: "edit.count", min: 1, max: 20 } } as EditInput]
                ]
            }
        }
    }

    if (isSlideText) {
        stageSections = clone(item?.keepStyle ? { default: slideTextSections.default, chords: slideTextSections.chords, special: slideTextSections.special } : slideTextSections) as { [key: string]: EditBoxSection }

        // line height
        if (stageSections.text) stageSections.text = { inputs: [...stageSections.text.inputs, [{ id: "style", key: "line-height", type: "number", value: 1.1, multiplier: 10, extension: "em", values: { label: "edit.line_height", max: 50 } } as EditInput]] }

        // allow no color (inherit from slide)
        if (stageSections.font) stageSections.font.inputs[0][1].values.allowEmpty = true
    }

    if (stageSections?.CSS) setBoxInputValue(stageSections, "CSS", "CSS_text", "value", item?.style || "")

    const alignStyle = item?.align ? { "align-items": item.align } : {}
    const lineAlignStyle = item?.alignX ? { "text-align": item.alignX } : {}
    const customValues = {
        "text-align": lineAlignStyle["text-align"] || "center",
        "align-items": alignStyle["align-items"] || "center"
    }

    let styles: { [key: string]: string } = {}
    if (item?.style || item === null) styles = getStyles(item?.style, true) as { [key: string]: string }

    if (stageSections?.font || type === "text") {
        const sectionId = stageSections?.font ? "font" : "default"
        const defaultTextFit = isSlideText ? "shrinkToFit" : item?.type === "text" ? "none" : "growToFit"
        const currentTextFit = (item?.textFit as string | undefined) || defaultTextFit
        setBoxInputValue(stageSections, sectionId, "font-size", "disabled", !isTextItem && currentTextFit === "growToFit")
        setBoxInputValue(stageSections, sectionId, "textFit", "default", defaultTextFit)
    }

    if (item && type === "text") {
        const sectionId = stageSections?.font ? "font" : "default"
        setBoxInputValue(stageSections, sectionId, "font-family", "default", "Arial")
        setBoxInputValue(stageSections, sectionId, "font-family", "styleValue", styles["font"] || "")
    }
    if (item && isSlideText) {
        setBoxInputValue(stageSections, "default", "lineCount", "hidden", Number(item.slideOffset || 0) === 0)
        setBoxInputValue(stageSections, "default", "invertItems", "hidden", Number(item.itemNumber || 0) !== 0)
    }

    if (item?.type === "slide_tracker" || activeItemId?.includes("tracker")) {
        const tracker = (item?.tracker as { accent?: string; type?: string; projectMetadata?: string } | undefined) || {}
        setBoxInputValue(stageSections, "default", "tracker.accent", "value", tracker.accent || currentThemes[currentTheme]?.colors?.secondary || "#F0008C")

        const metadataLabelMap: { [key: string]: string } = {
            number: "meta.number",
            title: "meta.title",
            artist: "meta.artist",
            author: "meta.author",
            composer: "meta.composer",
            publisher: "meta.publisher",
            copyright: "meta.copyright",
            CCLI: "meta.CCLI",
            year: "meta.year",
            key: "meta.key"
        }
        const metadataOptions = [{ value: "name", label: "show.name" }, ...Object.keys(getCustomMetadata()).map((key) => ({ value: key, label: metadataLabelMap[key] || key }))]
        setBoxInputValue(stageSections, "default", "tracker.projectMetadata", "options", metadataOptions)

        setBoxInputValue(stageSections, "default", "tracker.childProgress", "hidden", tracker.type !== "group")
        setBoxInputValue(stageSections, "default", "tracker.oneLetter", "hidden", tracker.type !== "group")
        setBoxInputValue(stageSections, "default", "tracker.projectMetadata", "hidden", tracker.type !== "project")
    }

    if (item?.type === "camera") {
        const device = item.device as { name?: string; type?: string } | undefined
        if (device?.name) setBoxInputValue(stageSections, "default", "device", "name", device.name)
        if (device?.type) setBoxInputValue(stageSections, "default", "device", "icon", device.type === "ndi" ? "ndi" : device.type === "omt" ? "omt" : device.type === "screen" ? "screen" : device.type === "blackmagic" ? "blackmagic" : "camera")
    }

    if (item?.type === "timer" && item) {
        const timer = item.timer as { viewType?: string } | undefined
        setBoxInputValue(stageSections, "default", "timer.circleMask", "hidden", timer?.viewType !== "circle")
        setBoxInputValue(stageSections, "default", "timer.showHours", "hidden", (timer?.viewType || "time") !== "time")
    }
    if (item?.type === "clock" && item) {
        const clock = (item.clock as { type?: string; dateFormat?: string; customFormat?: string; showTime?: boolean } | undefined) || {}
        const clockType = clock.type || "digital"
        const dateFormat = clock.dateFormat || "none"
        const customFormat = clock.customFormat || ""
        const showOffsetDays = clockType === "custom" && /[MDY]/.test(customFormat)

        setBoxInputValue(stageSections, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue(stageSections, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue(stageSections, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && clock.showTime === false && dateFormat !== "none"))
        setBoxInputValue(stageSections, "default", "clock.customFormat", "hidden", clockType !== "custom")
        setBoxInputValue(stageSections, "default", "clock.offsetDays", "hidden", !showOffsetDays)

        // show seconds by default on stage
        setBoxInputValue(stageSections, "default", "clock.seconds", "value", true)
    }

    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    function historyLocation(id: string) {
        return { page: "stage" as const, id, override: currentActiveStage.id + activeItemIds.join("") }
    }

    function setValue(input: StyleInput) {
        let value: unknown = input.value
        if (input.id.includes(".")) {
            const splitted = input.id.split(".")
            input.id = splitted[0]

            let newValue: unknown = item?.[input.id]
            if (typeof newValue !== "object" || newValue === null) newValue = {}
            else newValue = clone(newValue)
            ;(newValue as { [key: string]: unknown })[splitted[1]] = value
            value = newValue
        }
        history({
            id: "UPDATE",
            newData: { data: value, key: "items", subkey: input.id, keys: activeItemIds },
            oldData: { id: currentActiveStage.id },
            location: historyLocation("stage_item_content")
        })
    }

    function updateAlign(input: StyleInput) {
        const id = input.key === "text-align" ? "alignX" : "align"
        history({
            id: "UPDATE",
            newData: { data: input.value, key: "items", subkey: id, keys: activeItemIds },
            oldData: { id: currentActiveStage.id },
            location: historyLocation("stage_item_content")
        })
    }

    function updateStyle(inputArg: StyleInput) {
        let input = inputArg
        if (input.key === "text-align" || input.key === "align-items") {
            updateAlign(input)
            return
        }

        if (input.id === "nowrap") input = { ...input, id: "style", key: "white-space", value: input.value ? "nowrap" : undefined }

        if (input.id !== "style" && !input.id.includes("CSS")) {
            setValue(input)
            return
        }

        let value: string = addStyleString(item?.style || "", [input.key, input.value]) || ""
        if (input.id.includes("CSS")) value = String(input.value).replaceAll("\n", "")
        if (!value) return

        const updateType = item?.type
        const changedStyles: { [key: string]: string } = {}
        activeItemIds.forEach((itemId) => {
            const currentItem = stageItems[itemId] as { type?: string; style?: string } | undefined
            if (!currentItem || (!currentActiveStage.items?.length && currentItem.type !== updateType)) return
            changedStyles[itemId] = input.id.includes("CSS") ? value : addStyleString(currentItem.style || "", [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: changedStyles, key: "items", subkey: "style", keys: Object.keys(changedStyles) },
            oldData: { id: currentActiveStage.id },
            location: historyLocation("stage_item_content")
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
        const input: StyleInput = { ...rawInput, value: rawInput.values.value, key: rawInput.key, id: rawInput.id }
        if (input.id === "textFit") {
            updateStyle({ id: "auto", value: rawInput.values.value !== "none" })

            if (isTextItem) {
                let newFontSize = 0
                const fontNumber = Number(styles["font-size"])
                if (rawInput.values.value !== "growToFit" && fontNumber < 200) newFontSize = 0
                else newFontSize = rawInput.values.value !== "growToFit" ? 100 : MAX_FONT_SIZE
                if (newFontSize) updateStyle({ name: "font_size", id: "style", key: "font-size", value: newFontSize + "px" })
            }
        }
        updateStyle(input)
    }

    return <SvelteIsland component={EditValues as never} props={{ sections: stageSections, styles, item, customValues, isStage: true }} events={{ change: (event: CustomEvent<EditInput>) => updateStyle2(event.detail) }} />
}
