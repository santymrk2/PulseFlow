// ----- FreeShow -----
// Store de plantillas, persistidas en `SYNCED_SETTINGS.templates`.

import { create } from "zustand"
import { getStoreValue, setStoreValue } from "@/IPC/system"
import { DEFAULT_TEMPLATES, type Template, type TemplateAlign, type Templates } from "@/lib/templates"
import { useShowStore } from "@/store/useShowStore"

const STORE_FILE = "SYNCED_SETTINGS"
const STORE_KEY = "templates"

interface TemplatesState {
    templates: Templates
    hydrate: () => Promise<void>
    addTemplate: (name: string) => void
    updateTemplate: (id: string, patch: Partial<Template>) => void
    deleteTemplate: (id: string) => void
    /** Aplica la plantilla a la diapositiva seleccionada. */
    applyToSelected: (id: string) => boolean
}

function persist(templates: Templates) {
    void setStoreValue(STORE_FILE, STORE_KEY, templates).catch(() => undefined)
}

function makeId(name: string, templates: Templates): string {
    const base =
        name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "") || "plantilla"
    if (!templates[base]) return base
    let index = 2
    while (templates[`${base}_${index}`]) index += 1
    return `${base}_${index}`
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)) as Templates,

    hydrate: async () => {
        try {
            const value = (await getStoreValue(STORE_FILE, STORE_KEY)) as Templates | null
            if (value && typeof value === "object" && Object.keys(value).length) set({ templates: value })
        } catch {
            // Se mantienen las plantillas por defecto.
        }
    },

    addTemplate: (name) => {
        const templates = get().templates
        const id = makeId(name, templates)
        const next = {
            ...templates,
            [id]: {
                id,
                name: name.trim() || "Plantilla",
                background: "#000000",
                backgroundImage: "",
                textColor: "#ffffff",
                fontFamily: "system-ui",
                fontSize: 72,
                align: "center" as TemplateAlign,
            },
        }
        set({ templates: next })
        persist(next)
    },

    updateTemplate: (id, patch) => {
        const templates = get().templates
        if (!templates[id]) return
        const next = { ...templates, [id]: { ...templates[id], ...patch } }
        set({ templates: next })
        persist(next)
    },

    deleteTemplate: (id) => {
        const templates = { ...get().templates }
        delete templates[id]
        set({ templates })
        persist(templates)
    },

    applyToSelected: (id) => {
        const template = get().templates[id]
        const slideId = useShowStore.getState().selectedSlideId
        if (!template || !slideId) return false
        useShowStore.getState().updateSlideSettings(slideId, {
            color: template.background,
            backgroundImage: template.backgroundImage || undefined,
            textColor: template.textColor,
            fontFamily: template.fontFamily,
            fontSize: template.fontSize,
            align: template.align,
            template: template.id,
        })
        return true
    },
}))
