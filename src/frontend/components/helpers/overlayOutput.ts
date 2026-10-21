import { get } from "svelte/store"
import { outLocked, outputs, overlays, timelineRecordingAction } from "../../stores"
import { runAction } from "../actions/actions"
import { findMatchingOut, setOutput } from "./output"

/** Activa o desactiva un overlay en la salida (al activarlo corre sus acciones). */
export function toggleOverlayOutput(id: string) {
    if (get(outLocked)) return

    const isActive = findMatchingOut(id, get(outputs)) !== null

    if (!isActive) {
        // run actions - before starting overlay
        const actions = get(overlays)[id]?.actions
        if (Array.isArray(actions)) actions.forEach((a) => runAction(a, { source: "overlay" }))
    }

    setOutput("overlays", id, true)

    if (isActive) timelineRecordingAction.set({ id: "clear_overlay", data: { id } })
    else timelineRecordingAction.set({ id: "id_select_overlay", data: { id } })
}

/** Activa o desactiva un efecto en la salida. */
export function toggleEffectOutput(id: string) {
    if (get(outLocked)) return
    setOutput("effects", id, true)
}
