// ----- FreeShow -----
// Store de acciones y disparadores, persistidas en `SYNCED_SETTINGS.actions`.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_ACTIONS, type Action, type Actions, type ActionTrigger } from "@/lib/actions"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "actions"

interface ActionsState {
    actions: Actions
    hydrate: () => Promise<void>
    addAction: (name: string) => void
    updateAction: (id: string, patch: Partial<Action>) => void
    deleteAction: (id: string) => void
}

function persist(actions: Actions) {
    void setStoreValue(STORE_FILE, STORE_KEY, actions).catch(() => undefined)
}

function makeId(name: string, actions: Actions): string {
    const base =
        name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || "accion"
    if (!actions[base]) return base
    let index = 2
    while (actions[`${base}_${index}`]) index += 1
    return `${base}_${index}`
}

export const useActionsStore = create<ActionsState>((set, get) => ({
    actions: JSON.parse(JSON.stringify(DEFAULT_ACTIONS)) as Actions,

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as Actions | null
            if (value && typeof value === "object" && Object.keys(value).length) set({ actions: value })
        } catch {
            // Se mantienen las acciones por defecto.
        }
    },

    addAction: (name) => {
        const actions = get().actions
        const id = makeId(name, actions)
        const trigger: ActionTrigger = "keypress"
        const next = { ...actions, [id]: { id, name: name.trim() || "Acción", trigger, key: "", command: "next_slide", enabled: true } }
        set({ actions: next })
        persist(next)
    },

    updateAction: (id, patch) => {
        const actions = get().actions
        if (!actions[id]) return
        const next = { ...actions, [id]: { ...actions[id], ...patch } }
        set({ actions: next })
        persist(next)
    },

    deleteAction: (id) => {
        const actions = { ...get().actions }
        delete actions[id]
        set({ actions })
        persist(actions)
    },
}))
