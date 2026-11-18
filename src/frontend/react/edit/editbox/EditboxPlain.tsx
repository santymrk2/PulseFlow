import { useEffect, useMemo, useRef, useState } from "react"
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
import { Movebox } from "../../system/Movebox"
import { isConditionMet } from "../../../components/edit/scripts/itemHelpers"
import { getItemText } from "../../../components/edit/scripts/textStyle"
import { Button } from "../../ui/button/Button"
import { Icon } from "../../helpers/Icon"
import { T } from "../../helpers/T"
import { useStore } from "../../hooks/useStore"
import styles from "./EditboxPlain.module.css"

export interface EditboxPlainProps {
    item: Item | null
    index: number
    ratio: number
    hideMovebox?: boolean
}

const actions = [
    { id: "transition", label: "popup.transition", icon: "transition" },
    { id: "clickReveal", label: "actions.click_reveal", icon: "click_action", direct: true },
    { id: "lineReveal", label: "actions.line_reveal", icon: "line_reveal", direct: true },
    { id: "displayDuration", label: "popup.display_duration", icon: "clock" },
    { id: "showTimer", label: "actions.show_timer", icon: "time_in" },
    { id: "hideTimer", label: "actions.hide_timer", icon: "time_out" }
]

// Port de components/edit/editbox/EditboxPlain.svelte (F24.21c).
export function EditboxPlain({ item, index, ratio, hideMovebox = false }: EditboxPlainProps) {
    const currentActiveEdit = useStore(activeEdit)
    const activeShowValue = useStore(activeShow)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentTemplates = useStore(templates)

    const [conditionsUpdater, setConditionsUpdater] = useState(0)
    const latest = useRef({ currentActiveEdit, currentActiveShow: activeShowValue, currentOverlays, currentTemplates })
    latest.current.currentActiveEdit = currentActiveEdit
    latest.current.currentActiveShow = activeShowValue
    latest.current.currentOverlays = currentOverlays
    latest.current.currentTemplates = currentTemplates

    function getSlideItems() {
        const { currentActiveEdit, currentOverlays, currentTemplates } = latest.current
        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[currentActiveEdit.slide!] || {}
        let slideItems = _show().get("slides")?.[slideRef.id]?.items || []

        if (currentActiveEdit.id) {
            let slide: Record<string, { items?: Item[] }> = {}
            if (currentActiveEdit.type === "overlay") slide = currentOverlays
            else if (currentActiveEdit.type === "template") slide = currentTemplates
            slideItems = slide[currentActiveEdit.id!]?.items
        }

        return { slideRef, slideItems }
    }

    function removeItemValue(valueId: string) {
        const { currentActiveEdit, currentActiveShow } = latest.current
        const { slideRef, slideItems } = getSlideItems()
        if (!slideItems) return

        if (currentActiveEdit.type === "overlay" || currentActiveEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", subkey: valueId, data: [undefined], indexes: [index] },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override: "deleteitem" + valueId + "_" + index }
            } as Parameters<typeof history>[0])
            return
        }

        history({
            id: "setItems",
            newData: { style: { key: valueId, values: [undefined] } },
            location: { page: "edit", show: currentActiveShow!, slide: slideRef.id, items: [index], override: "deleteitem" + valueId + "_" + slideRef.id + "_items_" + index }
        } as Parameters<typeof history>[0])
    }

    function removeBindings() {
        menuClick("bind_item")
    }

    function removeAction(action: string) {
        const { currentActiveEdit, currentActiveShow } = latest.current
        const { slideRef, slideItems } = getSlideItems()
        if (!slideItems?.[index]) return

        let itemActions = clone(slideItems[index].actions || {})
        delete itemActions[action]

        if (currentActiveEdit.type === "overlay" || currentActiveEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: currentActiveEdit.id },
                newData: { key: "items", subkey: "actions", data: [itemActions], indexes: [index] },
                location: { page: "edit", id: currentActiveEdit.type + "_items", override: "deleteitemaction_" + index }
            } as Parameters<typeof history>[0])
            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: [itemActions] } },
            location: { page: "edit", show: currentActiveShow!, slide: slideRef.id, items: [index], override: "deleteitemaction_" + slideRef.id + "_items_" + index }
        } as Parameters<typeof history>[0])
    }

    const itemStyles = useMemo(() => getStyles(item?.lines?.[0]?.text?.[0]?.style), [item?.lines])
    const textTransform = !!(itemStyles["text-transform"] && itemStyles["text-transform"] !== "none")

    const isMic = useMemo(() => JSON.stringify(item?.conditions?.showItem || "").includes('"element":"volume"'), [item?.conditions?.showItem])

    useEffect(() => {
        if (!item?.conditions?.showItem) return
        const id = setInterval(() => setConditionsUpdater((v) => v + 1), isMic ? 100 : 3000)
        return () => clearInterval(id)
    }, [item?.conditions?.showItem, isMic])

    const showItemState = item?.conditions?.showItem ? isConditionMet(item.conditions.showItem, getItemText(item as Item), "default", conditionsUpdater) : false

    const hasGradient = Array.isArray(item?.lines) && item.lines.some((a) => Array.isArray(a.text) && a.text.some((t) => t.style?.includes("-gradient")))

    return (
        <>
            {!hideMovebox ? <Movebox ratio={ratio} itemStyle={item?.style} active={currentActiveEdit.items.includes(index)} onlyCorners={item?.type === "icon" && item?.id !== "empty"} /> : null}

            <div className={`actions ${styles.actions}`}>
                {item?.language ? (
                    <div data-title={isoLanguages.find((a) => a.code === item.language)?.name || item.language} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="translate" white />
                        </span>
                    </div>
                ) : null}

                {textTransform ? (
                    <div data-title={translateText("edit.text_transform")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="capitalize" white />
                        </span>
                    </div>
                ) : null}

                {item?.list?.enabled ? (
                    <div data-title={translateText("edit.list")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="list" white />
                        </span>
                    </div>
                ) : null}

                {item?.scrolling?.type && item.scrolling.type !== "none" ? (
                    <div data-title={translateText("edit.scrolling")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="scrolling" white />
                        </span>
                    </div>
                ) : null}

                {item?.button?.press || item?.button?.release ? (
                    <div data-title={translateText("popup.action")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="button" white />
                        </span>
                    </div>
                ) : null}

                {item?.bindings?.length ? (
                    <div data-title={translateText("actions.remove_binding")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <Button align="start" onClick={() => removeBindings()} redHover>
                            <Icon id="bind" white />
                        </Button>
                        {item.bindings.length > 1 ? <span className={styles.actionValue}>{item.bindings.length}</span> : <span className={styles.actionValue}>{item.bindings[0] === "stage" ? <T id="menu.stage" /> : currentOutputs[item.bindings[0]]?.name}</span>}
                    </div>
                ) : null}

                {Object.values(item?.conditions || {}).length ? (
                    <div data-title={translateText("actions.conditions")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset", backgroundColor: `var(--${showItemState ? "" : "dis"}connected)` } as React.CSSProperties}>
                        <Button align="start" onClick={() => removeItemValue("conditions")} redHover>
                            <Icon id="light" white />
                        </Button>
                    </div>
                ) : null}

                {actions.map((action) => {
                    const actionValue = item ? (action.direct ? (item as unknown as Record<string, unknown>)[action.id] : item.actions?.[action.id as keyof typeof item.actions]) : null
                    if (!actionValue) return null
                    return (
                        <div key={action.id} data-title={action ? translateText(action.label) : ""} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                            <Button align="start" onClick={() => (action.direct ? removeItemValue(action.id) : removeAction(action.id))} redHover>
                                <Icon id={action.icon} white />
                            </Button>
                            {typeof actionValue === "number" ? <span className={styles.actionValue}>{actionValue}s</span> : null}
                        </div>
                    )
                })}

                {hasGradient ? (
                    <div data-title={translateText("popup.color_gradient")} className={`actionButton ${styles.actionButton}`} style={{ zoom: 1 / ratio, left: 0, right: "unset" } as React.CSSProperties}>
                        <span style={{ padding: 5, zIndex: 3, fontSize: 0 }}>
                            <Icon id="color" white />
                        </span>
                    </div>
                ) : null}
            </div>
        </>
    )
}
