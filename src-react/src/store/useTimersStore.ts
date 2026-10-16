// ----- FreeShow -----
// Store de temporizadores (definiciones persistidas + control del activo).
//
// Las definiciones se guardan en la tienda `SYNCED_SETTINGS.timers` (como en
// `getSyncedSettings`) y el temporizador en curso vive en `useProjectionStore`
// para sincronizarse con las ventanas de Audiencia y Stage.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { computeTimer, formatTimer, startProjectionTimer, type TimerEntry, type TimerMode, type TimersSettings } from "@/lib/timers"
import { useProjectionStore } from "@/store/useProjectionStore"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "timers"

interface TimersState {
    timers: TimersSettings
    hydrate: () => Promise<void>
    addTimer: (entry: TimerEntry) => string
    updateTimer: (id: string, patch: Partial<TimerEntry>) => void
    deleteTimer: (id: string) => void
    /** Inicia (o reinicia) un temporizador y lo envía a proyección. */
    start: (id: string) => void
    pause: () => void
    resume: () => void
    reset: () => void
    stop: () => void
}

function persist(timers: TimersSettings) {
    void setStoreValue(STORE_FILE, STORE_KEY, timers).catch(() => undefined)
}

function makeId(settings: TimersSettings): string {
    let index = 1
    while (settings[`timer${index}`]) index += 1
    return `timer${index}`
}

export const useTimersStore = create<TimersState>((set, get) => ({
    timers: {},

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as TimersSettings | null
            if (value && typeof value === "object") set({ timers: value })
        } catch {
            // Sin persistencia previa.
        }
    },

    addTimer: (entry) => {
        const timers = get().timers
        const id = makeId(timers)
        const next = { ...timers, [id]: entry }
        set({ timers: next })
        persist(next)
        return id
    },

    updateTimer: (id, patch) => {
        const timers = get().timers
        if (!timers[id]) return
        const next = { ...timers, [id]: { ...timers[id], ...patch } }
        set({ timers: next })
        persist(next)
    },

    deleteTimer: (id) => {
        const timers = { ...get().timers }
        delete timers[id]
        set({ timers })
        persist(timers)
        if (useProjectionStore.getState().timer?.id === id) useProjectionStore.getState().setTimer(null)
    },

    start: (id) => {
        const entry = get().timers[id]
        if (!entry) return
        useProjectionStore.getState().setTimer(startProjectionTimer(id, entry))
    },

    pause: () => {
        const timer = useProjectionStore.getState().timer
        if (!timer || timer.paused) return
        useProjectionStore.getState().updateTimer({ paused: true, frozen: computeTimer(timer).seconds })
    },

    resume: () => {
        const timer = useProjectionStore.getState().timer
        if (!timer || !timer.paused) return
        const now = Date.now()
        const anchor = timer.mode === "elapsed" ? now - timer.frozen * 1000 : now + timer.frozen * 1000
        useProjectionStore.getState().updateTimer({ paused: false, anchor })
    },

    reset: () => {
        const timer = useProjectionStore.getState().timer
        if (!timer) return
        useProjectionStore.getState().updateTimer({ paused: true, frozen: timer.total, anchor: Date.now() + timer.total * 1000 })
    },

    stop: () => useProjectionStore.getState().setTimer(null),
}))

export { computeTimer, formatTimer }
export type { TimerEntry, TimerMode }
