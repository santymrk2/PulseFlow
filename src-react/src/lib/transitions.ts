// ----- FreeShow -----
// Constantes y utilidades de transiciones (espejo de `src/frontend/utils/transitions.ts`).
// Se usan para editar la transición de una diapositiva desde el panel de propiedades.

import type { Transition, TransitionType } from "@/types/Show"

export const TRANSITION_TYPES: { id: TransitionType; label: string }[] = [
    { id: "none", label: "Sin transición" },
    { id: "fade", label: "Desvanecer" },
    { id: "blur", label: "Desenfoque" },
    { id: "spin", label: "Giro" },
    { id: "scale", label: "Escala" },
    { id: "slide", label: "Deslizar" },
]

export const EASINGS = [
    { value: "linear", label: "Lineal" },
    { value: "back", label: "Rebote" },
    { value: "sine", label: "Seno" },
    { value: "circ", label: "Circular" },
    { value: "cubic", label: "Cúbica" },
    { value: "elastic", label: "Elástica" },
] as const

export const SLIDE_DIRECTIONS = [
    { value: "left_right", label: "Izquierda → derecha" },
    { value: "right_left", label: "Derecha → izquierda" },
    { value: "bottom_top", label: "Abajo → arriba" },
    { value: "top_bottom", label: "Arriba → abajo" },
] as const

export const DEFAULT_SLIDE_TRANSITION: Transition = {
    type: "fade",
    duration: 500,
    easing: "sine",
}

/** Transición efectiva de una diapositiva (con respaldo al valor por defecto). */
export function resolveTransition(transition?: Transition): Transition {
    if (!transition) return { ...DEFAULT_SLIDE_TRANSITION }
    return { ...DEFAULT_SLIDE_TRANSITION, ...transition }
}

/** Formatea la duración en milisegundos como segundos legibles (`0.5 s`). */
export function formatDuration(ms: number): string {
    return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`
}
