// ----- FreeShow -----
// Store de canales de audio, persistidos en `SYNCED_SETTINGS.audioChannelsData`.
// El canal "media" controla además el volumen/mute de la media proyectada.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_AUDIO_CHANNELS, type AudioChannels } from "@/lib/audio"
import { useProjectionStore } from "@/store/useProjectionStore"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "audioChannelsData"

interface AudioState {
    channels: AudioChannels
    hydrate: () => Promise<void>
    updateChannel: (id: string, patch: Partial<AudioChannels[string]>) => void
    setVolume: (id: string, volume: number) => void
    toggleMute: (id: string) => void
}

function persist(channels: AudioChannels) {
    void setStoreValue(STORE_FILE, STORE_KEY, channels).catch(() => undefined)
}

export const useAudioStore = create<AudioState>((set, get) => ({
    channels: JSON.parse(JSON.stringify(DEFAULT_AUDIO_CHANNELS)) as AudioChannels,

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as AudioChannels | null
            if (value && typeof value === "object") set({ channels: { ...get().channels, ...value } })
        } catch {
            // Se mantienen los canales por defecto.
        }
    },

    updateChannel: (id, patch) => {
        const channels = get().channels
        if (!channels[id]) return
        const next = { ...channels, [id]: { ...channels[id], ...patch } }
        set({ channels: next })
        persist(next)

        if (id === "media") {
            const volume = (next.media.volume ?? 100) / 100
            useProjectionStore.getState().setMediaPlayback({ volume, muted: !!next.media.isMuted })
        }
    },

    setVolume: (id, volume) => get().updateChannel(id, { volume: Math.max(0, Math.min(100, volume)) }),
    toggleMute: (id) => get().updateChannel(id, { isMuted: !get().channels[id]?.isMuted }),
}))
