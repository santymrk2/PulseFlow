import { useEffect, useState } from "react"
import { get } from "svelte/store"
import type { EffectType } from "../../audio/effects/audioEffectsHelpers"
import AudioCompressor from "../../components/drawer/audio/effects/AudioCompressor.svelte"
import AudioDelay from "../../components/drawer/audio/effects/AudioDelay.svelte"
import AudioEffectPresets from "../../components/drawer/audio/effects/AudioEffectPresets.svelte"
import AudioEqualizer from "../../components/drawer/audio/effects/AudioEqualizer.svelte"
import AudioFilter from "../../components/drawer/audio/effects/AudioFilter.svelte"
import AudioLimiter from "../../components/drawer/audio/effects/AudioLimiter.svelte"
import AudioNoiseGate from "../../components/drawer/audio/effects/AudioNoiseGate.svelte"
import AudioReverb from "../../components/drawer/audio/effects/AudioReverb.svelte"
import AudioStereoShaper from "../../components/drawer/audio/effects/AudioStereoShaper.svelte"
import { activeAudioEffects, popupData } from "../../stores"
import { SvelteIsland } from "../bridge/SvelteIsland"
import { useStore } from "../hooks/useStore"
import { Button } from "../ui/button/Button"

// Port de components/main/popups/AudioEffect.svelte. Lee: popupData { channelId, effect, effectId } (al montar) y activeAudioEffects.
// Escribe: activeAudioEffects = channelId. Los efectos y los presets siguen siendo Svelte (islas).
const EFFECT_COMPONENTS: Partial<Record<EffectType, Parameters<typeof SvelteIsland>[0]["component"]>> = {
    equalizer: AudioEqualizer,
    filter: AudioFilter,
    noiseGate: AudioNoiseGate,
    compressor: AudioCompressor,
    reverb: AudioReverb,
    delay: AudioDelay,
    limiter: AudioLimiter,
    stereoShaper: AudioStereoShaper
}

export function AudioEffect() {
    const [channelId] = useState<string>(() => get(popupData)?.channelId || get(activeAudioEffects) || "main")
    const [effectKey] = useState<EffectType>(() => get(popupData)?.effect || "equalizer")
    const [effectId] = useState<string>(() => get(popupData)?.effectId || "")
    const [showMore, setShowMore] = useState(false)
    const activeChannel = useStore(activeAudioEffects)

    useEffect(() => {
        if (channelId && activeChannel !== channelId) activeAudioEffects.set(channelId)
    }, [channelId, activeChannel])

    const component = EFFECT_COMPONENTS[effectKey]

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            <div style={{ display: "flex", flexDirection: "column", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)" }}>
                {showMore ? (
                    <div style={{ marginBottom: "10px" }}>
                        <SvelteIsland component={AudioEffectPresets} props={{ effectKey, channelId, effectId }} />
                    </div>
                ) : null}

                {component ? <SvelteIsland key={`${channelId}_${effectId || effectKey}`} component={component} props={{ effectId, channelId }} /> : null}
            </div>
        </>
    )
}
