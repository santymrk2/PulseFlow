import { useEffect, useRef, useState } from "react"
import type { Item } from "../../../../types/Show"
import { activeEdit, activeShow, outputs, overlays, templates } from "../../../stores"
import { translateText } from "../../../utils/language"
import { menuClick } from "../../../components/context/menuClick"
import { clone } from "../../../components/helpers/array"
import { history } from "../../../components/helpers/history"
import { getLayoutRef } from "../../../components/helpers/show"
import { _show } from "../../../components/helpers/shows"
import { getStyles } from "../../../components/helpers/style"
import { isoLanguages } from "../../../components/main/popups/localization/isoLanguages"
import { isConditionMet } from "../../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../../components/edit/scripts/textStyle"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import Movebox from "../../../components/system/Movebox.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { Button } from "../../ui/button/Button"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import styles from "./EditboxPlain.module.css"

export interface EditboxPlainProps {
    item: Item | null
    index: number
    ratio: number
    hideMovebox?: boolean
}

const ACTIONS = [
    { id: "transition", label: "popup.transition", icon: "transition", direct: false },
    { id: "clickReveal", label: "actions.click_reveal", icon: "click_action", direct: true },
    { id: "lineReveal", label: "actions.line_reveal", icon: "line_reveal", direct: true },
    { id: "displayDuration", label: "popup.display_duration", icon: "clock", direct: false },
    { id: "showTimer", label: "actions.show_timer", icon: "time_in", direct: false },
    { id: "hideTimer", label: "actions.hide_timer", icon: "time_out", direct: false }
] as const

