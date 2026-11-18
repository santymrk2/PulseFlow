import { useState, type CSSProperties } from "react"
import { getContrast } from "../../components/helpers/color"
import { cn } from "../../lib/utils"
import { effects, fullColors, overlays, playerVideos, scenes, templates } from "../../stores"
import { getAccess } from "../../utils/profile"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { HiddenInput, type HiddenInputEdit } from "../ui/hidden-input/HiddenInput"
import styles from "./Label.module.css"

// Port de components/drawer/Label.svelte. `dispatch`/eventos propios: ninguno; `on:edit` del HiddenInput → onEdit.
// El `bind:edit` se conserva como estado local + onEditChange. `nameCategories` es el duplicado de NavigationButton.
export interface LabelProps {
    label: string
    count?: number
    renameId?: string
    title?: string
    icon?: null | string
    color?: null | string
    white?: boolean
    mode?: "grid" | "list" | "lyrics"
}

interface NamedEntry {
    name: string
    modified?: number
}

type NamedStore = Record<string, NamedEntry | undefined>

function setName<T extends NamedStore>(current: T, name: string, id: string, modify = false): T {
    const entry = current[id]
    if (!entry) return current
    return { ...current, [id]: { ...entry, name, ...(modify ? { modified: Date.now() } : {}) } }
}

export function Label({ label, count = 0, renameId = "", title = "", icon = null, color = null, white = false, mode = "grid" }: LabelProps) {
    const fullColorsValue = useStore(fullColors)
    const [editActive, setEditActive] = useState<boolean | string>(false)

    function changeName(value: string, categoryId: string) {
        const [type, elemId] = categoryId.split("_")
        if (type === "overlay") {
            if (getAccess("overlays").global === "read" || getAccess("overlays")[elemId] === "read") return
            overlays.update((a) => setName(a, value, elemId, true))
        } else if (type === "template") {
            if (getAccess("templates").global === "read" || getAccess("templates")[elemId] === "read") return
            templates.update((a) => setName(a, value, elemId, true))
        } else if (type === "scene") {
            if (getAccess("scenes").global === "read" || getAccess("scenes")[elemId] === "read") return
            scenes.update((a) => setName(a, value, elemId, true))
        } else if (type === "effect") {
            if (getAccess("overlays").global === "read" || getAccess("overlays")[elemId] === "read") return
            effects.update((a) => setName(a, value, elemId))
        } else if (type === "player") {
            playerVideos.update((a) => setName(a, value, elemId))
        } else console.log("Trying to rename unadded type: " + type)
    }

    const rootStyle: CSSProperties = fullColorsValue ? { backgroundColor: color ?? undefined, color: getContrast(color || "") } : mode !== "list" ? { borderBottom: `2px solid ${color ?? ""}` } : {}

    return (
        <div className={cn(styles.label, icon && styles.alignRight, !renameId && styles.padding, mode !== "grid" && styles.list)} data-title={title} style={rootStyle}>
            {icon ? <Icon id={icon} className="icon" style={icon === "protected" ? { opacity: 0.6 } : undefined} size={icon === "protected" ? 0.6 : 1} white={white} /> : null}

            {renameId ? (
                <HiddenInput value={label} id={renameId} edit={editActive} onEditChange={setEditActive} onEdit={(detail: HiddenInputEdit) => changeName(detail.value, renameId)} />
            ) : (
                <span className={styles.title} style={count ? { marginInlineEnd: "14px" } : undefined}>
                    {label ? (
                        label
                    ) : (
                        <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                            <T id="main.unnamed" />
                        </span>
                    )}
                    {count ? <span style={{ opacity: 0.6, fontSize: "0.75em", position: "absolute", insetInlineEnd: "6px", top: "50%", transform: "translateY(-50%)" }}>{count}</span> : null}
                </span>
            )}
        </div>
    )
}
