// @ts-nocheck
import { useMemo } from "react"
import { uid } from "uid"
import { actions, activePopup, emitters, popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getDynamicValue } from "../edit/logic/scripts/itemHelpers"
import { clone, keysToID, sortByName } from "../../shared/utils/helpers/array"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { DynamicList } from "../../shared/ui/kit/dynamic-list/DynamicList"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { TextField } from "../../shared/ui/kit/text-field/TextField"
import type { API_emitter } from "./logic/api"
import { formatData } from "./logic/emitters"
import { MidiValues } from "./MidiValues"

export interface ChooseEmitterProps {
    value: API_emitter
    onChange?: (value: API_emitter) => void
}

export function ChooseEmitter({ value, onChange }: ChooseEmitterProps) {
    const emittersStore = useStore(emitters) as unknown as never
    void useStore(actions)
    const popupDataStore = useStore(popupData) as unknown as never

    const emittersList = useMemo(() => clone(sortByName(keysToID(emittersStore).map((a: unknown) => ({ value: a.id, label: a.name })), "label")), [emittersStore])
    const emitter = emittersStore[value.emitter]

    function updateValue(key: string, v: unknown) {
        const next = { ...value }
        if (key === "emitter") {
            next.templateValues = []
            next.template = ""
        } else if (key === "template") {
            const inputs = clone(emitter?.templates?.[v]?.inputs || [])
            next.templateValues = inputs
        }

        ;(next as unknown as never)[key] = v
        onChange?.(next)
    }

    function setTemplateValue(index: string | number, v: unknown, key = "value") {
        let templateValues = value.templateValues ? clone(value.templateValues) : []
        if (!templateValues[index as number]) templateValues[index as number] = { name: "", value: "" }
        templateValues[index as number][key] = v
        updateValue("templateValues", templateValues)
    }

    function setMidiTemplateValue(v: unknown) {
        const values = v?.values
        let templateValues = value.templateValues ? clone(value.templateValues) : []
        if (!templateValues[0]) templateValues[0] = { name: "", value: "" }
        templateValues[0].value = values
        updateValue("templateValues", templateValues)
    }

    function createTemplateValue() {
        const templateValues = value.templateValues ? clone(value.templateValues) : []
        templateValues.push({ name: "", value: "" })
        updateValue("templateValues", templateValues)
    }

    function removeTemplateValue(index: string) {
        const templateValues = value.templateValues ? clone(value.templateValues) : []
        templateValues.splice(Number(index), 1)
        updateValue("templateValues", templateValues)
    }

    const activeTemplate = value.template || "custom"
    const templatesList = useMemo(
        () => [
            { value: "custom", label: translateText("actions.custom_key") },
            ...clone(sortByName(keysToID(emitter?.templates || {}).map((a: unknown) => ({ value: a.id, label: a.name })), "label"))
        ],
        [emitter]
    )

    const templateInputs = ((emitter?.templates?.[activeTemplate]?.inputs || []) as unknown as never[]).filter((a) => emitter?.type === "midi" || a.name)
    const customTemplateInputs = ((value.templateValues || []) as unknown as never[]).map((a, i) => ({ ...a, id: i.toString() }))
    const dataPreview = value.templateValues?.length ? (formatData as unknown as never)[emitter?.type]?.(value.templateValues, value.data) : ""

    function editEmitter() {
        const id = value.emitter
        if (!id) return
        popupData.set({ id, actionData: popupDataStore })
        activePopup.set("manage_emitters")
    }

    return (
        <>
            <InputRow>
                <SelectField
                    label={`emitters.emitter ${emitter?.type ? `<span style='color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;'>${String(emitter.type).toUpperCase()}</span>` : ""}`}
                    options={emittersList}
                    value={value.emitter}
                    onNew={(name) => {
                        const id = uid()
                        const actionId = popupDataStore?.id
                        if (!actionId) return
                        actions.update((a: unknown) => {
                            if (!a[actionId]) return a
                            a[actionId].name += `: ${name}`
                            const triggerId = a[actionId].triggers?.find((t: string) => t.includes("emit_action"))
                            if (!triggerId) return a
                            if (!a[actionId].actionValues) a[actionId].actionValues = {}
                            a[actionId].actionValues[triggerId] = { emitter: id }
                            return a
                        })
                        popupData.set({ name, id, actionData: popupDataStore })
                        activePopup.set("manage_emitters")
                    }}
                    onChange={(v) => updateValue("emitter", v)}
                    addNew="timer.create"
                />
                {value.emitter ? <Button title="titlebar.edit" icon="edit" onClick={editEmitter} /> : null}
            </InputRow>

            {value.emitter ? (
                <>
                    {emitter?.description ? (
                        <InputRow style={{ padding: 10, display: "flex", gap: 8, background: "var(--primary-darker)", fontSize: "0.9em" }}>
                            <p>
                                <T id="midi.description" />
                            </p>
                            <p style={{ fontStyle: "italic", opacity: 0.5, overflow: "hidden" }} data-title={emitter.description}>
                                {emitter.description}
                            </p>
                        </InputRow>
                    ) : null}

                    <SelectField label="emitters.message_template" options={templatesList} value={activeTemplate || "custom"} onChange={(v) => updateValue("template", v)} />

                    {templateInputs.length ? (
                        <>
                            {emitter?.templates?.[activeTemplate]?.description ? (
                                <InputRow style={{ padding: 10, display: "flex", gap: 8, background: "var(--primary-darker)", fontSize: "0.9em" }}>
                                    <p>
                                        <T id="midi.description" />
                                    </p>
                                    <p style={{ fontStyle: "italic", opacity: 0.5, overflow: "hidden" }} data-title={emitter.templates[activeTemplate].description}>
                                        {emitter.templates[activeTemplate].description}
                                    </p>
                                </InputRow>
                            ) : null}

                            {emitter?.type !== "midi"
                                ? templateInputs.map((input: unknown, i: number) => {
                                      const stringValue = typeof (value.templateValues?.[i] || input).value === "string" ? (value.templateValues?.[i] || input).value : ""
                                      return <TextField key={i} label={input.name} disabled={!!input.value} placeholder={translateText("variables.value")} value={stringValue} onChange={(v) => setTemplateValue(i, v)} />
                                  })
                                : null}
                        </>
                    ) : emitter?.type === "midi" ? (
                        <MidiValues value={{ ...emitter.signal, values: typeof customTemplateInputs[0]?.value === "object" ? customTemplateInputs[0].value : {} } as unknown as never} onChange={(v) => setMidiTemplateValue(v)} type="emitter" />
                    ) : (
                        <DynamicList addDisabled={!!customTemplateInputs?.find((a) => !a.name && !a.value)} items={customTemplateInputs} onAdd={createTemplateValue} onDelete={(id) => removeTemplateValue(id)} allowOpen={false} nothingText={false}>
                            {(input: unknown) => (
                                <div style={{ display: "flex", width: "100%" }}>
                                    <TextField label="inputs.name" value={input.name || ""} onChange={(v) => setTemplateValue(input.id, v, "name")} style={{ width: "50%" }} />
                                    <TextField label="variables.value" value={String(input.value ?? "")} onChange={(v) => setTemplateValue(input.id, v, "value")} style={{ width: "50%" }} />
                                </div>
                            )}
                        </DynamicList>
                    )}

                    {emitter?.type === "osc" ? <TextField label="emitters.data" value={value.data || ""} onChange={(v) => updateValue("data", v)} /> : null}

                    <InputRow style={{ backgroundColor: "var(--primary-darker)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
                        <p>
                            <T id="timer.preview" />
                        </p>
                        {dataPreview ? (
                            <p style={{ opacity: 0.5, overflow: "hidden" }} data-title={dataPreview}>
                                {String(dataPreview).includes("{") ? getDynamicValue(dataPreview) : dataPreview}
                            </p>
                        ) : null}
                    </InputRow>
                </>
            ) : null}
        </>
    )
}
