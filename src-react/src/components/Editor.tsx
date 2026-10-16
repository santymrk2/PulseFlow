// ----- FreeShow -----
// Panel central: editor del show activo. Cabecera con información del show y la
// cuadrícula interactiva de diapositivas (`SlideGrid`).

import { LayoutGrid, Loader2, MonitorPlay, Plus } from "lucide-react"
import SlideGrid from "@/components/SlideGrid"
import { Button } from "@/components/ui/button"
import { getActiveLayout, getLayoutSlideIds } from "@/lib/show"
import { projectSlide } from "@/lib/outputActions"
import { useShowStore } from "@/store/useShowStore"

export default function Editor() {
    const show = useShowStore((s) => s.show)
    const loading = useShowStore((s) => s.loading)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const addSlide = useShowStore((s) => s.addSlide)

    const layout = getActiveLayout(show)
    const count = getLayoutSlideIds(show).length

    return (
        <div className="flex h-full flex-col bg-zinc-950">
            <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3">
                <div className="flex min-w-0 items-center gap-2">
                    <LayoutGrid className="size-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate text-[13px] font-medium text-zinc-200">
                        {show ? show.name : "Editor"}
                    </span>
                    {show && layout && (
                        <span className="truncate text-xs text-zinc-600">· {layout.name}</span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {show && (
                        <span className="text-[11px] text-zinc-600">
                            {count} {count === 1 ? "diapositiva" : "diapositivas"}
                        </span>
                    )}
                    {show && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={addSlide}
                                className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                            >
                                <Plus className="size-3.5" />
                                Añadir
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!selectedSlideId}
                                onClick={() => projectSlide(selectedSlideId)}
                                className="gap-1.5"
                            >
                                <MonitorPlay className="size-3.5" />
                                Proyectar
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-zinc-600">
                    <Loader2 className="size-4 animate-spin" />
                    <p className="text-xs">Cargando show…</p>
                </div>
            ) : (
                <SlideGrid />
            )}
        </div>
    )
}
