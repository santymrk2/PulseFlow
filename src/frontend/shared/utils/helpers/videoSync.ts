import type { PlayingVideoState } from "../../../features/media/logic/video/videoPlayer"

/** Lo que el engine necesita del transporte del webview para que su video lo siga (F23.14). */
export interface VideoSyncFields {
    paused?: boolean
    positionMs?: number
}

/** Cada cuánto se reenvía la posición aunque nada más haya cambiado. */
const RESEND_INTERVAL_MS = 1000

/** Clave de un video en `playingVideoState` (la misma para el fondo y los ítems de la slide). */
export function videoStateKey(path: string, outputId: string): string {
    return `${path}_${outputId}`
}

export function videoSyncFields(state: PlayingVideoState | undefined): VideoSyncFields {
    if (!state) return {}
    return { ...(state.paused ? { paused: true } : {}), positionMs: Math.round(state.currentTime * 1000) }
}

/** `true` si cambió la pausa, o si pasó el intervalo desde el último envío y hay posición. */
export function shouldResendForVideo(prev: VideoSyncFields | undefined, next: VideoSyncFields, lastSentAt: number, now: number): boolean {
    if (!!prev?.paused !== !!next.paused) return true
    return next.positionMs !== undefined && now - lastSentAt >= RESEND_INTERVAL_MS
}
