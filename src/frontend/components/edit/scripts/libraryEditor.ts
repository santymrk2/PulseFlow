import { get } from "svelte/store"
import { activeEdit, activePage, drawerTabsData, effects, overlays, templates } from "../../../stores"

// Theme editor y Overlay editor: la página Edit con una plantilla / overlay / efecto abierto. Se abre el que ya se estaba
// editando, y si no, el primero de la categoría elegida (o el primero que haya).

export function openThemeEditor() {
    if (get(activeEdit).type === "template") {
        activePage.set("edit")
        return
    }

    const all = Object.entries(get(templates)).filter(([, a]) => a && a.settings?.mode !== "text")
    const category = get(drawerTabsData).templates?.activeSubTab || "all"
    const id = (all.find(([, a]) => category === "all" || a.category === category) || all[0])?.[0] || ""

    activeEdit.set({ type: "template", id, items: [] })
    activePage.set("edit")
}

export function openOverlayEditor(kind: "overlay" | "effect" | null = null) {
    const current = get(activeEdit).type
    if (!kind && (current === "overlay" || current === "effect")) {
        activePage.set("edit")
        return
    }

    const category = get(drawerTabsData).overlays?.activeSubTab || "all"
    const wantsEffect = kind ? kind === "effect" : category === "effects"

    if (wantsEffect) {
        activeEdit.set({ type: "effect", id: Object.keys(get(effects))[0] || "", items: [] })
    } else {
        const list = Object.entries(get(overlays))
        const id = (list.find(([, a]) => a && (category === "all" || a.category === category)) || list[0])?.[0] || ""
        activeEdit.set({ type: "overlay", id, items: [] })
    }
    activePage.set("edit")
}
