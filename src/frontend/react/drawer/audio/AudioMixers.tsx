import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { audioRouting, outputs } from "../../../shared/core/stores"
import { keysToID } from "../../../components/helpers/array"
import { translateText } from "../../../utils/language"
import { useStore } from "../../hooks/useStore"
import { AudioChannelMixer } from "./AudioChannelMixer"
import styles from "./AudioMixers.module.css"

// Port de components/drawer/audio/AudioMixers.svelte.
export function AudioMixers() {
    const routing = useStore(audioRouting)
    const outputsValue = useStore(outputs)

    const sortedConfig = AudioRoutingManager.sortChannels(routing || { channels: [{ id: "main", name: translateText("audio.main") }], connections: [] })
    const channels = sortedConfig.channels
    const inactiveOutputIds = keysToID(outputsValue).filter((a) => !a.enabled)

    return (
        <div className={styles.mixers}>
            {channels.map((channel) => {
                const disabledOutput = inactiveOutputIds.some((a) => `channel_${a.id}` === channel.id)
                // Ya no hace falta deshabilitar canales sin conexiones: ahora se pueden grabar.
                if (disabledOutput) return null
                return <AudioChannelMixer key={channel.id} channelId={channel.id} label={channel.name || ""} color={channel.color} />
            })}
        </div>
    )
}
