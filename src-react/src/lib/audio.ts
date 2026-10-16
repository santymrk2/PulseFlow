// ----- FreeShow -----
// Canales de audio (subconjunto de `types/Audio.ts`) y utilidades de mezcla.

export interface AudioChannelData {
    volume?: number
    isMuted?: boolean
    /** Retardo en ms. */
    delay?: number
    /** Duración de fundido en ms. */
    fadeDuration?: number
}

export type AudioChannels = Record<string, AudioChannelData>

export interface AudioChannelDefinition {
    id: string
    name: string
    /** Si es `true`, el canal controla la reproducción de media proyectada. */
    media?: boolean
}

export const AUDIO_CHANNELS: AudioChannelDefinition[] = [
    { id: "media", name: "Media", media: true },
    { id: "music", name: "Música" },
    { id: "output", name: "Salida" },
    { id: "mic", name: "Micrófono" },
]

export const DEFAULT_AUDIO_CHANNELS: AudioChannels = {
    media: { volume: 100, isMuted: false, delay: 0, fadeDuration: 0 },
    music: { volume: 100, isMuted: false, delay: 0, fadeDuration: 500 },
    output: { volume: 100, isMuted: false },
    mic: { volume: 100, isMuted: true, delay: 0 },
}

export function formatDb(volume: number): string {
    if (volume <= 0) return "-∞ dB"
    const db = 20 * Math.log10(volume / 100)
    return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`
}
