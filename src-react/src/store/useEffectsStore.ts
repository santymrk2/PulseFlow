// ----- FreeShow -----
// Store de efectos visuales: definiciones persistidas + lista de activos.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_EFFECTS, type Effect, type Effects, type EffectType } from "@/lib/effects"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "effects"

interface EffectsState {
    effects: Effects
    /** Ids de efectos activos (se dibujan sobre la salida). */
    active: string[]
    hydrate: () => Promise<void>
    addEffect: (name: string, type: EffectType) => void
    updateEffect: (id: string, patch: Partial<Effect>) => void
    deleteEffect: (id: string) => void
    toggleActive: (id: string) => void
    clearActive: () => void
}

function persist(effects: Effects) {
    void setStoreValue(STORE_FILE, STORE_KEY, effects).catch(() => undefined)
}

function makeId(name: string, effects: Effects): string {
    const base =
        name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || "efecto"
    if (!effects[base]) return base
    let index = 2
    while (effects[`${base}_${index}`]) index += 1
    return `${base}_${index}`
}

export const useEffectsStore = create<EffectsState>((set, get) => ({
    effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)) as Effects,
    active: [],

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as Effects | null
            if (value && typeof value === "object" && Object.keys(value).length) set({ effects: value })
        } catch {
            // Se mantienen los efectos por defecto.
        }
    },

    addEffect: (name, type) => {
        const effects = get().effects
        const id = makeId(name, effects)
        const next = { ...effects, [id]: { id, name: name.trim() || "Efecto", type, color: "#ffffff", quantity: 150, speed: 1 } }
        set({ effects: next })
        persist(next)
    },

    updateEffect: (id, patch) => {
        const effects = get().effects
        if (!effects[id]) return
        const next = { ...effects, [id]: { ...effects[id], ...patch } }
        set({ effects: next })
        persist(next)
    },

    deleteEffect: (id) => {
        const effects = { ...get().effects }
        delete effects[id]
        set({ effects, active: get().active.filter((effectId) => effectId !== id) })
        persist(effects)
    },

    toggleActive: (id) =>
        set((state) => ({
            active: state.active.includes(id) ? state.active.filter((effectId) => effectId !== id) : [...state.active, id],
        })),

    clearActive: () => set({ active: [] }),
}))
