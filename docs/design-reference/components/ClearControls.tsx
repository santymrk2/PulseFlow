// ----- FreeShow -----
// Controles de limpieza granulares: borrar todo, sólo el texto, el fondo o el
// audio del medio activo, de forma independiente (como en FreeShow).

import { Eraser, Type, VolumeX, Paintbrush } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProjectionStore } from "@/store/useProjectionStore"

export default function ClearControls() {
    const clear = useProjectionStore((s) => s.clear)
    const clearText = useProjectionStore((s) => s.clearText)
    const clearBackground = useProjectionStore((s) => s.clearBackground)
    const clearAudio = useProjectionStore((s) => s.clearAudio)

    return (
        <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <Eraser className="size-3.5" />
                Limpiar
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    title="Limpiar todo"
                    onClick={clear}
                >
                    <Eraser className="size-3.5" />
                    Todo
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-zinc-400"
                    title="Limpiar sólo el texto"
                    onClick={clearText}
                >
                    <Type className="size-3.5" />
                    Texto
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-zinc-400"
                    title="Restablecer el fondo"
                    onClick={clearBackground}
                >
                    <Paintbrush className="size-3.5" />
                    Fondo
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-zinc-400"
                    title="Silenciar el audio"
                    onClick={clearAudio}
                >
                    <VolumeX className="size-3.5" />
                    Audio
                </Button>
            </div>
        </div>
    )
}
