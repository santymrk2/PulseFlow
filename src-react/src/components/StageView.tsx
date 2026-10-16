// ----- FreeShow -----
// Vista de Stage (ventana de retorno para músicos y operadores).
//
// Optimizada para alto contraste y lectura a distancia: reloj, temporizador,
// texto actual, referencia, siguiente diapositiva y las notas del operador.

import { useEffect, useMemo, useState } from "react"
import { Minus, Music, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import ChordLyrics from "@/components/ChordLyrics"
import TimerDisplay from "@/components/TimerDisplay"
import { useProjectionListener } from "@/hooks/useProjectionSync"
import { useProjectionStore } from "@/store/useProjectionStore"
import { useShowStore } from "@/store/useShowStore"
import { cn } from "@/lib/utils"
import type { ChordLine } from "@/lib/chordpro"

function useClock() {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return now
}

function formatClock(date: Date) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

export default function StageView({ embedded = false }: { embedded?: boolean }) {
    useProjectionListener(!embedded)

    const richText = useProjectionStore((s) => s.richText)
    const text = useProjectionStore((s) => s.text)
    const subtext = useProjectionStore((s) => s.subtext)
    const nextText = useProjectionStore((s) => s.nextText)
    const notes = useProjectionStore((s) => s.notes)
    const visible = useProjectionStore((s) => s.visible)

    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const [showChords, setShowChords] = useState(true)
    const [transpose, setTranspose] = useState(0)

    const chordLines = useMemo<ChordLine[]>(() => {
        const slide = selectedSlideId && show?.slides ? show.slides[selectedSlideId] : undefined
        if (!slide?.items) return []
        const lines: ChordLine[] = []
        for (const item of slide.items) {
            for (const line of item.lines ?? []) {
                const text = line.text.map((segment) => segment.value).join("")
                lines.push({ text, chords: line.chords ?? [] })
            }
        }
        return lines
    }, [show, selectedSlideId])

    const hasChords = chordLines.some((line) => line.chords.length > 0)

    const now = useClock()
    const currentText = useMemo(() => {
        if (richText) return richText.lines.map((line) => line.text).join("\n")
        return text
    }, [richText, text])

    return (
        <div
            className={cn(
                "flex flex-col overflow-hidden bg-black text-white",
                embedded ? "h-full w-full" : "h-screen w-screen"
            )}
        >
            <header
                {...(embedded ? {} : { "data-tauri-drag-region": true })}
                className="flex items-center justify-between border-b border-zinc-800 px-6 py-3"
            >
                <span className="font-mono text-4xl font-bold tabular-nums tracking-tight">{formatClock(now)}</span>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-1.5 py-1">
                        <Button
                            variant={showChords ? "secondary" : "ghost"}
                            size="icon-sm"
                            title="Mostrar/ocultar acordes"
                            onClick={() => setShowChords((value) => !value)}
                        >
                            <Music className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-300"
                            title="Bajar un semitono"
                            onClick={() => setTranspose((value) => value - 1)}
                        >
                            <Minus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center font-mono text-sm tabular-nums text-zinc-300">
                            {transpose > 0 ? `+${transpose}` : transpose}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-300"
                            title="Subir un semitono"
                            onClick={() => setTranspose((value) => value + 1)}
                        >
                            <Plus className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-500"
                            title="Tono original"
                            onClick={() => setTranspose(0)}
                        >
                            <RotateCcw className="size-3.5" />
                        </Button>
                    </div>

                    <TimerDisplay />
                </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-2">
                {/* Texto actual */}
                <section className="flex min-h-0 flex-col border-r border-zinc-800 p-6">
                    <div className="mb-3 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                        Actual
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {showChords && hasChords ? (
                            <ChordLyrics
                                lines={chordLines}
                                semitones={transpose}
                                className="font-sans text-[2vw] leading-snug font-semibold text-white"
                            />
                        ) : visible && currentText ? (
                            <p className="text-[2.6vw] leading-snug font-semibold whitespace-pre-wrap text-white">
                                {currentText}
                            </p>
                        ) : (
                            <p className="text-2xl text-zinc-600">— Sin proyección —</p>
                        )}
                        {subtext && <p className="mt-3 text-xl font-medium text-amber-400">{subtext}</p>}
                    </div>
                </section>

                {/* Siguiente + notas */}
                <section className="flex min-h-0 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col border-b border-zinc-800 p-6">
                        <div className="mb-3 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                            Siguiente
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {nextText ? (
                                <p className="text-[1.9vw] leading-snug whitespace-pre-wrap text-emerald-300">
                                    {nextText}
                                </p>
                            ) : (
                                <p className="text-lg text-zinc-700">—</p>
                            )}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col p-6">
                        <div className="mb-3 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                            Notas
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <p className={cn("text-lg leading-relaxed whitespace-pre-wrap", notes ? "text-zinc-300" : "text-zinc-700")}>
                                {notes || "Sin notas"}
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
