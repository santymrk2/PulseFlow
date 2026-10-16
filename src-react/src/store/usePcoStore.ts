// ----- FreeShow -----
// Integración con Planning Center Online (PCO). Configuración + consulta de
// equipos a través del proveedor de sincronización en la nube.

import { create } from "zustand"
import { canSync, getStoreValue, getTeams, setStoreValue } from "@/IPC/system"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "pco"

export interface PcoConfig {
    clientId: string
    clientSecret: string
    teamId: string
    lastSync: number
}

export interface PcoTeam {
    id: string
    name: string
}

interface PcoState {
    config: PcoConfig
    teams: PcoTeam[]
    connected: boolean
    loading: boolean
    hydrate: () => Promise<void>
    update: (patch: Partial<PcoConfig>) => void
    connect: () => Promise<boolean>
    loadTeams: () => Promise<void>
}

const DEFAULT_PCO: PcoConfig = { clientId: "", clientSecret: "", teamId: "", lastSync: 0 }

function persist(config: PcoConfig) {
    void setStoreValue(STORE_FILE, STORE_KEY, config).catch(() => undefined)
}

export const usePcoStore = create<PcoState>((set, get) => ({
    config: { ...DEFAULT_PCO },
    teams: [],
    connected: false,
    loading: false,

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as PcoConfig | null
            if (value && typeof value === "object") set({ config: { ...DEFAULT_PCO, ...value } })
        } catch {
            // Sin configuración previa.
        }
    },

    update: (patch) => {
        const config = { ...get().config, ...patch }
        set({ config })
        persist(config)
    },

    connect: async () => {
        set({ loading: true })
        const ok = await canSync("pco")
        set({ connected: ok, loading: false, config: { ...get().config, lastSync: Date.now() } })
        persist(get().config)
        return ok
    },

    loadTeams: async () => {
        set({ loading: true })
        try {
            const result = (await getTeams("pco")) as PcoTeam[]
            set({ teams: Array.isArray(result) ? result : [] })
        } catch {
            set({ teams: [] })
        } finally {
            set({ loading: false })
        }
    },
}))
