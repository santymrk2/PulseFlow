import type { Scene } from "../../../../types/Show"
import { actions, activeProfile, outputs, profiles, scenes } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { history } from "../../../components/helpers/history"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import styles from "./SceneActions.module.css"

// Port de components/drawer/pages/SceneActions.svelte: iconos superpuestos en la tarjeta de escena.
// `on:click={(e) => setTimeout(() => removeCustomAction(e))}`: el `preventDefault` dentro del timeout no tenía efecto y se omite.
export interface SceneActionsProps {
    columns: number
    sceneId?: string
}

export function SceneActions({ columns, sceneId = "" }: SceneActionsProps) {
    const scenesValue = useStore(scenes)
    const actionsValue = useStore(actions)
    const outputsValue = useStore(outputs)
    const activeProfileValue = useStore(activeProfile)
    useStore(profiles)

    const scene: Scene | undefined = scenesValue[sceneId]
    const zoom = 5 / columns

    const profile = activeProfileValue ? (getAccess("scenes") as Record<string, string | undefined>) : {}
    const readOnly = profile.global === "read" || profile[sceneId] === "read"

    function removeCustomAction() {
        if (readOnly) return
        const newData = { key: "action", data: "" }
        setTimeout(() => {
            history({ id: "UPDATE", newData, oldData: { id: sceneId }, location: { page: "drawer", id: "scene_key", override: `action_${sceneId}` } })
        })
    }

    function removeBindings() {
        if (readOnly) return
        const newData = { key: "bindings", data: [] }
        setTimeout(() => {
            history({ id: "UPDATE", newData, oldData: { id: sceneId }, location: { page: "drawer", id: "scene_key", override: `bindings_${sceneId}` } })
        })
    }

    const act = scene?.action ? actionsValue[scene.action] : undefined

    return (
        <div className={styles.icons} style={{ zoom }}>
            {act ? (
                <div className={`${styles.button} ${styles.whiteButton}`}>
                    <Button align="start" style={{ padding: "3px" }} redHover title={`${translateText("actions.remove")}: <b>${act.name}</b>`} onClick={() => setTimeout(() => removeCustomAction())}>
                        <Icon id="actions" size={0.9} white />
                        <p>{act.name}</p>
                    </Button>
                </div>
            ) : null}

            {scene?.bindings?.length ? (
                <div>
                    <div className={`${styles.button} ${styles.whiteButton}`}>
                        <Button align="start" style={{ padding: "3px" }} redHover title={translateText("actions.remove_binding")} onClick={() => setTimeout(() => removeBindings())}>
                            <Icon id="bind" size={0.9} white />
                        </Button>
                    </div>
                    {scene.bindings.length > 1 ? (
                        <span>
                            <p>{scene.bindings.length}</p>
                        </span>
                    ) : (
                        <span>
                            <p>{outputsValue[scene.bindings[0]]?.name || ""}</p>
                        </span>
                    )}
                </div>
            ) : null}
        </div>
    )
}
