// ----- FreeShow -----
// Acciones de salida: proyectar la diapositiva seleccionada a la ventana de
// Audiencia, incluyendo la información que necesita el Stage Display (siguiente
// diapositiva y notas).

import { getLayoutSlideIds, getSlideText } from "@/lib/show"
import { slideToRichText } from "@/lib/projection"
import { useProjectionStore } from "@/store/useProjectionStore"
import { useShowStore } from "@/store/useShowStore"

/** Proyecta una diapositiva del show activo a la ventana de Audiencia. */
export function projectSlide(slideId: string | null | undefined): void {
    const { show } = useShowStore.getState()
    if (!show || !slideId) return

    const slide = show.slides[slideId]
    const richText = slideToRichText(slide)

    const ids = getLayoutSlideIds(show)
    const index = ids.indexOf(slideId)
    const nextId = index >= 0 ? ids[index + 1] : undefined
    const nextText = nextId ? getSlideText(show.slides[nextId]) : ""
    const notes = slide?.notes ?? ""

    // El fondo de la diapositiva (color o degradado CSS) se aplica a la salida.
    const background = slide?.settings?.color || undefined

    useProjectionStore.getState().projectRichText(richText, { nextText, notes, background })
}

/** Proyecta el versículo de una biblia (texto enriquecido + referencia). */
export function projectVerse(text: string, reference: string, nextText: string, notes: string): void {
    useProjectionStore.getState().projectRichText(
        { lines: [{ text }], align: "center" },
        { subtext: reference, nextText, notes }
    )
}
