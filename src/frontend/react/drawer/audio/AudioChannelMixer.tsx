import type { CSSProperties, FormEvent } from "react"
import { toggleChannelRecording } from "../../../audio/audioChannelRecorder"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { dbToGain, gainToDb, gainToSlider, MAX_DB, MIN_DB, sliderToGain } from "../../../audio/dBUtils"
import { activeAudioEffects, audioChannelsData, recordingChannels } from "../../../shared/core/stores"
import { Button } from "../../ui/button/Button"
import { Slider } from "../../ui/slider/Slider"
import { Stepper } from "../../ui/stepper/Stepper"
import { useStore } from "../../hooks/useStore"
import { AudioMeter } from "./AudioMeter"
import { cn } from "../../../shared/core/lib/utils"
import styles from "./AudioChannelMixer.module.css"

// Port de components/drawer/audio/AudioChannelMixer.svelte.
export interface AudioChannelMixerProps {
    channelId: string
    label: string
    color?: string
    inactive?: boolean
}

const ALLOW_GAINING = true

export function AudioChannelMixer({ channelId, label, color, inactive = false }: AudioChannelMixerProps) {
    const channelsData = useStore(audioChannelsData)
    const recording = useStore(recordingChannels)

    const channelData = channelsData[channelId] || {}

    function updateData(key: string, value: unknown) {
        audioChannelsData.update((a) => ({ ...a, [channelId]: { ...a[channelId], [key]: value } }))
        AudioPlayer.updateVolume()
    }

    function setVolumeFromSlider(event: FormEvent<HTMLInputElement>) {
        const sliderPos = Number(event.currentTarget.value)
        let gain = sliderToGain(sliderPos)
        // Snap to unity (0 dB / 1.0 gain) near 0.8 position
        if (sliderPos >= 0.78 && sliderPos <= 0.82) gain = 1.0
        updateData("volume", gain)
    }

    function setVolumeFromDb(value: string) {
        const db = Number(value)
        updateData("volume", dbToGain(Number.isNaN(db) ? 0 : db))
    }

    const rawVolume = Number(channelData.volume ?? 1)
    const volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
    const sliderPosition = gainToSlider(volumeValue)
    const dbValue = Math.max(MIN_DB, Math.min(MAX_DB, gainToDb(volumeValue)))
    const muted = !!channelData.isMuted
    const isRecording = !!recording[channelId]

    const outputStyle = { "--color": color || "var(--secondary)" } as CSSProperties

    return (
        <section className={cn(styles.mixer, "context #audio_channel_mixer")} id={channelId}>
            <div className={`${styles.output} ${inactive ? styles.inactive : ""}`} style={outputStyle}>
                <div className={styles.label} style={{ marginRight: 7 }}>
                    <p style={{ opacity: 0.9 }}>{label || ""}</p>
                    <Slider value={sliderPosition} step={0.005} max={ALLOW_GAINING ? 1 : 0.8} onInput={setVolumeFromSlider} />
                </div>

                <div className={styles.input} style={{ position: "relative" }}>
                    <Stepper style={{ width: 65 }} value={dbValue} decimals={1} fixed={1} min={MIN_DB} max={ALLOW_GAINING ? 6 : 0} step={0.5} onChange={setVolumeFromDb} buttons={false} />
                    <span style={{ position: "absolute", right: 0, bottom: 5, transform: "translateX(-5px)", pointerEvents: "none", color: "var(--color)", fontWeight: "bold", fontSize: "0.7em" }}>dB</span>
                </div>

                <Button variant="outline" style={{ padding: 8 }} icon={muted ? "muted" : "volume"} title={`actions.${muted ? "unmute" : "mute"}`} red={muted} onClick={() => updateData("isMuted", !muted)} />
                <Button variant="outline" style={{ padding: 8 }} icon={isRecording ? "stop" : "record"} title={`actions.${isRecording ? "stop_recording" : "start_recording"}`} red={isRecording} onClick={() => toggleChannelRecording(channelId, label)} />
                <Button variant="outline" style={{ padding: 8 }} icon="equalizer" title="tabs.effects" onClick={() => activeAudioEffects.set(channelId)} />
            </div>

            {!inactive ? <AudioMeter channelId={channelId} detailed /> : null}
        </section>
    )
}
