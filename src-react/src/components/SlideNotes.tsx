// ----- FreeShow -----
// Notas de la diapositiva. Texto libre que se muestra en el Stage Display
// (pantalla de músicos) mientras la diapositiva está proyectada. Equivale al
// campo `notes` de `Slide`.

import { StickyNote } from "lucide-react"
import { useShowStore } from "@/store/useShowStore"

export default function SlideNotes() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const setSlideNotes = useShowStore((s) => s.setSlideNotes)

    const slide = show && selectedSlideId ? show.slides[selectedSlideId] : undefined

    if (!selectedSlideId || !slide) {
        return (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-zinc-600">
                <StickyNote className="size-4" />
                <p className="text-xs">Selecciona una diapositiva para editar sus notas.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <StickyNote className="size-3.5" />
                Notas de la diapositiva
            </div>
            <textarea
                value={slide.notes ?? ""}
                onChange={(event) => setSlideNotes(selectedSlideId, event.target.value)}
                placeholder="Escribe notas para el Stage Display…"
                className="min-h-40 w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-[11px] text-muted-foreground">
                Se muestran sólo en el Stage Display, nunca en la proyección.
            </p>
        </div>
    )
}
