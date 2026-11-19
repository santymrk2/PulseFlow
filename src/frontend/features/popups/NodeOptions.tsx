import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { AudioRoutingConfig, AudioRoutingItem } from "../../../types/AudioRouting"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { AudioPlayer } from "../../audio/audioPlayer"
import { dbToGain, gainToDb, MIN_DB } from "../../audio/dBUtils"
import { audioChannelsData, audioRouting, popupData, special } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"

// Port de components/main/popups/NodeOptions.svelte. Lee popupData al montar (nodeId, type, channels, name) y luego lo vacía.
// Escribe: special.icecast (icecast), audioChannelsData + AudioPlayer.updateVolume() (canal), audioRouting + AudioMicrophone.setChannelCount() (mic).
// Sin islas ni eventos propios: todos los campos son del kit React. Las tres ramas son exclusivas, igual que en el Svelte.
interface PopupInfo {
    nodeId?: string
    type?: string
    channels?: number
    name?: string
}
type FieldValue = string | number | boolean | null

export function NodeOptions() {
    const [popup] = useState<PopupInfo>(() => get(popupData) as PopupInfo)
    const audioRoutingValue = useStore(audioRouting)
    const audioChannelsDataValue = useStore(audioChannelsData)
    const specialValue = useStore(special)

    useEffect(() => {
        popupData.set({})
    }, [])

    const nodeId = popup.nodeId
    const nodeType = popup.type
    const initialChannels = popup.channels

    const channel = audioRoutingValue?.channels?.find((c) => c.id === nodeId)
    const isChannelNode = !!channel || nodeId === "main" || !!nodeId?.startsWith("channel_")
    const isMicNode = nodeType === "mic" || !!nodeId?.startsWith("mic_sub_")
    const deviceId = isMicNode ? (nodeId?.startsWith("mic_sub_") ? nodeId.slice(8) : nodeId || "") : ""
    const configuredItem = audioRoutingValue?.inputs?.find((i) => i.id === nodeId || i.id === deviceId || i.deviceId === deviceId)
    const micChannels = configuredItem?.channels ?? initialChannels ?? 2

    const channelData = audioChannelsDataValue[nodeId || ""] || {}
    const rawVolume = Number(channelData.volume ?? 1)
    const volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume
    const dbValue = Math.max(MIN_DB, Math.min(6, gainToDb(volumeValue)))
    const muted = !!channelData.isMuted
    const fadeDuration = Number(channelData.fadeDuration ?? 250)
    const delayMs = Number(channelData.delay ?? 0)

    function updateIcecast(key: string, value: FieldValue) {
        special.update((a) => {
            if (!a.icecast) a.icecast = {}
            a.icecast[key] = value
            return a
        })
    }

    function updateChannelData(key: string, value: FieldValue) {
        audioChannelsData.update((a) => {
            if (!a[nodeId || ""]) a[nodeId || ""] = {}
            ;(a[nodeId || ""] as unknown as Record<string, FieldValue>)[key] = value
            return a
        })

        AudioPlayer.updateVolume()
    }

    function updateMicChannels(count: number) {
        const val = Math.max(1, Math.min(32, Math.round(count) || 2))
        audioRouting.update((c) => {
            const next: AudioRoutingConfig = c || { channels: [], connections: [] }
            if (!next.inputs) next.inputs = []
            const existing: AudioRoutingItem | undefined = next.inputs.find((i) => i.id === nodeId || i.id === deviceId || i.deviceId === deviceId)
            if (existing) {
                existing.channels = val
            } else {
                next.inputs.push({
                    id: nodeId || "",
                    name: popup.name || "Microphone",
                    type: "mic",
                    deviceId,
                    channels: val
                })
            }
            return { ...next }
        })
        if (deviceId) AudioMicrophone.setChannelCount(deviceId, val)
    }

    if (nodeId === "icecast") {
        return (
            <>
                <ToggleField label="settings.enabled" checked={specialValue.icecast?.enabled ?? true} onChange={(value) => updateIcecast("enabled", value)} />
                <InputRow>
                    <TextField label="IP" value={specialValue.icecast?.host || "localhost"} onChange={(value) => updateIcecast("host", value ?? "")} />
                    <NumberField label="settings.port" value={specialValue.icecast?.port ?? 8000} max={65535} min={1} step={1} onChange={(value) => updateIcecast("port", value ?? 8000)} />
                </InputRow>
                <TextField label="Mountpoint" value={specialValue.icecast?.mount || "/stream.opus"} onChange={(value) => updateIcecast("mount", value ?? "")} />
                <TextField label="remote.password" type="password" value={specialValue.icecast?.password ?? "hackme"} defaultValue="hackme" onChange={(value) => updateIcecast("password", value ?? "")} />
            </>
        )
    }

    if (isChannelNode) {
        return (
            <>
                <InputRow>
                    <NumberField label="media.volume (dB)" value={Number(dbValue.toFixed(1))} min={MIN_DB} max={6} step={0.5} defaultValue={0} onChange={(value) => updateChannelData("volume", dbToGain(value ?? 0))} showSlider />
                    <Button variant="outline" icon={muted ? "muted" : "volume"} title={`actions.${muted ? "unmute" : "mute"}`} onClick={() => updateChannelData("isMuted", !muted)} red={muted} />
                </InputRow>

                <NumberField label="audio.volume_fade_duration (ms)" value={fadeDuration} min={0} max={5000} step={50} defaultValue={250} onChange={(value) => updateChannelData("fadeDuration", value ?? 250)} showSlider />

                <NumberField label="audio.delay (ms)" value={delayMs} min={0} max={5000} step={10} defaultValue={0} onChange={(value) => updateChannelData("delay", value ?? 0)} showSlider />
            </>
        )
    }

    if (isMicNode) {
        return <NumberField label="audio.channels" value={micChannels} min={1} max={32} step={1} defaultValue={2} onChange={(value) => updateMicChannels(value ?? 2)} />
    }

    return null
}
