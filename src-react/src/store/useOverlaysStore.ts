// ----- FreeShow -----
// Store de plantillas de overlay, persistidas en `SYNCED_SETTINGS.overlays`.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_OVERLAYS, type OverlayTemplate, type OverlayTemplates } from "@/lib/overlays"
import { useProjectionStore } from "@/store/useProjectionStore"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "overlays"

interface OverlaysState {
    overlays: OverlayTemplates
    hydrate: () => Promise<void>
    addOverlay: (name: string) => void
    updateOverlay: (id: string, patch: Partial<OverlayTemplate>) => void
    deleteOverlay: (id: string) => void
    /** Coloca la plantilla sobre la salida. */
    activate: (id: string) => void
}

function persist(overlays: OverlayTemplates) {
    void setStoreValue(STORE_FILE, STORE_KEY, overlays).catch(() => undefined)
}

function makeId(name: string, overlays: OverlayTemplates): string {
    const base =
        name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || "overlay"
    if (!overlays[base]) return base
    let index = 2
    while (overlays[`${base}_${index}`]) index += 1
    return `${base}_${index}`
}

export const useOverlaysStore = create<OverlaysState>((set, get) => ({
    overlays: JSON.parse(JSON.stringify(DEFAULT_OVERLAYS)) as OverlayTemplates,

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as OverlayTemplates | null
            if (value && typeof value === "object" && Object.keys(value).length) set({ overlays: value })
        } catch {
            // Se mantienen las plantillas por defecto.
        }
    },

    addOverlay: (name) => {
        const overlays = get().overlays
        const id = makeId(name, overlays)
        const next = {
            ...overlays,
            [id]: {
                id,
                name: name.trim() || "Overlay",
                kind: "text",
                text: "Texto",
                subtext: "",
                src: "",
                position: "center",
                color: "#ffffff",
                background: "rgba(0,0,0,0.75)",
            } as OverlayTemplate,
        }
        set({ overlays: next })
        persist(next)
    },

    updateOverlay: (id, patch) => {
        const overlays = get().overlays
        if (!overlays[id]) return
        const next = { ...overlays, [id]: { ...overlays[id], ...patch } }
        set({ overlays: next })
        persist(next)
    },

    deleteOverlay: (id) => {
        const overlays = { ...get().overlays }
        delete overlays[id]
        set({ overlays })
        persist(overlays)
    },

    activate: (id) => {
        const overlay = get().overlays[id]
        if (!overlay) return
        useProjectionStore.getState().upsertOverlay({
            id: `ov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: overlay.kind,
            text: overlay.text || undefined,
            subtext: overlay.subtext || undefined,
            src: overlay.kind === "image" ? overlay.src || undefined : undefined,
            position: overlay.position,
            color: overlay.color,
            background: overlay.background,
        })
    },
}))
