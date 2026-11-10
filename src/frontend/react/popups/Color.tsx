import { useState } from "react"
import { get } from "svelte/store"
import { setCalendarColor } from "../../components/drawer/calendar/calendars"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { activePopup, activeProject, activeShow, audioRouting, calendars, editingProjectTemplate, effects, globalTags, outputs, overlays, profiles, projects, projectTemplates, selected, showsCache, templates } from "../../stores"
import type { Selected } from "../../../types/Main"
import { Button } from "../ui/button/Button"
import { ColorField } from "../ui/color-field/ColorField"

// Port de components/main/popups/Color.svelte. Lee (al montar): selected (id y data), y el color actual desde el store que corresponda a esa selección.
// Escribe, al elegir un color (ColorField input): history UPDATE (slide, grupo, overlay, plantilla, efecto) o el store de output, profile, tag, proyecto/plantilla de proyecto (shows), audioRouting (borra outputLink) o setCalendarColor.
// Los stores se modifican con `.update` en el lugar, igual que el original (no hay copia).
const DEFAULT_COLOR = "#FFFFFF"

interface LayoutRef {
    id: string
    type?: string
    parent?: LayoutRef
}
interface IdItem {
    id: string
}
interface SlideItem extends IdItem {
    index: number
}
interface ShowItem {
    index: number
}
interface CalendarItem extends IdItem {
    color?: string
}

function slideRef(data: SlideItem): LayoutRef | undefined {
    let ref: LayoutRef | undefined = data?.id ? { id: data.id } : (getLayoutRef()[data.index] as LayoutRef | undefined)
    if (ref?.type === "child") ref = ref.parent
    return ref
}

function loadColor(selection: Selected): string {
    const data = selection.data[0]
    if (!data) return DEFAULT_COLOR

    if (selection.id === "slide") {
        const ref = slideRef({ ...data, id: "" })
        if (!ref) return DEFAULT_COLOR
        return _show().slides([ref.id]).get("color")[0] || ""
    }
    if (selection.id === "group") return _show().slides([data.id]).get("color")[0] || ""
    if (selection.id === "overlay") return get(overlays)[data]?.color || ""
    if (selection.id === "template") return get(templates)[data]?.color || ""
    if (selection.id === "effect") return get(effects)[data]?.color || ""
    if (selection.id === "output") return get(outputs)[data.id]?.color || ""
    if (selection.id === "profile") return get(profiles)[data.id]?.color || ""
    if (selection.id === "tag") return get(globalTags)[data.id]?.color || ""
    if (selection.id === "show") return (get(editingProjectTemplate) ? get(projectTemplates)[get(editingProjectTemplate)] : get(projects)[get(activeProject) || ""])?.shows?.[data.index]?.color || ""
    if (selection.id === "audio_channel") return get(audioRouting)?.channels?.find((a) => a.id === data.id)?.color || ""
    if (selection.id === "calendar") return get(calendars)?.[data.id]?.color || selection.data[0]?.color || ""
    return DEFAULT_COLOR
}

function applySlide(selection: Selected, value: string) {
    selection.data.forEach((a: SlideItem) => {
        const ref = slideRef(a)
        if (!ref) return

        const active = get(activeShow)
        // remove global group if active
        if (active && get(showsCache)[active.id].slides[ref.id].globalGroup) history({ id: "UPDATE", newData: { data: null, key: "slides", keys: [ref.id], subkey: "globalGroup" }, oldData: { id: active.id }, location: { page: "show", id: "show_key" } })

        history({ id: "UPDATE", newData: { data: value, key: "slides", keys: [ref.id], subkey: "color" }, oldData: { id: active?.id }, location: { page: "show", id: "show_key", override: "color" } })
    })
}

function applyDrawerHistory(selection: Selected, value: string, locationId: string) {
    selection.data.forEach((id: string) => {
        history({ id: "UPDATE", newData: { key: "color", data: value }, oldData: { id }, location: { page: "drawer", id: locationId, override: "color" } })
    })
}

function applyColor(selection: Selected, value: string) {
    switch (selection.id) {
        case "slide":
        case "group":
            applySlide(selection, value)
            break
        case "overlay":
            applyDrawerHistory(selection, value, "overlay_color")
            break
        case "template":
            applyDrawerHistory(selection, value, "template_color")
            break
        case "effect":
            applyDrawerHistory(selection, value, "effect_key")
            break
        case "output":
            outputs.update((a) => {
                selection.data.forEach(({ id }: IdItem) => {
                    a[id].color = value
                })

                return a
            })
            break
        case "profile":
            profiles.update((a) => {
                selection.data.forEach(({ id }: IdItem) => {
                    if (!a[id]) return
                    a[id].color = value
                })

                return a
            })
            break
        case "tag":
            globalTags.update((a) => {
                const id = selection.data[0]?.id || ""
                if (a[id]) a[id].color = value

                return a
            })
            break
        case "show": {
            const templateId = get(editingProjectTemplate)
            const projectId = templateId ? templateId : get(activeProject) || ""

            ;(templateId ? projectTemplates : projects).update((a) => {
                if (!a[projectId]) return a

                selection.data.forEach(({ index }: ShowItem) => {
                    if (!a[projectId]?.shows?.[index]) return
                    a[projectId].shows[index].color = value
                })

                a[projectId].modified = Date.now()
                return a
            })
            break
        }
        case "audio_channel": {
            const id = selection.data[0]?.id
            audioRouting.update((a) => {
                const index = (a?.channels || []).findIndex((c) => c.id === id)
                if (index !== -1) {
                    a!.channels[index].color = value
                    delete a!.channels[index].outputLink
                }
                return a
            })
            break
        }
        case "calendar": {
            const originName = (selection.data[0] as CalendarItem | undefined)?.id
            if (originName) setCalendarColor(originName, value)
            break
        }
    }
}

export function Color() {
    const [selection] = useState(() => get(selected))
    const [value, setValue] = useState(() => loadColor(selection))
    const allowEmpty = selection.id === "show" || selection.id === "audio_channel" // || selection.id === "slide"

    function update(newValue: string) {
        setValue(newValue)
        applyColor(selection, newValue)
    }

    return (
        <>
            <Button className="popup-options" icon="edit" iconSize={1.1} title="menu.edit" onClick={() => activePopup.set("manage_colors")} white />

            <ColorField label="" value={value} onInput={update} allowEmpty={allowEmpty} alwaysVisible />
        </>
    )
}
