// ----- FreeShow -----
// Handshake de arranque: replica `src/frontend/utils/startup.ts`.
//
//   1. Registra un receptor en `STARTUP` y envía `READY`.
//   2. El backend responde con `STARTUP { channel: "TYPE", data, autoProfile }`.
//   3. En la ventana principal, pide las tiendas iniciales (`SHOWS`, `SETTINGS`).
//   4. Las respuestas llegan al receptor `MAIN` y se aplican al store de Zustand.

import { useEffect } from "react"
import { MAIN, Main, STARTUP } from "@/IPC/channels"
import { useAppStore } from "@/store/useAppStore"
import { useActionsStore } from "@/store/useActionsStore"
import { useAudioStore } from "@/store/useAudioStore"
import { useCalendarStore } from "@/store/useCalendarStore"
import { useEffectsStore } from "@/store/useEffectsStore"
import { useGroupsStore } from "@/store/useGroupsStore"
import { useOverlaysStore } from "@/store/useOverlaysStore"
import { usePcoStore } from "@/store/usePcoStore"
import { useTemplatesStore } from "@/store/useTemplatesStore"
import { useTimersStore } from "@/store/useTimersStore"
import type { TrimmedShows } from "@/types/Show"

interface StartupMessage {
    channel?: string
    data?: unknown
    autoProfile?: string
}

interface MainMessage {
    channel: string
    data: unknown
}

let startupInitiated = false

export function useStartup() {
    useEffect(() => {
        const api = window.api
        if (!api) return
        if (startupInitiated) return
        startupInitiated = true

        void useGroupsStore.getState().hydrate()
        void useTimersStore.getState().hydrate()
        void useEffectsStore.getState().hydrate()
        void useActionsStore.getState().hydrate()
        void useAudioStore.getState().hydrate()
        void useCalendarStore.getState().hydrate()
        void usePcoStore.getState().hydrate()
        void useOverlaysStore.getState().hydrate()
        void useTemplatesStore.getState().hydrate()

        const onMain = (msg: MainMessage) => {
            if (!msg?.channel) return
            const { setShows, setSettings } = useAppStore.getState()

            if (msg.channel === Main.SHOWS) setShows((msg.data as TrimmedShows) ?? {})
            else if (msg.channel === Main.SETTINGS) setSettings((msg.data as Record<string, any>) ?? {})
        }

        const onStartup = (msg: StartupMessage) => {
            if (msg?.channel !== "TYPE") return
            api.removeListener(STARTUP, "startup")

            // Ventanas de salida/PDF no cargan la biblioteca principal.
            if (msg.data === "output" || msg.data === "pdf") return

            api.receive(MAIN, onMain, "app-main")
            api.send(MAIN, { channel: Main.SHOWS })
            api.send(MAIN, { channel: Main.SETTINGS })
        }

        api.receive(STARTUP, onStartup, "startup")
        api.send(STARTUP, { channel: "READY" })

        // Si el backend no responde, marcamos la conexión como caída.
        const timeout = setTimeout(() => {
            if (useAppStore.getState().status === "connecting") useAppStore.getState().setStatus("offline")
        }, 5000)

        return () => clearTimeout(timeout)
    }, [])
}
