import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { uid } from "uid"
import { Main } from "../../../types/IPC/Main"
import type { Emitter, EmitterTemplate, EmitterTemplateValue } from "../../../types/Show"
import { emitterData, formatData } from "../../components/actions/emitters"
import { getDynamicValue } from "../../components/edit/scripts/itemHelpers"
import { getValues } from "../../components/form/inputs"
import { clone, keysToID, sortByName } from "../../components/helpers/array"
import { Tip } from "../main/Tip"
import { requestMain } from "../../shared/core/ipc/main"
import { activePopup, emitters, popupData } from "../../shared/core/stores"
import { MidiValues } from "../actions/MidiValues"
import { FormInputs } from "../form/FormInputs"
import { useFreshStore } from "../hooks/useFreshStore"
import { Button } from "../ui/button/Button"
import { DynamicList } from "../ui/dynamic-list/DynamicList"
import { HRule } from "../ui/h-rule/HRule"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import styles from "./Emitters.module.css"

// Port de components/main/popups/Emitters.svelte. Lee `emitters` (y popupData al montar: id / name / actionData para crear desde el desplegable de acciones).
// Escribe `emitters` (crear, borrar, nombre, descripción, tipo, señal, plantillas y sus valores: se muta en el lugar y se re-emite, como el Svelte) y, con la flecha
// de "volver" de acción, popupData = actionData y activePopup = "action". IPC: Main.GET_MIDI_OUTPUTS (sin payload) para llenar las salidas MIDI.
// FormInputs y MidiValues son ports React; el cambio de señal va por `live` (último render) por los callbacks de IPC.
// Desvío: el Svelte volvía a pedir GET_MIDI_OUTPUTS con cada emisión del store; acá sólo al entrar a un emisor MIDI o cambiar de tipo (el resultado es el mismo).
// alias de tipo (no interface): DynamicList pide ítems con firma de índice
type TemplateInput = { id: string; name: string; value: EmitterTemplateValue["value"] }
type ListItem = { id: string; name: string; description?: string; type: string }
interface InputChange {
    id?: string
    value: unknown
}

const EMITTER_TYPES: Emitter["type"][] = ["osc", "http", "midi"]
const emitterTypes = [
    { value: "osc", label: "OSC" },
    { value: "http", label: "HTTP" },
    { value: "midi", label: "MIDI" }
]

const DEFAULT_EMITTER: Emitter = { name: "", type: "osc" }
const DEFAULT_TEMPLATE: EmitterTemplate = { name: "", inputs: [] }
const DEFAULT_TEMPLATE_VALUE: EmitterTemplateValue = { name: "", value: "" }

function setEmptyValues(object: TemplateInput[]) {
    return clone(object).map((a) => ({ ...a, value: a.value || (a.name ? `{${a.name.toLowerCase()}}` : "") }))
}

const flexLabel = { display: "flex", gap: "5px", width: "100%", minWidth: "auto" } as const
const faded = { display: "flex", alignItems: "center", marginLeft: "10px", fontSize: "0.8em", opacity: 0.5, fontStyle: "italic" } as const

