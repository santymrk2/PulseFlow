// F11.2 — migas de navegación del cajón inferior.
// Devuelve [{ key }] para textos traducidos (pestaña, ids especiales) y
// [{ name }] para datos del usuario (nombres de categorías/carpetas guardadas).

export interface Crumb {
    key?: string // clave de idioma (se traduce al renderizar)
    name?: string // nombre guardado por el usuario (sin traducir)
}

export interface BreadcrumbData {
    categories?: { [key: string]: { name: string } }
    mediaFolders?: { [key: string]: { name: string } }
    audioFolders?: { [key: string]: { name: string } }
    audioPlaylists?: { [key: string]: { name: string } }
    overlayCategories?: { [key: string]: { name: string } }
    templateCategories?: { [key: string]: { name: string } }
    scriptures?: { [key: string]: { name: string } }
}

// ids especiales del cajón que no son categorías guardadas
const SPECIAL_CRUMBS: { [key: string]: string } = {
    all: "category.all",
    unlabeled: "category.unlabeled",
    favourites: "category.favourites",
    inputs: "emitters.inputs",
    online: "media.online",
    metronome: "audio.metronome",
    effects: "tabs.effects",
    effects_library: "category.sound_effects",
    event: "menu._title_calendar",
    action: "calendar.schedule_action",
    actions: "tabs.actions",
    timer: "tabs.timers",
    variables: "tabs.variables",
    scenes: "tabs.scenes",
    interactions: "tabs.interactions"
}

function lookupName(stores: { [key: string]: { [key: string]: { name: string } | undefined } | undefined }, keys: string[], id: string): string | undefined {
    for (const key of keys) {
        const name = stores[key]?.[id]?.name
        if (name) return name
    }
    return undefined
}

/** Migas para una pestaña del cajón: [pestaña] o [pestaña › categoría]. */
export function getBreadcrumbs(tab: string, category: string | undefined, data: BreadcrumbData): Crumb[] {
    const crumbs: Crumb[] = [{ key: `tabs.${tab}` }]
    if (!category) return crumbs

    if (SPECIAL_CRUMBS[category]) {
        crumbs.push({ key: SPECIAL_CRUMBS[category] })
        return crumbs
    }

    const search: { [key: string]: { [key: string]: { name: string } | undefined } | undefined } = {
        shows: data.categories,
        media: data.mediaFolders,
        audio: data.audioFolders,
        audio_playlists: data.audioPlaylists,
        overlays: data.overlayCategories,
        templates: data.templateCategories,
        scripture: data.scriptures
    }
    const lookupKeys: string[] = tab === "audio" ? ["audio", "audio_playlists"] : [tab]
    const name = lookupName(search, lookupKeys, category)
    if (name) crumbs.push({ name })

    return crumbs
}
