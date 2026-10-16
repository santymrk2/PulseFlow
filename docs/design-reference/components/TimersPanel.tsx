// ----- FreeShow -----
// Panel de temporizadores: gestiona definiciones y controla el activo.
// Réplica del drawer de timers de FreeShow (`Timers.svelte`).

import { useState } from "react"
import { Pause, Play, Plus, RotateCcw, Square, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { computeTimer, formatTimer, type TimerMode } from "@/lib/timers"
import { useNow } from "@/hooks/useNow"
import { useProjectionStore } from "@/store/useProjectionStore"
import { useTimersStore } from "@/store/useTimersStore"

export default function TimersPanel() {
    const timers = useTimersStore((s) => s.timers)
    const addTimer = useTimersStore((s) => s.addTimer)
    const start = useTimersStore((s) => s.start)
    const pause = useTimersStore((s) => s.pause)
    const resume = useTimersStore((s) => s.resume)
    const reset = useTimersStore((s) => s.reset)
    const stop = useTimersStore((s) => s.stop)
    const deleteTimer = useTimersStore((s) => s.deleteTimer)

    const active = useProjectionStore((s) => s.timer)
    const now = useNow(500)

    const [name, setName] = useState("")
    const [type, setType] = useState<TimerMode>("countdown")
    const [duration, setDuration] = useState(300)

    const activeDisplay = active ? computeTimer(active, now) : null

    function handleAdd() {
        if (!name.trim()) return
        addTimer({ name: name.trim(), type, duration })
        setName("")
        setDuration(300)
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Temporizadores</div>

            {active && activeDisplay && (
                <div
                    className={
                        "flex flex-col gap-2 rounded-md border px-3 py-2 " +
                        (activeDisplay.overtime
                            ? "border-red-500/50 bg-red-500/10"
                            : "border-zinc-700 bg-zinc-800/60")
                    }
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300">{active.label}</span>
                        <span
                            className={
                                "font-mono text-2xl font-bold tabular-nums " +
                                (activeDisplay.overtime ? "text-red-400" : "text-white")
                            }
                        >
                            {activeDisplay.text}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-300 hover:text-white"
                            onClick={() => (active.paused ? resume() : pause())}
                        >
                            {active.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-300 hover:text-white"
                            onClick={reset}
                        >
                            <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-zinc-500 hover:text-red-400"
                            onClick={stop}
                        >
                            <Square className="size-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                {Object.entries(timers).map(([id, timer]) => (
                    <div
                        key={id}
                        className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1"
                    >
                        <button
                            type="button"
                            className="flex flex-1 items-center gap-2 text-left"
                            onClick={() => (active?.id === id ? (active.paused ? resume() : pause()) : start(id))}
                        >
                            {active?.id === id && !active.paused ? (
                                <Pause className="size-3 text-zinc-400" />
                            ) : (
                                <Play className="size-3 text-zinc-400" />
                            )}
                            <span className="text-xs text-zinc-200">{timer.name}</span>
                            <span className="ml-auto font-mono text-[11px] text-zinc-500">
                                {timer.type === "clock" ? "reloj" : formatTimer(timer.duration)}
                            </span>
                        </button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-zinc-600 hover:text-red-400"
                            onClick={() => deleteTimer(id)}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
                {Object.keys(timers).length === 0 && (
                    <p className="py-1 text-center text-xs text-zinc-600">Sin temporizadores.</p>
                )}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nombre…"
                    className="h-7 text-xs"
                />
                <div className="flex gap-1.5">
                    <Select value={type} onValueChange={(value) => setType(value as TimerMode)}>
                        <SelectTrigger className="h-7 flex-1 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="countdown">Cuenta atrás</SelectItem>
                            <SelectItem value="elapsed">Cronómetro</SelectItem>
                            <SelectItem value="clock">Reloj</SelectItem>
                            <SelectItem value="event">Evento</SelectItem>
                        </SelectContent>
                    </Select>
                    {type !== "clock" && (
                        <Input
                            type="number"
                            min={0}
                            value={duration}
                            onChange={(event) => setDuration(Number(event.target.value) || 0)}
                            className="h-7 w-20 text-xs"
                            title="Duración (segundos)"
                        />
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-zinc-400 hover:text-zinc-100"
                        onClick={handleAdd}
                    >
                        <Plus className="size-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
