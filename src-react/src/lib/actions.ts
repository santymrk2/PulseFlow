// ----- FreeShow -----
// Acciones y disparadores (subconjunto de `type Action` de `types/Show.ts`).
// Una acción asocia un disparador (tecla, arranque o MIDI) con un comando.

import { projectSlide } from "@/lib/outputActions"
import { useEffectsStore } from "@/store/useEffectsStore"
import { useProjectionStore } from "@/store/useProjectionStore"
import { useShowStore } from "@/store/useShowStore"

export type ActionTrigger = "keypress" | "startup" | "midi"

export interface ActionCommand {
    id: string
    label: string
}

export const ACTION_COMMANDS: ActionCommand[] = [
    { id: "next_slide", label: "Siguiente diapositiva" },
    { id: "prev_slide", label: "Diapositiva anterior" },
    { id: "project_selected", label: "Proyectar diapositiva seleccionada" },
    { id: "clear", label: "Limpiar pantalla" },
    { id: "clear_text", label: "Limpiar texto" },
    { id: "clear_background", label: "Limpiar fondo" },
    { id: "toggle_effects", label: "Alternar efectos" },
    { id: "stop_timer", label: "Detener temporizador" },
]

export interface Action {
    id: string
    name: string
    trigger: ActionTrigger
    /** Tecla asociada cuando `trigger === "keypress"` (p. ej. "b"). */
    key: string
    command: string
    enabled: boolean
}

export type Actions = Record<string, Action>

export const DEFAULT_ACTIONS: Actions = {
    pantalla_negra: { id: "pantalla_negra", name: "Pantalla negra", trigger: "keypress", key: "b", command: "clear", enabled: true },
    limpiar_texto: { id: "limpiar_texto", name: "Limpiar texto", trigger: "keypress", key: "c", command: "clear_text", enabled: true },
    alternar_efectos: { id: "alternar_efectos", name: "Alternar efectos", trigger: "keypress", key: "e", command: "toggle_effects", enabled: true },
}

export function runAction(command: string) {
    switch (command) {
        case "next_slide":
            useShowStore.getState().stepSlide(1)
            break
        case "prev_slide":
            useShowStore.getState().stepSlide(-1)
            break
        case "project_selected":
            projectSlide(useShowStore.getState().selectedSlideId)
            break
        case "clear":
            useProjectionStore.getState().clear()
            break
        case "clear_text":
            useProjectionStore.getState().clearText()
            break
        case "clear_background":
            useProjectionStore.getState().clearBackground()
            break
        case "toggle_effects": {
            const effects = useEffectsStore.getState()
            if (effects.active.length) effects.clearActive()
            else Object.keys(effects.effects).forEach((id) => effects.toggleActive(id))
            break
        }
        case "stop_timer":
            useProjectionStore.getState().setTimer(null)
            break
        default:
            break
    }
}
