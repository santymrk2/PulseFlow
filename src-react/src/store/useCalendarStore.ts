// ----- FreeShow -----
// Store de eventos de calendario, persistidos en `SYNCED_SETTINGS.events`.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import type { CalendarEvent } from "@/lib/calendar"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "events"

interface CalendarState {
    events: CalendarEvent[]
    hydrate: () => Promise<void>
    addEvent: (event: Omit<CalendarEvent, "id">) => void
    updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
    deleteEvent: (id: string) => void
}

function persist(events: CalendarEvent[]) {
    void setStoreValue(STORE_FILE, STORE_KEY, events).catch(() => undefined)
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
    events: [],

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as CalendarEvent[] | null
            if (Array.isArray(value)) set({ events: value })
        } catch {
            // Sin eventos.
        }
    },

    addEvent: (event) => {
        const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const events = [...get().events, { ...event, id }]
        set({ events })
        persist(events)
    },

    updateEvent: (id, patch) => {
        const events = get().events.map((event) => (event.id === id ? { ...event, ...patch } : event))
        set({ events })
        persist(events)
    },

    deleteEvent: (id) => {
        const events = get().events.filter((event) => event.id !== id)
        set({ events })
        persist(events)
    },
}))
