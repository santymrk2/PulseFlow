// ----- FreeShow -----
// Store del estado de proyección (Zustand).
//
// Es el estado que se sincroniza entre la ventana de Control (que lo modifica) y
// las ventanas de Audiencia/Stage (que lo aplican). Todas las instancias comparten
// la misma forma; el transporte entre ventanas vive en `@/IPC/projection`.

import { create } from "zustand"
import {
    DEFAULT_MEDIA_PLAYBACK,
    DEFAULT_PROJECTION,
    type ProjectionAlert,
    type ProjectionMedia,
    type ProjectionMediaPlayback,
    type ProjectionOverlay,
    type ProjectionRichText,
    type ProjectionState,
    type ProjectionTimer,
} from "@/types/Output"

interface ProjectRichTextOptions {
    subtext?: string
    nextText?: string
    notes?: string
    background?: string
    color?: string
    align?: ProjectionState["align"]
}

interface ProjectionStore extends ProjectionState {
    /** Actualiza el estado localmente y refresca `updatedAt` (lado Control). */
    setProjection: (patch: Partial<ProjectionState>) => void
    /** Envía un medio (imagen/vídeo) a la pantalla de Audiencia. */
    projectMedia: (media: ProjectionMedia) => void
    /** Proyecta texto plano (p. ej. desde el panel de pruebas). */
    projectText: (text: string, options?: ProjectRichTextOptions) => void
    /** Proyecta texto enriquecido (diapositiva o versículo). */
    projectRichText: (richText: ProjectionRichText | null, options?: ProjectRichTextOptions) => void
    /** Añade o reemplaza un overlay por id. */
    upsertOverlay: (overlay: ProjectionOverlay) => void
    /** Elimina un overlay por id. */
    removeOverlay: (id: string) => void
    /** Elimina todos los overlays. */
    clearOverlays: () => void
    /** Fija (o elimina) el temporizador/cuenta atrás activo. */
    setTimer: (timer: ProjectionTimer | null) => void
    /** Modifica parcialmente el temporizador activo. */
    updateTimer: (patch: Partial<ProjectionTimer>) => void
    /** Modifica el estado de reproducción del medio activo. */
    setMediaPlayback: (patch: Partial<ProjectionMediaPlayback>) => void
    /** Fija (o elimina) el mensaje de alerta a la audiencia. */
    setAlert: (alert: ProjectionAlert | null) => void
    /** Aplica un estado recibido de otra ventana sin volver a emitirlo. */
    applyRemote: (state: ProjectionState) => void
    /** Vuelve a la pantalla limpia (negro). */
    clear: () => void
    /** Limpia sólo el texto (y datos asociados) sin tocar el fondo/medio. */
    clearText: () => void
    /** Restablece el fondo a negro. */
    clearBackground: () => void
    /** Detiene y silencia el audio del medio activo. */
    clearAudio: () => void
}

export const useProjectionStore = create<ProjectionStore>((set) => ({
    ...DEFAULT_PROJECTION,

    setProjection: (patch) => set((state) => ({ ...state, ...patch, updatedAt: Date.now() })),

    projectMedia: (media) =>
        set((state) => ({
            ...state,
            visible: true,
            media,
            richText: null,
            text: "",
            subtext: "",
            nextText: "",
            mediaPlayback: { ...DEFAULT_MEDIA_PLAYBACK, muted: media.muted },
            updatedAt: Date.now(),
        })),

    projectText: (text, options = {}) =>
        set((state) => ({
            ...state,
            visible: true,
            text,
            richText: null,
            media: null,
            subtext: options.subtext ?? "",
            nextText: options.nextText ?? "",
            notes: options.notes ?? "",
            background: options.background ?? state.background,
            color: options.color ?? state.color,
            align: options.align ?? state.align,
            updatedAt: Date.now(),
        })),

    projectRichText: (richText, options = {}) =>
        set((state) => ({
            ...state,
            visible: true,
            richText,
            text: "",
            subtext: options.subtext ?? "",
            media: null,
            nextText: options.nextText ?? "",
            notes: options.notes ?? "",
            background: options.background ?? state.background,
            color: options.color ?? state.color,
            align: options.align ?? richText?.align ?? state.align,
            updatedAt: Date.now(),
        })),

    upsertOverlay: (overlay) =>
        set((state) => {
            const exists = state.overlays.some((o) => o.id === overlay.id)
            const overlays = exists
                ? state.overlays.map((o) => (o.id === overlay.id ? overlay : o))
                : [...state.overlays, overlay]
            return { ...state, overlays, updatedAt: Date.now() }
        }),

    removeOverlay: (id) =>
        set((state) => ({ ...state, overlays: state.overlays.filter((o) => o.id !== id), updatedAt: Date.now() })),

    clearOverlays: () => set((state) => ({ ...state, overlays: [], updatedAt: Date.now() })),

    setTimer: (timer) => set((state) => ({ ...state, timer, updatedAt: Date.now() })),

    updateTimer: (patch) =>
        set((state) => (state.timer ? { ...state, timer: { ...state.timer, ...patch }, updatedAt: Date.now() } : state)),

    setMediaPlayback: (patch) =>
        set((state) => ({ ...state, mediaPlayback: { ...state.mediaPlayback, ...patch }, updatedAt: Date.now() })),

    setAlert: (alert) => set((state) => ({ ...state, alert, updatedAt: Date.now() })),

    applyRemote: (state) => set({ ...DEFAULT_PROJECTION, ...state }),

    clear: () => set({ ...DEFAULT_PROJECTION, updatedAt: Date.now() }),

    clearText: () =>
        set((state) => ({
            ...state,
            richText: null,
            text: "",
            subtext: "",
            nextText: "",
            notes: "",
            updatedAt: Date.now(),
        })),

    clearBackground: () => set((state) => ({ ...state, background: "#000000", updatedAt: Date.now() })),

    clearAudio: () =>
        set((state) => ({
            ...state,
            mediaPlayback: { ...state.mediaPlayback, playing: false, muted: true },
            updatedAt: Date.now(),
        })),
}))
