import { useStore } from "../../../shared/ui/hooks/useStore"
import { dictionary, effects, outputs } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { Button } from "../../../shared/ui/kit/button/Button"
import styles from "./EffectIcons.module.css"

// Port de components/drawer/effects/EffectIcons.svelte: iconos de las acciones del efecto sobre la tarjeta.
export interface EffectIconsProps {
    columns: number
    effectId?: string
}

interface EffectIconsData {
    displayDuration?: number
    bindings?: string[]
    placeUnderSlide?: boolean
}

interface EffectIconAction {
    id: keyof EffectIconsData
    title: string
    icon: string
}

export function EffectIcons({ columns, effectId = "" }: EffectIconsProps) {
    const effectsValue = useStore(effects)
    const outputsValue = useStore(outputs)
    const dict = useStore(dictionary)

    const effect = (effectsValue[effectId] || {}) as EffectIconsData
    const zoom = 5 / columns

    const actionsList: EffectIconAction[] = [
        { id: "displayDuration", title: translateText("popup.display_duration"), icon: "clock" },
        { id: "bindings", title: translateText("actions.specific_outputs"), icon: "bind" },
        { id: "placeUnderSlide", title: translateText("context.place_under_slide"), icon: "under" }
    ]

    function changeAction(actionId: keyof EffectIconsData) {
        // no actualizar hasta que el click de mostrar overlay haya terminado
        setTimeout(() => {
            effects.update((a) => {
                delete (a[effectId] as unknown as Record<string, unknown>)[actionId]
                return a
            })
        })
    }

    return (
        <div className={styles.icons} style={{ zoom }}>
            {actionsList.map((action) => {
                const visible = action.id === "bindings" ? effect.bindings?.length : effect[action.id]
                if (!visible) return null

                return (
                    <div key={action.id}>
                        <div className="button white">
                            <Button align="start" style={{ padding: "3px" }} redHover title={`${translateText("actions.remove", dict)}: ${action.title}`} onClick={() => changeAction(action.id)}>
                                <Icon id={action.icon} size={0.9} white />
                            </Button>
                        </div>

                        {action.id === "displayDuration" && !isNaN(effect.displayDuration || 0) ? (
                            <span>
                                <p>{effect.displayDuration || 0}s</p>
                            </span>
                        ) : action.id === "bindings" && effect.bindings ? (
                            <span>
                                <p>{effect.bindings.length > 1 ? effect.bindings.length : outputsValue[effect.bindings[0]]?.name || ""}</p>
                            </span>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
