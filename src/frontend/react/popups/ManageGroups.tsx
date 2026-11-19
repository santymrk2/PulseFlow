import { get } from "../../shared/core/lib/store"
import type { ShowGroups } from "../../../types/Show"
import { clone, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { activePopup, groupNumbers, groups, groupsMoreOptionsEnabled, special, templates } from "../../shared/core/stores"
import { newToast } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { isGroupHidden } from "../../shared/utils/profile"
import { cn } from "../../shared/core/lib/utils"
import { T } from "../../shared/ui/helpers/T"
import { useFreshStore } from "../../shared/ui/hooks/useFreshStore"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { ColorField } from "../../shared/ui/kit/color-field/ColorField"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { PopupField } from "../../shared/ui/kit/popup-field/PopupField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"

// Port de components/main/popups/ManageGroups.svelte. Lee groups (sin los ocultos por el perfil), groupNumbers, groupsMoreOptionsEnabled, special.groupShortcutPreview,
// templates (nombre de la plantilla) y activePopup (para volver desde el selector de atajo / plantilla). Escribe: groups (se quita `default` al renombrar un grupo por
// defecto; "restablecer" los reemplaza por los ocho por defecto), groupNumbers, groupsMoreOptionsEnabled, special.groupShortcutPreview y, por cada edición / alta / baja,
// history({ id: "UPDATE", … location: { page: "none", id: "global_group" } }) (undo del Svelte: igual de limitado).
// Sin key en el original: se usa la posición (al renombrar y reordenarse, el foco queda en la fila, como en el Svelte).
// Los `null` de PopupField (limpiar atajo / plantilla con allowEmpty) se pasan al history tal cual, como el Svelte (`e?.target?.value || e`).
interface Group {
    id: string
    name: string
    color: string
    default?: boolean
    template?: string
    shortcut?: string
}

const defaultGroups: ShowGroups = {
    break: { name: "break", default: true, color: "#f5255e" },
    bridge: { name: "bridge", default: true, color: "#f52598", shortcut: "B" },
    chorus: { name: "chorus", default: true, color: "#f525d2", shortcut: "C" },
    intro: { name: "intro", default: true, color: "#d525f5" },
    outro: { name: "outro", default: true, color: "#a525f5" },
    pre_chorus: { name: "pre_chorus", default: true, color: "#8825f5" },
    tag: { name: "tag", default: true, color: "#7525f5" },
    verse: { name: "verse", default: true, color: "#5825f5", shortcut: "V" }
}

function changeGroup(value: string | null | undefined, id: string, key: "name" | "color" | "shortcut" | "template" = "name") {
    // remove default tag if name is changed (used for translation)
    // WIP undo won't work here...
    if (key === "name" && get(groups)[id].default) {
        groups.update((a) => {
            delete a[id].default

            return a
        })
    }

    history({ id: "UPDATE", newData: { key, data: value }, oldData: { id }, location: { page: "none", id: "global_group", override: "group_" + key } })

    // if name ends with space and a single digit, alert that numbers are auto assigned
    if (key === "name" && get(groupNumbers) && /\s\d$/.test(value ?? "")) {
        newToast("tips.group_numbers")
    }
}

function addGroup() {
    const value = { group: "", groupColor: "#ffffff" }
    history({ id: "UPDATE", newData: { data: { name: value.group, color: value.groupColor } }, location: { page: "none", id: "global_group" } })
}

function updateSpecial(key: string, value: boolean) {
    special.update((a) => {
        a[key] = value
        return a
    })
}

function reset() {
    groups.set(clone(defaultGroups))
    groupNumbers.set(true)
}

export function ManageGroups() {
    // los grupos se editan en el lugar dentro del store (history, delete default): cada emisión entrega una copia
    const groupsValue = useFreshStore(groups)
    const specialValue = useFreshStore(special)
    const templatesValue = useStore(templates)
    const groupNumbersValue = useStore(groupNumbers)
    const activePopupValue = useStore(activePopup)
    const showMore = useStore(groupsMoreOptionsEnabled)

    const g: Group[] = sortByName(
        Object.entries(groupsValue)
            .filter(([id]) => !isGroupHidden(id))
            .map(([id, a]) => ({ ...a, id, name: a.default ? translateText("groups." + a.name) || a.name : a.name }))
    )

    return (
        <>
            <Button className={cn("popup-options", showMore && "active")} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => groupsMoreOptionsEnabled.set(!showMore)} white />

            {showMore ? <Button className="popup-reset" icon="reset" iconSize={1.1} title="actions.reset" onClick={reset} white /> : null}

            <div style={{ minWidth: "calc(100vw - var(--navigation-width) * 2 - 51px)" }}>
                {showMore ? (
                    <>
                        <ToggleField label="settings.auto_group_numbers" checked={groupNumbersValue} defaultValue={true} onChange={(checked) => groupNumbers.set(checked)} />
                        <ToggleField style={{ marginBottom: "10px" }} label="settings.shortcuts_on_slides" checked={specialValue.groupShortcutPreview} defaultValue={false} onChange={(checked) => updateSpecial("groupShortcutPreview", checked)} />
                    </>
                ) : null}

                {g.length ? (
                    g.map((group, index) => (
                        <InputRow key={index}>
                            <TextField label="inputs.name" style={{ flex: 1 }} value={group.name} onChange={(value) => changeGroup(value, group.id)} />
                            <ColorField label="edit.color" noLabel style={{ flex: 0, minWidth: "200px" }} value={group.color} onInput={(value) => changeGroup(value, group.id, "color")} />
                            <PopupField<string | undefined>
                                label="groups.group_shortcut"
                                style={{ width: "28%" }}
                                id={group.id}
                                value={group.shortcut}
                                name={typeof group.shortcut === "string" ? group.shortcut.toUpperCase() : ""}
                                icon="shortcut"
                                popupId="assign_shortcut"
                                data={{
                                    revert: activePopupValue,
                                    existingShortcuts: g.filter((a) => a.id !== group.id && a.shortcut).map((a) => a.shortcut),
                                    mode: "global_group"
                                }}
                                onChange={(value) => changeGroup(value, group.id, "shortcut")}
                                allowEmpty
                            />
                            {/* template */}
                            {showMore ? (
                                <PopupField<string | undefined>
                                    label="groups.group_template"
                                    style={{ width: "22%" }}
                                    value={group.template}
                                    name={templatesValue[group.template || ""]?.name ?? ""}
                                    icon="templates"
                                    popupId="select_template"
                                    data={{
                                        action: "select_template",
                                        revert: activePopupValue
                                    }}
                                    onChange={(value) => changeGroup(value, group.id, "template")}
                                    allowEmpty
                                />
                            ) : null}

                            <Button style={{ flex: 0 }} icon="delete" title="actions.delete" onClick={() => history({ id: "UPDATE", newData: { id: group.id }, location: { page: "none", id: "global_group" } })} white />
                        </InputRow>
                    ))
                ) : (
                    <div style={{ width: "100%", textAlign: "center", padding: "15px", opacity: 0.4 }}>
                        <T id="empty.general" />
                    </div>
                )}

                <Button variant="outline" style={{ width: "100%" }} icon="add" onClick={addGroup}>
                    <T id="settings.add" />
                </Button>
            </div>
        </>
    )
}
