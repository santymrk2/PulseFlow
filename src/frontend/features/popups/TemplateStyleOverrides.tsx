import { useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import type { Template, TemplateStyleOverride } from "../../../types/Show"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { DEFAULT_ITEM_STYLE } from "../edit/logic/scripts/itemHelpers"
import { Tip } from "../../react/main/Tip"
import { TemplateHelper } from "../../shared/utils/templates"
import { activeEdit, activePage, activePopup, globalRegexes, popupData, templates } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import { Center } from "../../shared/ui/system/Center"

// Port de components/main/popups/TemplateStyleOverrides.svelte. Lee (al montar) popupData.templateId y, en el render, templates y globalRegexes.
// Escribe: history UPDATE de la plantilla en cada cambio de reglas, templates al crear una, globalRegexes al crear/borrar regex,
// activeEdit + activePage + activePopup para editar plantillas, popupData + activePopup ("regex_manager") y activePopup = null.
// Tip usa el port React. `on:new` entregaba e.detail: acá onNew entrega directamente el nombre creado.
const PRE_STYLE = "paint-order: stroke fill;"
const RESET_STYLE = ";font-size: unset;"
const BORDER_STYLE = { borderLeft: "3px solid var(--primary-lighter) !important" }

export function TemplateStyleOverrides() {
    const [templateId] = useState(() => (get(popupData).templateId as string) || "")
    const templatesValue = useStore(templates)
    const regexesStore = useStore(globalRegexes)

    const template = (templatesValue[templateId] || {}) as Partial<Template>
    const overrides = clone(template.settings?.styleOverrides || [])

    function commit(nextOverrides: TemplateStyleOverride[]) {
        if (!templateId) return

        const settings = clone(template.settings || {})
        if (nextOverrides.length) settings.styleOverrides = clone(nextOverrides)
        else delete settings.styleOverrides

        history({ id: "UPDATE", newData: { key: "settings", data: settings }, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: `${templateId}_styleOverrides` } })
    }

    function addOverride() {
        const next: TemplateStyleOverride[] = [...overrides, { id: uid(6), pattern: "", templateId: "" }]
        commit(next)
    }

    function updateOverride(id: string, key: keyof TemplateStyleOverride, value: string | boolean) {
        const next = overrides.map((override) => (override.id === id ? { ...override, [key]: value } : override))
        commit(next)
    }

    function removeOverride(id: string) {
        const next = overrides.filter((override) => override.id !== id)
        commit(next)
    }

    const templatesList = sortByName(
        keysToID(templatesValue)
            .filter((a) => a.settings?.mode === "text")
            .map((a) => ({ value: a.id, label: a.name, style: PRE_STYLE + new TemplateHelper(a.id).getTextStyle() + RESET_STYLE })),
        "value"
    )

    function createTemplate(name: string) {
        const newId = uid()
        const newTemplate = {
            name,
            color: null,
            category: null,
            settings: { mode: "text" },
            items: [{ style: clone(DEFAULT_ITEM_STYLE), lines: [{ text: [{ style: "", value: name || translateText("example.text") }] }] }]
        } as Template

        templates.update((a) => {
            a[newId] = newTemplate
            return a
        })

        return newId
    }

    function editTemplate(id?: string) {
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
        activePopup.set(null)
    }

    function deleteTemplate(id: string) {
        history({ id: "UPDATE", newData: { id }, location: { page: "edit", id: "template" } })
    }

    const regexes = Object.entries(regexesStore).map(([id, regex]) => ({ value: id, label: regex.label }))

    function editRegexes(id: string, regexId?: string, name?: string) {
        let finalId = regexId
        if (!finalId) {
            finalId = uid()
            updateOverride(id, "globalRegex", finalId)
        }

        if (name) {
            globalRegexes.update((a) => {
                a[finalId!] = { label: name, value: "" }
                return a
            })
        }

        popupData.set({ id: finalId, previousData: clone(get(popupData)), previousPopup: "template_style_overrides" })
        activePopup.set("regex_manager")
    }

    function deleteRegex(id: string) {
        globalRegexes.update((a) => {
            delete a[id]
            return a
        })
    }

    return (
        <section>
            <Tip type="info" value="edit.style_overrides_tip" bottom={20} />

            {overrides.length ? (
                overrides.map((override) => {
                    const pattern = override.globalRegex ? `${regexesStore[override.globalRegex]?.label || ""}: ${regexesStore[override.globalRegex]?.value || ""}` : override.pattern
                    return (
                        <InputRow key={override.id}>
                            <TextField label="edit.style_override_pattern" style={{ flex: 4 }} disabled={!!override.globalRegex} value={pattern || ""} onChange={(value) => updateOverride(override.id, "pattern", value || "")} autofocus={!pattern} />
                            {override.globalRegex ? <Button title="titlebar.edit" icon="edit" onClick={() => editRegexes(override.id, override.globalRegex)} /> : null}
                            <SelectField label="/regex/" options={regexes} value={override.globalRegex || ""} onChange={(value) => updateOverride(override.id, "globalRegex", value || "")} onNew={(value) => editRegexes(override.id, "", value)} addNew="Create Regex" onDelete={deleteRegex} allowDeleting onlyArrow />

                            <SelectField label="formats.template" style={{ flex: 2, ...BORDER_STYLE }} options={templatesList} value={override.templateId || ""} onChange={(value) => updateOverride(override.id, "templateId", value || "")} onNew={(value) => updateOverride(override.id, "templateId", createTemplate(value))} onDelete={deleteTemplate} allowDeleting />
                            {override.templateId && templatesValue[override.templateId] ? <Button title="titlebar.edit" icon="edit" onClick={() => editTemplate(override.templateId)} white /> : null}

                            <Button icon="delete" title="actions.delete" style={BORDER_STYLE} onClick={() => removeOverride(override.id)} white />
                        </InputRow>
                    )
                })
            ) : (
                <Center faded style={{ margin: "20px 0" }}>
                    <T id="empty.general" />
                </Center>
            )}

            <Button variant="outline" icon="add" style={{ width: "100%", marginTop: "10px" }} onClick={addOverride}>
                <T id="settings.add" />
            </Button>
        </section>
    )
}
