// ----- FreeShow -----
// Panel izquierdo de la página "Edit": lista vertical de diapositivas del show
// activo (equivalente a `components/edit/Slides.svelte`).
//
// Cada fila muestra la miniatura de la diapositiva y su número; al pulsar se
// selecciona para editarla en el lienzo central.

import { FileText } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import SlideThumbnail from "@/components/SlideThumbnail"
import { cn } from "@/lib/utils"
import { getLayoutSlideIds } from "@/lib/show"
import { useShowStore } from "@/store/useShowStore"

const RESOLUTION = { width: 1920, height: 1080 }

export default function SlidesPanel() {
  const show = useShowStore((s) => s.show)
  const selectedSlideId = useShowStore((s) => s.selectedSlideId)
  const selectSlide = useShowStore((s) => s.selectSlide)

  const ids = getLayoutSlideIds(show)

  if (!show || ids.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center text-muted-foreground">
        <FileText className="size-5" />
        <p className="text-xs">No hay diapositivas</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full flex-1">
      <div className="flex flex-col gap-1 p-2">
        {ids.map((id, index) => {
          const slide = show.slides[id]
          if (!slide) return null
          const active = selectedSlideId === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectSlide(id)}
              className={cn(
                "flex items-start gap-2 rounded-md p-1 text-left transition-colors",
                active ? "bg-zinc-800 ring-1 ring-zinc-700" : "hover:bg-zinc-800/60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 w-5 shrink-0 text-center text-[11px] tabular-nums",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden rounded border">
                <SlideThumbnail slide={slide} resolution={RESOLUTION} />
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