// Port de components/edit/editbox/EditboxPlain.svelte (F24.21c).
export function EditboxPlain({ item, index, ratio, hideMovebox = false }: EditboxPlainProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentActiveShow = useStore(activeShow)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentTemplates = useStore(templates)

    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const isMic = JSON.stringify(item?.conditions?.showItem || "").includes('"element":"volume"')

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (item?.conditions?.showItem) {
            intervalRef.current = setInterval(() => setConditionsUpdater((value) => value + 1), isMic ? 100 : 3000)
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [item?.conditions?.showItem, isMic])

    function getSlideItems() {
        if (currentActiveEdit.id) {
            let slide: Record<string, { items?: Item[] }> = {}
            if (currentActiveEdit.type === "overlay") slide = currentOverlays
            else if (currentActiveEdit.type === "template") slide = currentTemplates
            return slide[currentActiveEdit.id]?.items || []
        }
        const layoutRef = getLayoutRef()
        const slideRef = layoutRef[currentActiveEdit.slide ?? -1]
        return _show().get("slides")?.[slideRef?.id]?.items || []
    }

    function removeItemValue(valueId: string) {
        getSlideItems()
        if (currentActiveEdit.type === "overlay" || currentActiveEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", subkey: valueId, data: [undefined], indexes: [index] },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override: "deleteitem" + valueId + "_" + index }
            })
            return
        }

        const layoutRef = getLayoutRef()
        const slideRef = layoutRef[currentActiveEdit.slide ?? -1]
        history({
            id: "setItems",
            newData: { style: { key: valueId, values: [undefined] } },
            location: { page: "edit", show: currentActiveShow!, slide: slideRef?.id, items: [index], override: "deleteitem" + valueId + "_" + slideRef?.id + "_items_" + index }
        })
    }

    function removeBindings() {
        menuClick("bind_item")
    }

    function removeAction(action: string) {
        const slideItems = getSlideItems()
        if (!slideItems?.[index]) return

        const actions = clone(slideItems[index].actions || {})
        delete actions[action]

        if (currentActiveEdit.type === "overlay" || currentActiveEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", subkey: "actions", data: [actions], indexes: [index] },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override: "deleteitemaction_" + index }
            })
            return
        }

        const layoutRef = getLayoutRef()
        const slideRef = layoutRef[currentActiveEdit.slide ?? -1]
        history({
            id: "setItems",
            newData: { style: { key: "actions", values: [actions] } },
            location: { page: "edit", show: currentActiveShow!, slide: slideRef?.id, items: [index], override: "deleteitemaction_" + slideRef?.id + "_items_" + index }
        })
    }

    const textStyles = getStyles(item?.lines?.[0]?.text?.[0]?.style)
    const textTransform = !!(textStyles["text-transform"] && textStyles["text-transform"] !== "none")
    const showItemState = item?.conditions?.showItem ? isConditionMet(item.conditions.showItem, getItemText(item), "default", conditionsUpdater) : false

    return (
        <>
            {!hideMovebox ? <SvelteIsland component={Movebox} props={{ ratio, itemStyle: item?.style, active: currentActiveEdit.items.includes(index), onlyCorners: item?.type === "icon" && item?.id !== "empty" }} /> : null}

            <div className={styles.actions}>
                {item?.language ? (
                    <div data-title={isoLanguages.find((a) => a.code === item.language)?.name || item.language} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="translate" white />
                        </span>
                    </div>
                ) : null}

                {textTransform ? (
                    <div data-title={translateText("edit.text_transform")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="capitalize" white />
                        </span>
                    </div>
                ) : null}

                {item?.list?.enabled ? (
                    <div data-title={translateText("edit.list")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="list" white />
                        </span>
                    </div>
                ) : null}

                {item?.scrolling?.type && item.scrolling.type !== "none" ? (
                    <div data-title={translateText("edit.scrolling")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="scrolling" white />
                        </span>
                    </div>
                ) : null}

                {item?.button?.press || item?.button?.release ? (
                    <div data-title={translateText("popup.action")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="button" white />
                        </span>
                    </div>
                ) : null}

                {item?.bindings?.length ? (
                    <div data-title={translateText("actions.remove_binding")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <Button align="start" onClick={removeBindings} redHover>
                            <Icon id="bind" white />
                        </Button>
                        {item.bindings.length > 1 ? <span className={styles.actionValue}>{item.bindings.length}</span> : <span className={styles.actionValue}>{item.bindings[0] === "stage" ? <T id="menu.stage" /> : currentOutputs[item.bindings[0]]?.name}</span>}
                    </div>
                ) : null}

                {Object.values(item?.conditions || {}).length ? (
                    <div data-title={translateText("actions.conditions")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;background-color: var(--${showItemState ? "" : "dis"}connected);`)}>
                        <Button align="start" onClick={() => removeItemValue("conditions")} redHover>
                            <Icon id="light" white />
                        </Button>
                    </div>
                ) : null}

                {ACTIONS.map((action) => {
                    const actionValue = item ? (action.direct ? (item as unknown as Record<string, unknown>)[action.id] : (item.actions as Record<string, unknown> | undefined)?.[action.id]) : null
                    if (!actionValue) return null
                    return (
                        <div key={action.id} data-title={translateText(action.label)} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                            <Button align="start" onClick={() => (action.direct ? removeItemValue(action.id) : removeAction(action.id))} redHover>
                                <Icon id={action.icon} white />
                            </Button>
                            {typeof actionValue === "number" ? <span className={styles.actionValue}>{actionValue}s</span> : null}
                        </div>
                    )
                })}

                {Array.isArray(item?.lines) && item.lines.find((a) => Array.isArray(a.text) && a.text.find((t) => t.style?.includes("-gradient"))) ? (
                    <div data-title={translateText("popup.color_gradient")} className={styles.actionButton} style={cssTextToStyle(`zoom: ${1 / ratio};left: 0;inset-inline-end: unset;`)}>
                        <span style={cssTextToStyle("padding: 5px;z-index: 3;font-size: 0;")}>
                            <Icon id="color" white />
                        </span>
                    </div>
                ) : null}
            </div>
        </>
    )
}
