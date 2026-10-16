// ----- FreeShow -----
// Bus de eventos entre ventanas para el motor de proyección.
//
// A diferencia de `send`/`receive` de `@/IPC/tauri` (que resuelven invocaciones
// dentro de la MISMA ventana), aquí usamos los eventos globales de Tauri, que se
// difunden a TODAS las ventanas. Eso permite sincronizar el estado entre el
// Control y la Audiencia sin round-trip al backend.
//
// Sentido de los eventos:
//   - `PROJECTION_STATE`: Control → Audiencia (estado a dibujar).
//   - `PROJECTION_MSG`:   Audiencia → Control (peticiones, p. ej. el estado inicial).

import { emit } from "@tauri-apps/api/event"
import type { ProjectionMessage, ProjectionState } from "@/types/Output"

export const PROJECTION_STATE = "PROJECTION_STATE"
export const PROJECTION_MSG = "PROJECTION_MSG"

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

/** Envía el estado de proyección a todas las ventanas (Audiencia). */
export async function broadcastProjection(state: ProjectionState): Promise<void> {
    if (!isTauri) return
    try {
        await emit(PROJECTION_STATE, state)
    } catch (error) {
        console.warn(`[projection] emit("${PROJECTION_STATE}") failed:`, error)
    }
}

/** La audiencia pide el estado actual (al abrirse) para no quedar desincronizada. */
export async function requestProjection(): Promise<void> {
    if (!isTauri) return
    try {
        await emit(PROJECTION_MSG, { type: "REQUEST" } satisfies ProjectionMessage)
    } catch (error) {
        console.warn(`[projection] emit("${PROJECTION_MSG}") failed:`, error)
    }
}