export function Emitters() {
    const emittersValue = useFreshStore(emitters, clone)
    const [create] = useState(() => {
        const data = get(popupData)
        return { id: (data?.id || "") as string, name: (data?.name || "") as string, backData: data?.actionData || null, newId: uid() }
    })
    const [editEmitter, setEditEmitter] = useState(() => (create.name ? create.id || create.newId : create.id))
    const [editTemplate, setEditTemplate] = useState("")
    const [midiOutputs, setMidiOutputs] = useState<{ value: string; label: string; name: string }[] | null>(null)

    const emitter = emittersValue[editEmitter]
    const template = emitter?.templates?.[editTemplate]
    const templateInputs: TemplateInput[] = (template?.inputs || []).map((a, i) => ({ name: a.name, value: a.value, id: i.toString() }))
    const dataPreview = templateInputs.length ? formatData[emitter?.type]?.(setEmptyValues(templateInputs), emitter.data) : ""
    const emittersList: ListItem[] = sortByName(sortByName(keysToID(emittersValue)), "type").map((a) => ({ id: a.id, name: a.name, description: a.description, type: a.type }))
    const templatesList: ListItem[] = keysToID(emitter?.templates || {}).map((a) => ({ id: a.id, name: a.name, description: a.description, type: "" }))

    const signalInputs = editEmitter && emitter ? clone(getValues(emitterData[emitter.type]?.signal || [], emitter.signal)) : []
    const midiInputs = emitter?.type === "midi" && midiOutputs && signalInputs[0]?.type === "dropdown" ? [{ ...signalInputs[0], options: midiOutputs }, ...signalInputs.slice(1)] : signalInputs

    // Los callbacks de IPC llegan tarde: leen siempre `live` (el último render)
    const live = useRef({ editEmitter, changed, updateMidiTemplateValue })
    useEffect(() => {
        live.current = { editEmitter, changed, updateMidiTemplateValue }
    })

    // create from action dropdown
    useEffect(() => {
        if (!create.name) return
        createEmitter(create.id || create.newId)
        updateValue("name", create.name, create.id || create.newId)
    }, [])

    useEffect(() => {
        if (emitter?.type === "midi") getMidiOutputs()
    }, [editEmitter, emitter?.type])

    function createEmitter(id = create.id || uid()) {
        emitters.update((a) => {
            a[id] = clone(DEFAULT_EMITTER)
            return a
        })

        setEditEmitter(id)
    }
    function deleteEmitter(id: string) {
        emitters.update((a) => {
            delete a[id]
            return a
        })
    }

    // las plantillas se leen del store (no de la copia del render) y se mutan en el lugar, como el Svelte
    const currentTemplates = (id = live.current.editEmitter) => get(emitters)[id]?.templates || {}

    function createTemplate() {
        const id = uid()
        const templates = currentTemplates()
        templates[id] = clone(DEFAULT_TEMPLATE)
        updateValue("templates", templates)

        setEditTemplate(id)
    }
    function deleteTemplate(id: string) {
        const templates = currentTemplates()
        if (!templates[id]) return

        delete templates[id]
        updateValue("templates", templates)
    }
    function updateTemplate(key: "name" | "description", value: string) {
        const templates = currentTemplates()
        if (!templates[editTemplate]) return

        templates[editTemplate][key] = value
        updateValue("templates", templates)
    }

    function createTemplateValue() {
        const templates = currentTemplates()
        if (!templates[editTemplate]) return

        if (!templates[editTemplate].inputs) templates[editTemplate].inputs = []
        templates[editTemplate].inputs.push(clone(DEFAULT_TEMPLATE_VALUE))

        updateValue("templates", templates)
    }
    function removeTemplateValue(index: string) {
        const templates = currentTemplates()
        if (!templates[editTemplate]?.inputs) return

        templates[editTemplate].inputs.splice(Number(index), 1)

        updateValue("templates", templates)
    }
    function updateTemplateValue(index: string, key: "name" | "value", value: string) {
        const templates = currentTemplates()
        if (!templates[editTemplate]?.inputs?.[Number(index)]) return

        templates[editTemplate].inputs[Number(index)][key] = value
        updateValue("templates", templates)
    }

    function updateMidiTemplateValue(detail: { values: EmitterTemplateValue["value"] } | undefined) {
        const values = detail?.values
        if (values === undefined) return // MidiValues siempre manda `values`; el Svelte guardaría undefined

        const templates = currentTemplates()
        if (!templates[editTemplate]?.inputs?.[0]) createTemplateValue()

        templates[editTemplate].inputs[0] = { name: "", value: values }
        updateValue("templates", templates)
    }

    function updateValue<K extends keyof Emitter>(key: K, value: Emitter[K], id = live.current.editEmitter) {
        if (!id || !get(emitters)[id]) return

        emitters.update((a) => {
            a[id][key] = value
            return a
        })
    }

    function changed(input: InputChange, key: "signal") {
        const current = get(emitters)[live.current.editEmitter]
        let previousValue = current[key]
        if (typeof previousValue !== "object") previousValue = {}

        let newValue = { ...previousValue, [input.id as string]: input.value }
        if (!input.id) newValue = input.value
        updateValue(key, newValue)
    }

    // MIDI

    function getMidiOutputs() {
        if (signalInputs[0]?.type !== "dropdown" || (signalInputs[0].options[0] as { value?: string } | undefined)?.value) return

        requestMain(Main.GET_MIDI_OUTPUTS, undefined, (data) => {
            if (!data?.length) return

            setMidiOutputs(data.map((a) => ({ value: a.name, label: a.name, ...a })))
            if (!get(emitters)[live.current.editEmitter]?.signal?.output) updateValue("signal", { output: data[0].name })
        })
    }

    const backButton = create.backData ? (
        <Button
            className="popup-back"
            icon="back"
            iconSize={1.3}
            title="actions.back"
            onClick={() => {
                popupData.set(create.backData)
                activePopup.set("action")
            }}
        />
    ) : null

    if (editTemplate && template) {
        return (
            <>
                {backButton}
                <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setEditTemplate("")} />

                <TextField label="midi.name" value={template.name} onChange={(value) => updateTemplate("name", value ?? "")} autofocus={!template.name} />
                <TextField label="midi.description" value={template.description || ""} onChange={(value) => updateTemplate("description", value ?? "")} />

                <HRule title="emitters.inputs" />

                {emitter.type === "midi" ? (
                    <MidiValues value={{ ...emitter.signal, values: typeof templateInputs[0]?.value === "object" ? templateInputs[0].value : {} }} type="emitter" onChange={(value) => live.current.updateMidiTemplateValue(value)} />
                ) : (
                    <DynamicList addDisabled={!!templateInputs.find((a) => !a.name && !a.value)} items={templateInputs} onAdd={createTemplateValue} onDelete={removeTemplateValue} allowOpen={false}>
                        {(input) => (
                            <div style={{ display: "flex", width: "100%" }}>
                                <TextField label="inputs.name" value={input.name} onChange={(value) => updateTemplateValue(input.id, "name", value ?? "")} style={{ width: "50%" }} />
                                <TextField label="variables.value" value={typeof input.value === "string" ? input.value : ""} onChange={(value) => updateTemplateValue(input.id, "value", value ?? "")} style={{ width: "50%" }} />
                            </div>
                        )}
                    </DynamicList>
                )}

                {dataPreview ? <div className={styles.preview}>{dataPreview.includes("{") ? getDynamicValue(dataPreview) : dataPreview}</div> : null}
            </>
        )
    }

    if (editEmitter && emitter) {
        return (
            <>
                {backButton}
                {!create.backData ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setEditEmitter("")} /> : null}

                <TextField label="midi.name" value={emitter.name} onChange={(value) => updateValue("name", value ?? "")} autofocus={!emitter.name} />
                <TextField label="midi.description" value={emitter.description || ""} onChange={(value) => updateValue("description", value ?? "")} />

                <SelectField
                    label="midi.type"
                    disabled={!!Object.keys(emitter.templates || {})?.length}
                    options={emitterTypes}
                    value={emitter.type}
                    onChange={(value) => {
                        // las opciones son las de EMITTER_TYPES: un valor vacío/desconocido (reset sin defaultValue, inalcanzable) no se guarda
                        const type = EMITTER_TYPES.find((t) => t === value)
                        if (type) updateValue("type", type)
                    }}
                />

                <FormInputs inputs={midiInputs} title="emitters.signal" onChange={(value) => live.current.changed(value, "signal")} />

                {/* TEMPLATES: */}
                {/* WIP message templates only working for OSC/HTTP - MIDI should have a custom template... */}
                <HRule title="emitters.message_templates" />

                <DynamicList items={templatesList} onOpen={setEditTemplate} onDelete={deleteTemplate} onAdd={createTemplate}>
                    {(item) => (
                        <p style={flexLabel}>
                            {item.name || "—"} <span style={faded}>{item.description || ""}</span>
                        </p>
                    )}
                </DynamicList>
            </>
        )
    }

    return (
        <>
            {backButton}

            {!emittersList.length ? <Tip type="info" value="emitters.tip" bottom={20} /> : null}

            <DynamicList items={emittersList} onOpen={setEditEmitter} onDelete={deleteEmitter} onAdd={() => createEmitter()}>
                {(item) => (
                    <p style={flexLabel}>
                        <span style={{ display: "flex", alignItems: "center", textTransform: "uppercase", opacity: 0.5, minWidth: "50px" }}>{item.type}</span>
                        {item.name || "—"}
                        <span style={faded}>{item.description || ""}</span>
                    </p>
                )}
            </DynamicList>
        </>
    )
}
