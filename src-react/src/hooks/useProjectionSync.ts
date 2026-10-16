// ----- FreeShow -----
// Sincronización del estado de proyección entre ventanas.
//
// - `useProjectionBroadcast`: se monta en la ventana de CONTROL. Emite cada
//   cambio del store y responde a las peticiones de la Audiencia.
// - `useProjectionListener`: se monta en la ventana de AUDIENCIA. Aplica el
//   estado recibido y pide el inicial al montarse.

import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"
import type { UnlistenFn } from "@tauri-apps/api/event"
import {
    PROJECTION_MSG,
    PROJECTION_STATE,
    broadcastProjection,
    isTauri,
    requestProjection,
} from "@/IPC/projection"
import { useProjectionStore } from "@/store/useProjectionStore"
import type { ProjectionState } from "@/types/Output"

/**
 * Registra un `listen` manejando el ciclo de vida de forma segura frente al doble
 * montaje de `StrictMode`: si el efecto ya se limpió, cancela el listener en
 * cuanto se resuelve la promesa.
 */
function listenSafe<T>(event: string, handler: (payload: T) => void): () => void {
    let active = true
    let unlisten: UnlistenFn | undefined

    listen<T>(event, (e) => handler(e.payload))
        .then((fn) => {
            if (active) unlisten = fn
            else fn()
        })
        .catch((error) => console.warn(`[projection] listen("${event}") failed:`, error))

    return () => {
        active = false
        unlisten?.()
    }
}

import {
    clearBackground,
    clearSceneText,
    isNativeOutputOpen,
    isNativeStageOpen,
    selectSlideNative,
    setBackgroundImage,
    updateStageData,
} from "@/IPC/system"

async function syncNativeGpuEngine(state: ProjectionState) {
    try {
        const isNativeOpen = await isNativeOutputOpen()
        const isStageOpen = await isNativeStageOpen()
        if (!isNativeOpen && !isStageOpen) return

        if (!state.visible) {
            if (isNativeOpen) {
                await clearSceneText()
                await clearBackground()
            }
            if (isStageOpen) {
                await updateStageData({
                    currentSlide: "",
                    nextSlide: state.nextText || undefined,
                })
            }
            return
        }

        // Actualizar Fondo en GPU si existe media
        if (state.media?.path && isNativeOpen) {
            await setBackgroundImage(state.media.path, "cover", 1.0)
        }

        // Extraer texto
        let mainText = state.text || ""
        if (state.richText?.lines?.length) {
            mainText = state.richText.lines.map((l) => l.text).join("\n")
        }

        if (isNativeOpen) {
            await selectSlideNative({
                text: mainText,
                subtext: state.subtext,
                background: state.media?.path
                    ? {
                          id: state.media.path,
                          path: state.media.path,
                          mediaType: state.media.kind || "image",
                          opacity: 1.0,
                          aspectMode: 0,
                      }
                    : undefined,
            })
        }

        if (isStageOpen) {
            await updateStageData({
                currentSlide: mainText,
                nextSlide: state.nextText || undefined,
                clock: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                message: state.alert?.text || undefined,
            })
        }
    } catch (err) {
        console.warn("[projection] syncNativeGpuEngine failed:", err)
    }
}

/** Ventana de control: difunde el estado y atiende las peticiones de la audiencia. */
export function useProjectionBroadcast() {
    useEffect(() => {
        if (!isTauri) return

        // La audiencia pide el estado al abrirse (evita quedar desincronizada).
        const stopListening = listenSafe(PROJECTION_MSG, () => {
            void broadcastProjection(useProjectionStore.getState())
        })

        // Emite cada cambio local del store a Webview y al Native GPU Render Engine
        const unsubscribe = useProjectionStore.subscribe((state) => {
            void broadcastProjection(state)
            void syncNativeGpuEngine(state)
        })

        return () => {
            stopListening()
            unsubscribe()
        }
    }, [])
}

/** Ventana de audiencia: aplica el estado recibido y pide el inicial. */
export function useProjectionListener(enabled = true) {
    useEffect(() => {
        if (!isTauri || !enabled) return

        const stopListening = listenSafe<ProjectionState>(PROJECTION_STATE, (payload) => {
            useProjectionStore.getState().applyRemote(payload)
        })

        void requestProjection()

        return () => stopListening()
    }, [enabled])
}
