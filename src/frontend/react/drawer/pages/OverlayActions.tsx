import { overlays } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { actionData } from "../../../components/actions/actionData"
import { getActionName, getActionTriggerId } from "../../../components/actions/actions"
import { clone } from "../../../shared/utils/helpers/array"
import { history } from "../../../shared/utils/helpers/history"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import styles from "./OverlayActions.module.css"

// Port de components/drawer/pages/OverlayActions.svelte: iconos de las acciones del overlay.
interface OverlayAction {
    id?: string
    name?: string
    triggers?: string[]
    actionValues?: Record<string, unknown>
}

interface ActionDataEntry {
    name: string
    icon?: string
    red?: boolean
}

const actionDataTable = actionData as unknown as Record<string, ActionDataEntry>

export interface OverlayActionsProps {
    columns: number
    overlayId?: string
}

export function OverlayActions({ columns, overlayId = "" }: OverlayActionsProps) {
    const overlaysValue = useStore(overlays)

    const overlay = overlaysValue[overlayId]
    const overlayRecord = overlay as unknown as Record<string, unknown> | undefined
    const zoom = 5 / columns

    function changeAction(actionId: string) {
        // don't update until overlay display click has finished
        setTimeout(() => {
            // WIP history
            overlays.update((a) => {
                delete (a[overlayId] as unknown as Record<string, unknown>)[actionId]
                a[overlayId].modified = Date.now()
                return a
            })
        })
    }

    const actionsList = [
        { id: "locked", title: translateText("context.lock_to_output"), icon: "locked" },
        { id: "placeUnderSlide", title: translateText("context.place_under_slide"), icon: "under" },
        { id: "displayDuration", title: translateText("popup.display_duration"), icon: "clock" }
    ]

    function removeAction(id: string) {
        const actions = clone((overlay?.actions || []) as OverlayAction[])
        const actionIndex = actions.findIndex((a) => a.id === id || getActionTriggerId(a.triggers?.[0] || "") === id)
        if (actionIndex < 0) return
        actions.splice(actionIndex, 1)

        const newData = { key: "actions", data: actions }
        history({ id: "UPDATE", newData, oldData: { id: overlayId }, location: { page: "drawer", id: "overlay_key", override: `actions_${overlayId}` } })
    }

    const actions = (overlay?.actions || []) as OverlayAction[]

    return (
        <div className={styles.icons} style={{ zoom }}>
            {actions.map((action, index) => {
                // should be always just one trigger on each action when on a slide
                const actionId = getActionTriggerId(action.triggers?.[0] || "")
                const customData = actionDataTable[actionId] || ({} as ActionDataEntry)
                const actionValue = action.actionValues?.[actionId] || action.actionValues?.[String(action.triggers?.[0])] || {}
                const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name) ? action.name : "")

                return (
                    <div key={action.id || actionId || index} className={`${styles.button} ${customData.red ? "" : styles.whiteButton}`}>
                        <Button align="start" style={{ padding: "3px" }} redHover title={`${translateText("actions.remove")}: <b>${translateText(customData.name)}</b>${action.name && action.name !== translateText(customData.name) ? `\n${action.name}` : ""}`} onClick={() => setTimeout(() => removeAction(action.id || actionId))}>
                            {customName ? <p>{customName}</p> : null}
                            <Icon id={customData.icon || "actions"} size={0.9} white />
                        </Button>
                    </div>
                )
            })}

            {actionsList.map((action) => {
                if (!overlayRecord?.[action.id]) return null
                const duration = overlayRecord[action.id]

                return (
                    <div key={action.id}>
                        <div className={`${styles.button} ${styles.whiteButton}`}>
                            <Button align="start" style={{ padding: "3px" }} redHover title={`${translateText("actions.remove")}: ${action.title}`} onClick={() => changeAction(action.id)}>
                                <Icon id={action.icon} size={0.9} white />
                            </Button>
                        </div>
                        {action.id === "displayDuration" && !Number.isNaN(Number(duration || 0)) ? (
                            <span>
                                <p>{String(duration || 0)}s</p>
                            </span>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
