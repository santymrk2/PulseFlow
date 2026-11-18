import { useState } from "react"
import { get } from "../../lib/store"
import { addEffectToStack, EFFECTS_LIST, type EffectType } from "../../audio/effects/audioEffectsHelpers"
import { activeAudioEffects, activePopup, popupData } from "../../stores"
import { translateText } from "../../utils/language"
import { Button } from "../ui/button/Button"

// Port de components/main/popups/AddAudioEffect.svelte. Lee: popupData.channelId (si no, activeAudioEffects, si no "main").
// Escribe: popupData = { channelId, effectId, effect } y activePopup = "audio_effect".
export function AddAudioEffect() {
    // el canal se lee al montar, como el `let` del Svelte
    const [channelId] = useState(() => get(popupData)?.channelId || get(activeAudioEffects) || "main")

    function selectEffect(effectKey: EffectType) {
        const newInstance = addEffectToStack(effectKey, channelId)
        popupData.set({ channelId, effectId: newInstance.id, effect: effectKey })
        activePopup.set("audio_effect")
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {EFFECTS_LIST.map((eff) => (
                <Button key={eff.id} variant="outline" style={{ borderLeft: `4px solid ${eff.color}`, padding: "8px 12px", fontWeight: "normal", fontSize: "0.75em", justifyContent: "left" }} title={eff.description} onClick={() => selectEffect(eff.id)}>
                    {translateText(eff.label)}
                </Button>
            ))}
        </div>
    )
}
