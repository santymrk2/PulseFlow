import type { CSSProperties, MouseEvent } from "react"
import { EFFECTS_LIST, getEffectStack, moveEffectInStack, toggleEffectInStack } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { activeAudioEffects, activePopup, audioEffects, popupData } from "../../../../shared/core/stores"
import { translateText } from "../../../../shared/utils/language"
import { useStore } from "../../../../shared/ui/hooks/useStore"
import { Icon } from "../../../../shared/ui/helpers/Icon"
import { T } from "../../../../shared/ui/helpers/T"
import { Button } from "../../../../shared/ui/kit/button/Button"
import { Center } from "../../../../shared/ui/system/Center"
import styles from "./AudioEffects.module.css"

// Port de components/drawer/audio/AudioEffects.svelte.
interface StackItem {
    id: string
    type: string
    enabled?: boolean
}

const FALLBACK_META = { label: "", color: "var(--secondary)" }

export function AudioEffects() {
    const currentChannel = useStore(activeAudioEffects)
    const allEffects = useStore(audioEffects)
    const channelId = currentChannel || "main"
    const stack = getEffectStack(allEffects, channelId) as StackItem[]

    function openEffectPopup(item: StackItem) {
        popupData.set({ channelId, effectId: item.id, effect: item.type })
        activePopup.set("audio_effect")
    }

    function openAddPopup() {
        popupData.set({ channelId })
        activePopup.set("add_audio_effect")
    }

    // Evita que el click en los controles abra el popup del efecto.
    function stopPropagation(event: MouseEvent<HTMLDivElement>) {
        event.stopPropagation()
    }

    return (
        <>
            <Button onClick={() => activeAudioEffects.set("")}>
                <Icon id="back" right />
                <T id="actions.back" />
            </Button>

            <div className={styles.stackList}>
                {stack.map((item, index) => {
                    const meta = EFFECTS_LIST.find((effect) => effect.id === item.type) || { ...FALLBACK_META, label: item.type }
                    const isEnabled = item.enabled !== false
                    const cardStyle = { "--accent-color": meta.color } as CSSProperties
                    const powerStyle = {
                        padding: "3px",
                        margin: "4px",
                        minHeight: "initial",
                        border: "1px solid var(--primary-lighter)",
                        backgroundColor: `${isEnabled ? "var(--connected)" : "var(--primary-lighter)"} !important`
                    } as CSSProperties

                    return (
                        <div
                            key={item.id || `${item.type}_${index}`}
                            className={`${styles.effectCard} context #audio_effect_item ${isEnabled ? "" : styles.bypassed}`}
                            id={item.id}
                            data-index={index}
                            data-channel={channelId}
                            style={cardStyle}
                            role="button"
                            tabIndex={0}
                            onClick={() => openEffectPopup(item)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") openEffectPopup(item)
                            }}
                        >
                            <div className={styles.effectInfo}>
                                <span className={styles.slotNumber}>{index + 1}</span>
                                <span className={styles.effectName}>{translateText(meta.label)}</span>
                            </div>

                            <div className={styles.effectActions} role="none" onClick={stopPropagation}>
                                <Button disabled={index === stack.length - 1} title="actions.backward" style={{ padding: "6px" }} onClick={() => moveEffectInStack(index, index - 1, channelId)}>
                                    <Icon id="down" size={0.8} white />
                                </Button>
                                <Button disabled={index === 0} title="actions.forward" style={{ padding: "6px" }} onClick={() => moveEffectInStack(index, index + 1, channelId)}>
                                    <Icon id="up" size={0.8} white />
                                </Button>
                                <Button style={powerStyle} title={isEnabled ? "actions.disable" : "actions.enable"} onClick={() => toggleEffectInStack(item.id, channelId)} />
                            </div>
                        </div>
                    )
                })}

                {stack.length === 0 ? (
                    <Center padding={10} faded>
                        <T id="empty.general" />
                    </Center>
                ) : null}
            </div>

            <div className={styles.addSection}>
                <Button variant="outline" style={{ width: "100%", padding: "8px" }} onClick={openAddPopup}>
                    <Icon id="add" size={0.9} />
                    <span>
                        <T id="new.effect" />
                    </span>
                </Button>
            </div>
        </>
    )
}
