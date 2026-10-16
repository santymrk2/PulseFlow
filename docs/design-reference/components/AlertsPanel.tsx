// ----- FreeShow -----
// Panel de alertas: envía un mensaje a pantalla completa a la audiencia.

import { useState } from "react"
import { MessageSquareWarning, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProjectionStore } from "@/store/useProjectionStore"

const PRESETS = ["Bienvenidos", "Silencio, por favor", "5 minutos", "Última canción"]

export default function AlertsPanel() {
    const alert = useProjectionStore((s) => s.alert)
    const setAlert = useProjectionStore((s) => s.setAlert)

    const [text, setText] = useState("")
    const [background, setBackground] = useState("#000000")
    const [color, setColor] = useState("#ffffff")

    function send(value: string) {
        const message = value.trim()
        if (!message) return
        setAlert({ text: message, background, color })
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <MessageSquareWarning className="size-3.5" />
                Alertas
            </div>

            {alert && (
                <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-amber-200">{alert.text}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-amber-300/70 hover:text-amber-100"
                        title="Quitar alerta"
                        onClick={() => setAlert(null)}
                    >
                        <X className="size-3.5" />
                    </Button>
                </div>
            )}

            <div className="flex items-center gap-1.5">
                <Input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Mensaje para el público…"
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key === "Enter") send(text)
                    }}
                />
                <input
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    className="size-7 shrink-0 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                    title="Fondo"
                />
                <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="size-7 shrink-0 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                    title="Texto"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-zinc-400 hover:text-zinc-100"
                    onClick={() => send(text)}
                >
                    <Send className="size-3.5" />
                </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => send(preset)}
                        className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                    >
                        {preset}
                    </button>
                ))}
            </div>
        </div>
    )
}
