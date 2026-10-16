// ----- FreeShow -----
// Mezclador de canales de audio: volumen, mute, retardo y fundido por canal.
// El canal "Media" afecta directamente a la reproducción proyectada.

import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AUDIO_CHANNELS, formatDb } from "@/lib/audio"
import { useAudioStore } from "@/store/useAudioStore"

export default function AudioMixerPanel() {
    const channels = useAudioStore((s) => s.channels)
    const setVolume = useAudioStore((s) => s.setVolume)
    const toggleMute = useAudioStore((s) => s.toggleMute)
    const updateChannel = useAudioStore((s) => s.updateChannel)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Mezclador de audio</div>

            <div className="flex flex-col gap-2">
                {AUDIO_CHANNELS.map((channel) => {
                    const data = channels[channel.id] ?? {}
                    const volume = data.volume ?? 100
                    const muted = !!data.isMuted
                    return (
                        <div
                            key={channel.id}
                            className={`flex flex-col gap-1.5 rounded-md border p-2 ${
                                muted ? "border-zinc-800/60 bg-zinc-900/20" : "border-zinc-800 bg-zinc-900/40"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`size-7 shrink-0 ${muted ? "text-red-400" : "text-zinc-400"}`}
                                    title={muted ? "Activar" : "Silenciar"}
                                    onClick={() => toggleMute(channel.id)}
                                >
                                    {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                                </Button>
                                <span className="flex-1 text-xs text-zinc-300">{channel.name}</span>
                                <span className="text-[10px] tabular-nums text-zinc-500">{formatDb(muted ? 0 : volume)}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={muted ? 0 : volume}
                                disabled={muted}
                                onChange={(event) => setVolume(channel.id, Number(event.target.value))}
                                className="h-1 accent-indigo-500 disabled:opacity-40"
                            />
                            <div className="flex items-center gap-2">
                                <label className="flex flex-1 items-center gap-1.5 text-[10px] text-zinc-500">
                                    <span className="shrink-0">Retardo</span>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={data.delay ?? 0}
                                        onChange={(event) => updateChannel(channel.id, { delay: Number(event.target.value) })}
                                        className="h-6 text-xs"
                                    />
                                    <span>ms</span>
                                </label>
                                <label className="flex flex-1 items-center gap-1.5 text-[10px] text-zinc-500">
                                    <span className="shrink-0">Fundido</span>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={data.fadeDuration ?? 0}
                                        onChange={(event) =>
                                            updateChannel(channel.id, { fadeDuration: Number(event.target.value) })
                                        }
                                        className="h-6 text-xs"
                                    />
                                    <span>ms</span>
                                </label>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
