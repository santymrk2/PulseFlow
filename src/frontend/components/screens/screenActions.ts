// Reglas puras para eliminar pantallas (salidas) de la configuración.
// Sin stores ni IPC: lo que toca la app vive en `ScreenDetail.svelte`.

type ScreenLike = { stageOutput?: unknown; kind?: string }

const isStage = (output: ScreenLike) => !!output.stageOutput || output.kind === "stage"

/**
 * Una pantalla se puede quitar si existe y, siendo audiencia, queda otra audiencia.
 * Sin ninguna audiencia, el historial de `settings_output` crearía una "default"
 * sola, y el usuario vería reaparecer lo que acaba de borrar.
 */
export function canRemoveScreen(outputs: Record<string, ScreenLike>, id: string): boolean {
    const output = outputs[id]
    if (!output) return false
    if (isStage(output)) return true
    return Object.entries(outputs).some(([otherId, other]) => otherId !== id && !isStage(other))
}

/** Pantalla a seleccionar tras quitar `id`: del mismo grupo si hay, si no la otra. */
export function nextScreenAfterRemove(outputs: Record<string, ScreenLike>, id: string): string | null {
    const removed = outputs[id]
    const rest = Object.entries(outputs).filter(([otherId]) => otherId !== id)
    const sameGroup = rest.find(([, other]) => !removed || isStage(other) === isStage(removed))
    return (sameGroup ?? rest[0])?.[0] ?? null
}
