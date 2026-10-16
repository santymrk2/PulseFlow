// ----- FreeShow -----
// Store del editor: show activo, selección de diapositiva y edición.
//
// La carga (`openShow`) envía `SHOW` al backend y la respuesta llega por el
// receptor `MAIN` (ver `hooks/useShowLoader.ts`). Las ediciones (reordenar,
// añadir, duplicar, eliminar, editar) son inmediatas en memoria y se persisten
// con `SAVE` de forma debounced.

import { create } from "zustand"
import { MAIN, Main } from "@/IPC/channels"
import {
    appendLayoutSlide,
    createEmptySlide,
    duplicateLayoutSlide,
    getLayoutSlideIds,
    moveLayoutSlide,
    normalizeShow,
    removeLayoutSlide,
    updateLayoutData,
    updateSlideInShow,
    updateSlideSettings,
} from "@/lib/show"
import type { Show, Slide, SlideData, SlideSettings } from "@/types/Show"

interface ShowState {
    /** Id del show seleccionado en la biblioteca. */
    activeShowId: string | null
    /** Show completo (slides/layouts) cargado desde Rust. */
    show: Show | null
    loading: boolean
    error: string | null
    /** Diapositiva seleccionada en el editor. */
    selectedSlideId: string | null
    openShow: (id: string, name?: string) => void
    applyShow: (raw: unknown, id: string) => void
    selectSlide: (id: string | null) => void
    /** Selecciona la diapositiva siguiente/anterior (con `delta` ±1). */
    stepSlide: (delta: number) => void
    reorderSlides: (from: number, to: number) => void
    addSlide: () => void
    duplicateSlide: (id?: string) => void
    deleteSlide: (id?: string) => void
    /** Reemplaza los datos de una diapositiva (inmutable + debounced save). */
    updateSlide: (id: string, slide: Slide) => void
    /** Fusiona `settings` (fondo/plantilla…) en una diapositiva. */
    updateSlideSettings: (id: string, patch: SlideSettings) => void
    /** Fusiona datos del layout (transición, fondo) de una diapositiva. */
    updateSlideLayoutData: (id: string, patch: SlideData) => void
    /** Asigna (o quita con `""`) el grupo/etiqueta de una diapositiva. */
    setSlideGroup: (id: string, group: string) => void
    /** Fija las notas (para el Stage Display) de una diapositiva. */
    setSlideNotes: (id: string, notes: string) => void
}

function send(channel: string, data?: unknown) {
    window.api?.send(MAIN, { channel, data })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Persiste el show de forma debounced (el payload `SAVE` necesita `name`). */
function scheduleSave(show: Show) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        saveTimer = null
        // Igual que el archivo en disco: `[id, data]`, sin el id dentro de data.
        const { id, ...data } = show
        send(Main.SAVE, { showsCache: { [id]: data } })
    }, 600)
}

export const useShowStore = create<ShowState>((set, get) => ({
    activeShowId: null,
    show: null,
    loading: false,
    error: null,
    selectedSlideId: null,

    openShow: (id, name) => {
        if (get().activeShowId === id && get().show) return
        set({ activeShowId: id, loading: true, error: null, show: null, selectedSlideId: null })
        send(Main.SHOW, { id, name })
    },

    applyShow: (raw, id) => {
        const show = normalizeShow(raw, id)
        if (!show) {
            set({ show: null, loading: false, error: "No se pudo cargar el show" })
            return
        }
        set({
            show,
            loading: false,
            error: null,
            selectedSlideId: getLayoutSlideIds(show)[0] ?? null,
        })
    },

    selectSlide: (id) => set({ selectedSlideId: id }),

    stepSlide: (delta) => {
        const { show, selectedSlideId } = get()
        const ids = getLayoutSlideIds(show)
        if (!ids.length) return
        const current = selectedSlideId ? ids.indexOf(selectedSlideId) : -1
        const next = current < 0 ? 0 : Math.min(ids.length - 1, Math.max(0, current + delta))
        set({ selectedSlideId: ids[next] })
    },

    reorderSlides: (from, to) => {
        const { show } = get()
        if (!show || from === to) return
        const next = moveLayoutSlide(show, from, to)
        if (next === show) return
        set({ show: next })
        scheduleSave(next)
    },

    addSlide: () => {
        const { show } = get()
        if (!show) return
        const { show: next, id } = appendLayoutSlide(show, createEmptySlide())
        set({ show: next, selectedSlideId: id })
        scheduleSave(next)
    },

    duplicateSlide: (id) => {
        const { show, selectedSlideId } = get()
        if (!show) return
        const target = id ?? selectedSlideId
        if (!target) return
        const result = duplicateLayoutSlide(show, target)
        if (!result) return
        set({ show: result.show, selectedSlideId: result.id })
        scheduleSave(result.show)
    },

    deleteSlide: (id) => {
        const { show, selectedSlideId } = get()
        if (!show) return
        const target = id ?? selectedSlideId
        if (!target) return
        const next = removeLayoutSlide(show, target)
        if (next === show) return
        const ids = getLayoutSlideIds(next)
        set({ show: next, selectedSlideId: ids[0] ?? null })
        scheduleSave(next)
    },

    updateSlide: (id, slide) => {
        const { show } = get()
        if (!show) return
        const next = updateSlideInShow(show, id, slide)
        set({ show: next })
        scheduleSave(next)
    },

    updateSlideSettings: (id, patch) => {
        const { show } = get()
        if (!show) return
        const slide = show.slides[id]
        if (!slide) return
        const next = updateSlideInShow(show, id, updateSlideSettings(slide, patch))
        set({ show: next })
        scheduleSave(next)
    },

    updateSlideLayoutData: (id, patch) => {
        const { show } = get()
        if (!show) return
        const next = updateLayoutData(show, id, patch)
        if (next === show) return
        set({ show: next })
        scheduleSave(next)
    },

    setSlideGroup: (id, group) => {
        const { show } = get()
        if (!show) return
        const slide = show.slides[id]
        if (!slide) return
        const next = updateSlideInShow(show, id, { ...slide, group: group || undefined })
        set({ show: next })
        scheduleSave(next)
    },

    setSlideNotes: (id, notes) => {
        const { show } = get()
        if (!show) return
        const slide = show.slides[id]
        if (!slide) return
        const next = updateSlideInShow(show, id, { ...slide, notes })
        set({ show: next })
        scheduleSave(next)
    },
}))
