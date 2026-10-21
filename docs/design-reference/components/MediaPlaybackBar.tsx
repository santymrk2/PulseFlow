// ----- FreeShow -----
// Barra de reproducción del medio proyectado: play/pausa, progreso (seek),
// volumen y silencio. Sólo aparece cuando hay un medio activo.

import { Pause, Play, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useProjectionStore } from "@/store/useProjectionStore"

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, "0")}`
}

export default function MediaPlaybackBar() {
    const media = useProjectionStore((s) => s.media)
    const playback = useProjectionStore((s) => s.mediaPlayback)
    const setMediaPlayback = useProjectionStore((s) => s.setMediaPlayback)

    if (!media) return null

    const duration = playback.duration || 0
    const isVideo = media.kind === "video"

    return (
        <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-4 py-2">
            <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-zinc-200 hover:text-white"
                disabled={!isVideo}
                title={playback.playing ? "Pausar" : "Reproducir"}
                onClick={() => setMediaPlayback({ playing: !playback.playing })}
            >
                {playback.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>

            <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400">
                {formatTime(playback.currentTime)}
            </span>

            <Slider
                className="flex-1"
                min={0}
                max={Math.max(duration, 1)}
                step={0.1}
                value={[Math.min(playback.currentTime, Math.max(duration, 1))]}
                disabled={!isVideo || duration === 0}
                onValueChange={([value]) => setMediaPlayback({ currentTime: value })}
            />

            <span className="w-11 shrink-0 font-mono text-[11px] tabular-nums text-zinc-400">
                {formatTime(duration)}
            </span>

            <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-zinc-300 hover:text-white"
                title="Silenciar"
                onClick={() => setMediaPlayback({ muted: !playback.muted })}
            >
                {playback.muted || playback.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            <Slider
                className="w-24 shrink-0"
                min={0}
                max={1}
                step={0.01}
                value={[playback.muted ? 0 : playback.volume]}
                onValueChange={([value]) => setMediaPlayback({ volume: value, muted: value === 0 })}
            />

            <span className="max-w-40 shrink-0 truncate text-xs text-zinc-500" title={media.name}>
                {media.name}
            </span>
        </div>
    )
}
