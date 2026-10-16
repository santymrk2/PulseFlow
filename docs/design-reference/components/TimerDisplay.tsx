// ----- FreeShow -----
// Muestra el temporizador activo (sólo lectura). Se usa en la pantalla de
// Audiencia y en la vista de Stage; el control vive en la ventana principal.

import { computeTimer } from "@/lib/timers"
import { useNow } from "@/hooks/useNow"
import { useProjectionStore } from "@/store/useProjectionStore"
import { cn } from "@/lib/utils"

export default function TimerDisplay({ className }: { className?: string }) {
    const timer = useProjectionStore((s) => s.timer)
    const now = useNow(250)

    if (!timer || !timer.visible) return null

    const display = computeTimer(timer, now)

    return (
        <div className={cn("flex flex-col items-end", className)}>
            {timer.label && <span className="text-xs font-medium text-zinc-400">{timer.label}</span>}
            <span
                className={cn(
                    "font-mono text-3xl font-bold tabular-nums",
                    display.overtime ? "text-red-400" : "text-white"
                )}
            >
                {display.text}
            </span>
        </div>
    )
}
