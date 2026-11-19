import { useEffect, useState, type ReactNode } from "react"
import { activePage, activeStage, dictionary, labelsDisabled, openToolsTab, outputs, stageShows } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getAccess } from "../../shared/utils/profile"
import { getItemKeys } from "../edit/logic/scripts/itemClipboard"
import { addStyleString } from "../edit/logic/scripts/textStyle"
import { itemBoxes } from "../edit/logic/values/boxes"
import { history } from "../../shared/utils/helpers/history"
import { getStageOutputId, getStageResolution } from "../../shared/utils/helpers/output"
import { getStyles } from "../../shared/utils/helpers/style"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Center } from "../../shared/ui/system/Center"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { BoxStyle } from "./tools/BoxStyle"
import { ItemStyle } from "./tools/ItemStyle"
import { SlideStyle } from "./tools/SlideStyle"
import styles from "./StageTools.module.css"

interface StageTab {
    id: string
    name: string
    icon: string
    disabled?: boolean
    remove?: boolean
    overflow?: boolean
    tooltip?: string
    data?: string | number
}

// (F24.19a).
// `components/main/Tabs.svelte` no tiene port propio: sus pestañas se renderizan aquí como botones React.
export function StageTools() {
    const currentActiveStage = useStore(activeStage)
    const currentActivePage = useStore(activePage)
    const currentDictionary = useStore(dictionary)
    const currentLabelsDisabled = useStore(labelsDisabled)
    const currentOpenToolsTab = useStore(openToolsTab)
    const currentOutputs = useStore(outputs)
    const currentStageShows = useStore(stageShows)

    const [active, setActive] = useState("text")
    const [overflowHidden, setOverflowHidden] = useState(true)

    const profile = getAccess("stage") as Record<string, string>
    const readOnly = profile.global === "read" || profile[currentActiveStage.id || ""] === "read" || profile[currentActiveStage.id || ""] === "none"

    const selectedItemIds = currentActiveStage.items || []
    const stageItems = currentStageShows[currentActiveStage.id || ""]?.items || {}
    const activeItemId = selectedItemIds[0] || Object.keys(stageItems)[0] || ""
    const item = activeItemId ? stageItems[activeItemId] : null

    let type = item?.type || "text"
    if (type === "slide_text" || type === "slide_notes") type = "text"
    const tabs: StageTab[] = [
        { id: "text", name: `items.${type}`, icon: itemBoxes[type]?.icon || "text", disabled: !!item?.type === false || !activeItemId, tooltip: currentDictionary.tooltip?.text },
        { id: "item", name: "tools.item", icon: "item", disabled: !activeItemId, tooltip: currentDictionary.tooltip?.item },
        { id: "slide", name: "edit.options", icon: "options", overflow: true, tooltip: currentDictionary.tooltip?.slide }
    ]
    const tabMap = Object.fromEntries(tabs.map((tab) => [tab.id, tab])) as Record<string, StageTab>
    const firstOverflowIndex = tabs.findIndex((tab) => tab.overflow)
    const visibleTabs = tabs.filter((tab) => tab.remove !== true && (!tab.overflow || !overflowHidden))

    useEffect(() => {
        if (!activeItemId && active === "item") setActive("text")
        if (item?.type === "metronome") {
            if (active === "text") setActive("item")
        }
    }, [activeItemId, item?.type, active])

    // `$: if ($openToolsTab) openTab()`
    useEffect(() => {
        if (!currentOpenToolsTab) return
        openToolsTab.set("")
        if (!tabMap[currentOpenToolsTab]) return
        setActive(currentOpenToolsTab)
        if (tabs.find((tab) => tab.id === currentOpenToolsTab)?.overflow) setOverflowHidden(false)
    }, [currentOpenToolsTab])

    function resetStageStyle() {
        const stageOutputId = getStageOutputId(currentOutputs)
        const resolution = getStageResolution(stageOutputId, currentOutputs)
        const defaultItemStyle = {
            width: `${resolution.width / 2}px`,
            height: `${resolution.height / 2}px`,
            left: `${resolution.width / 4}px`,
            top: `${resolution.height / 4}px`
        }

        const stageId = currentActiveStage.id
        if (!stageId || !currentStageShows[stageId]) return

        const itemKeys = getItemKeys()
        const activeItems = currentActiveStage.items?.length ? currentActiveStage.items : Object.keys(currentStageShows[stageId].items)
        const textStyles: { [key: string]: string } = {}
        const itemStyles: { [key: string]: string } = {}
        activeItems.forEach((key) => {
            const stageItem = currentStageShows[stageId].items[String(key)]
            if (!stageItem) return
            const stylesObj = getStyles(stageItem.style)

            let textStyle = ""
            let itemStyle = ""
            let defaultStyle = ""

            Object.entries(stylesObj).forEach(([styleKey, value]) => {
                if (Object.keys(defaultItemStyle).includes(styleKey) && active === "item") defaultStyle += `${styleKey}: ${defaultItemStyle[styleKey as keyof typeof defaultItemStyle]};`
                else if (!itemKeys.includes(styleKey)) textStyle += `${styleKey}: ${value};`
                else itemStyle += `${styleKey}: ${value};`
            })

            textStyles[String(key)] = itemStyle
            itemStyles[String(key)] = textStyle + defaultStyle
        })

        if (active === "text") {
            const resetData = { auto: true, chords: {}, timer: {}, clock: {}, tracker: {}, variable: {}, device: {} }
            Object.entries(resetData).forEach(([subkey, data]) => {
                history({
                    id: "UPDATE",
                    newData: { data, key: "items", subkey, keys: activeItems },
                    oldData: { id: stageId },
                    location: { page: "stage", id: "stage_item_content", override: stageId + "_reset_text" }
                })
            })

            history({
                id: "UPDATE",
                newData: { data: textStyles, key: "items", subkey: "style", keys: activeItems },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item_text" }
            })
        } else if (active === "item") {
            history({
                id: "UPDATE",
                newData: { data: itemStyles, key: "items", subkey: "style", keys: activeItems },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item" }
            })
        } else if (active === "slide") {
            history({ id: "UPDATE", newData: { data: {}, key: "settings" }, oldData: { id: stageId }, location: { page: "stage", id: "stage", override: "stage_reset" } })
        }
    }

    useEffect(() => {
        function keydown(event: KeyboardEvent) {
            if (document.activeElement?.closest(".edit")) return

            const stageId = currentActiveStage.id
            const activeItems = currentActiveStage.items
            if (!stageId || !activeItems.length) return

            if (event.key === "Escape") {
                setTimeout(() => activeStage.set({ ...currentActiveStage, items: [] }))
                return
            }

            if (!event.key.includes("Arrow")) return
            event.preventDefault()

            const key = ["ArrowLeft", "ArrowRight"].includes(event.key) ? "left" : "top"
            let value = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1
            if (event.ctrlKey || event.metaKey) value *= 10

            const itemStyles: { [key: string]: string } = {}
            activeItems.forEach((itemId) => {
                const stageItem = currentStageShows[stageId]?.items?.[String(itemId)] || {}
                const style = (stageItem as { style?: string }).style
                const previousItemValue = Number(getStyles(style, true)?.[key] || "0")
                const newValue = previousItemValue + value + "px"
                itemStyles[String(itemId)] = addStyleString(style || "", [key, newValue])
            })

            history({
                id: "UPDATE",
                newData: { data: itemStyles, key: "items", subkey: "style", keys: activeItems },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item" }
            })
        }
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [currentActiveStage, currentStageShows, currentActivePage])

    function renderTabButton(tab: StageTab): ReactNode {
        return (
            <Button
                key={tab.id}
                isActive={active === tab.id}
                disabled={tab.disabled}
                icon={tab.icon}
                white={active === tab.id}
                title={tab.tooltip || tab.name}
                onClick={() => {
                    setActive(tab.id)
                    setOverflowHidden(false)
                }}
            >
                {currentLabelsDisabled ? null : (
                    <span>
                        {translateText(tab.name)}
                        {tab.data !== undefined ? <span style={{ marginLeft: "4px", opacity: 0.5, fontSize: "0.75em" }}>{tab.data}</span> : null}
                    </span>
                )}
            </Button>
        )
    }

    return (
        <div className={`main border stageTools ${styles.main}`}>
            {!readOnly ? (
                <>
                    <div className={styles.tabs}>
                        {visibleTabs.map(renderTabButton)}
                        {firstOverflowIndex > -1 && overflowHidden ? (
                            <Button
                                icon="arrow_right"
                                white
                                title={translateText("tooltip.options").replace(".", "")}
                                style={{ flex: "0", padding: "0 1em" }}
                                onClick={() => {
                                    setActive(tabs[firstOverflowIndex].id)
                                    setTimeout(() => setOverflowHidden(false))
                                }}
                            />
                        ) : null}
                    </div>

                    {active === "text" ? (
                        <div className={styles.content}>
                            {activeItemId ? (
                                <BoxStyle />
                            ) : (
                                <Center faded>
                                    <T id="empty.items" />
                                </Center>
                            )}
                        </div>
                    ) : null}
                    {active === "item" ? (
                        <div className={styles.content}>
                            <ItemStyle />
                        </div>
                    ) : null}
                    {active === "slide" ? (
                        <div className={styles.content}>
                            <SlideStyle />
                        </div>
                    ) : null}

                    {activeItemId || active === "slide" ? (
                        <FloatingBar>
                            <Button icon="reset" title="actions.reset" onClick={resetStageStyle} />
                        </FloatingBar>
                    ) : null}
                </>
            ) : null}
        </div>
    )
}
