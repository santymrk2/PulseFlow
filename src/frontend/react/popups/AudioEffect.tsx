import { useEffect, useState, type ComponentType } from "react"
import { get } from "../../lib/store"
import type { EffectType } from "../../audio/effects/audioEffectsHelpers"
import { activeAudioEffects, popupData } from "../../stores"
import { useStore } from "../hooks/useStore"
import { AudioCompressor } from "../drawer/audio/effects/AudioCompressor"
import { AudioDelay, type AudioEffectProps } from "../drawer/audio/effects/AudioDelay"
import { AudioEffectPresets } from "../drawer/audio/effects/AudioEffectPresets"
import { AudioEqualizer } from "../drawer/audio/effects/AudioEqualizer"
import { AudioFilter } from "../drawer/audio/effects/AudioFilter"
import { AudioLimiter } from "../drawer/audio/effects/AudioLimiter"
import { AudioNoiseGate } from "../drawer/audio/effects/AudioNoiseGate"
import { AudioReverb } from "../drawer/audio/effects/AudioReverb"
import { AudioStereoShaper } from "../drawer/audio/effects/AudioStereoShaper"
import { Button } from "../ui/button/Button"

// Port de components/main/popups/AudioEffect.svelte. Lee: popupData { channelId, effect, effectId } (al montar) y activeAudioEffects.
// Escribe: activeAudioEffects = channelId. Los efectos y los presets ya son componentes React (F24.17d).
const EFFECT_COMPONENTS: Partial<Record<EffectType, ComponentType<AudioEffectProps>>> = {
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

    const Effect = EFFECT_COMPONENTS[effectKey]

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            <div style={{ display: "flex", flexDirection: "column", width: "calc(100vw - (var(--navigation-width) + 20px) * 2)" }}>
                {showMore ? (
                    <div style={{ marginBottom: "10px" }}>
                        <AudioEffectPresets effectKey={effectKey} channelId={channelId} effectId={effectId} />
                    </div>
                ) : null}

                {Effect ? <Effect key={`${channelId}_${effectId || effectKey}`} effectId={effectId} channelId={channelId} /> : null}
            </div>
        </>
    )
}
