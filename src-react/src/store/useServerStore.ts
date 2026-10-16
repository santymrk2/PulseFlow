// ----- FreeShow -----
// Servidor remoto (REST/WebSocket) y streaming. Controla el ciclo de vida a
// través de los comandos Rust `START`/`STOP`/`WEBSOCKET_START`/`WEBSOCKET_STOP`.

import { create } from "zustand"
import { startServers, stopServers, timecodeStart, timecodeStop, websocketStart, websocketStop } from "@/IPC/system"

export type TimecodeMode = "send" | "receive"

interface ServerState {
    running: boolean
    websocket: boolean
    port: number
    password: string
    timecodeMode: TimecodeMode
    framerate: number
    timecodeRunning: boolean
    setPort: (port: number) => void
    setPassword: (password: string) => void
    start: () => Promise<void>
    stop: () => Promise<void>
    toggleTimecode: () => Promise<void>
    setTimecodeMode: (mode: TimecodeMode) => void
    setFramerate: (framerate: number) => void
}

export const useServerStore = create<ServerState>((set, get) => ({
    running: false,
    websocket: false,
    port: 5500,
    password: "",
    timecodeMode: "send",
    framerate: 25,
    timecodeRunning: false,

    setPort: (port) => set({ port }),
    setPassword: (password) => set({ password }),

    start: async () => {
        const { port } = get()
        await startServers({ ports: { remote: port } })
        await websocketStart({ port })
        set({ running: true, websocket: true })
    },

    stop: async () => {
        await websocketStop()
        await stopServers()
        set({ running: false, websocket: false })
    },

    toggleTimecode: async () => {
        if (get().timecodeRunning) {
            await timecodeStop()
            set({ timecodeRunning: false })
        } else {
            await timecodeStart({ value: "00:00:00:00" })
            set({ timecodeRunning: true })
        }
    },

    setTimecodeMode: (timecodeMode) => set({ timecodeMode }),
    setFramerate: (framerate) => set({ framerate }),
}))
