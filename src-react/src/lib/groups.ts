// ----- FreeShow -----
// Grupos de diapositivas (etiquetas con color: Verso, Coro, Puente…).
// Espejo de los `defaultGroups` de `ManageGroups.svelte` y de los helpers de
// `show/tools/groups.ts` (nombre visible + color por grupo).

export interface ShowGroup {
    name: string
    color: string
    default?: boolean
    shortcut?: string
    template?: string
}

export type ShowGroups = Record<string, ShowGroup>

/** Grupos por defecto, con etiqueta en español y color característico. */
export const DEFAULT_GROUPS: Record<string, ShowGroup> = {
    verse: { name: "Verso", color: "#5825f5", shortcut: "V", default: true },
    chorus: { name: "Coro", color: "#f525d2", shortcut: "C" },
    bridge: { name: "Puente", color: "#f52598", shortcut: "B" },
    pre_chorus: { name: "Pre-coro", color: "#8825f5" },
    intro: { name: "Intro", color: "#d525f5" },
    outro: { name: "Final", color: "#a525f5" },
    tag: { name: "Tag", color: "#7525f5" },
    break: { name: "Descanso", color: "#f5255e" },
}

/** Nombre visible de un grupo (o el propio id si no se encuentra). */
export function getGroupLabel(groups: Record<string, { name: string }>, id: string | null | undefined): string {
    if (!id) return ""
    const group = groups[id]
    return group?.name || id
}

/** Color de un grupo (con respaldo neutro). */
export function getGroupColor(groups: Record<string, { color?: string }>, id: string | null | undefined): string {
    if (!id) return "#52525b"
    return groups[id]?.color || "#52525b"
}

/** Id de grupo de una diapositiva dentro del show (`slide.group` o `"."`). */
export function getSlideGroupId(slide: { group?: string | null } | undefined): string {
    return slide?.group && slide.group !== "." ? slide.group : ""
}
