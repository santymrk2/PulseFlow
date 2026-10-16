// ----- FreeShow -----
// Store de grupos de diapositivas (etiquetas con color). Persistencia en la
// tienda de ajustes sincronizados (`SYNCED_SETTINGS.groups`), igual que la
// versión Svelte (`getSyncedSettings` en `utils/save.ts`).

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_GROUPS, getGroupColor, getGroupLabel, type ShowGroups } from "@/lib/groups"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "groups"

interface GroupsState {
    groups: ShowGroups
    /** Etiqueta visible de un grupo (o su id). */
    label: (id: string) => string
    /** Color del grupo (o gris por defecto). */
    color: (id: string) => string
    /** Carga los grupos desde disco (llamar al arrancar). */
    hydrate: () => Promise<void>
    setGroups: (groups: ShowGroups) => void
    addGroup: (name: string, color: string) => void
    updateGroup: (id: string, patch: Partial<ShowGroups[string]>) => void
    deleteGroup: (id: string) => void
    reset: () => void
}

function persist(groups: ShowGroups) {
    void setStoreValue(STORE_FILE, STORE_KEY, groups).catch(() => undefined)
}

function makeId(name: string, groups: ShowGroups): string {
    const base =
        name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || "group"
    if (!groups[base]) return base
    let index = 2
    while (groups[`${base}_${index}`]) index += 1
    return `${base}_${index}`
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
    groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)) as ShowGroups,

    label: (id) => getGroupLabel(get().groups, id),
    color: (id) => getGroupColor(get().groups, id),

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as ShowGroups | null
            if (value && typeof value === "object" && Object.keys(value).length) {
                set({ groups: value })
            }
        } catch {
            // Se mantienen los grupos por defecto.
        }
    },

    setGroups: (groups) => {
        set({ groups })
        persist(groups)
    },

    addGroup: (name, color) => {
        const groups = get().groups
        const id = makeId(name, groups)
        const next = { ...groups, [id]: { name: name.trim() || "Grupo", color } }
        set({ groups: next })
        persist(next)
    },

    updateGroup: (id, patch) => {
        const groups = get().groups
        if (!groups[id]) return
        const next = { ...groups, [id]: { ...groups[id], ...patch } }
        set({ groups: next })
        persist(next)
    },

    deleteGroup: (id) => {
        const groups = { ...get().groups }
        delete groups[id]
        set({ groups })
        persist(groups)
    },

    reset: () => {
        const groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS)) as ShowGroups
        set({ groups })
        persist(groups)
    },
}))

export { getGroupColor, getGroupLabel }
