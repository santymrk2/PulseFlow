import { useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { InteractionInput as StoredInput } from "../../../types/Main"
import { clone } from "../../shared/utils/helpers/array"
import { interactions, popupData } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { ChoiceGrid, type ChoiceOption } from "../ui/choice-grid/ChoiceGrid"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./InteractionInput.module.css"

// Port de components/main/popups/InteractionInput.svelte. Lee popupData { id (interacción), inputIndex } al montar y interactions[id].inputs[inputIndex].
// Escribe interactions[id].inputs (la primera vez que se completa algo que no sea el tipo se agrega; después se reemplaza ese índice por una copia).
// El Svelte editaba `currentInput` por alias (al abrir uno existente era el objeto del store) y escribía una copia en cada cambio: el borrador acá es
// una copia desde el principio, sin efecto observable (el store recibe la misma copia en el primer cambio). El borrador vive en un ref además del state
// porque el Svelte lo mutaba en el lugar y los handlers lo leen entre renders. Los `null` de TextField/NumberField se conservan (sólo con defaultValue).
// Se conserva que las acciones sobre opciones guardan sin marcar `existing` (el botón volver sigue visible mientras se crea).
interface OptionDraft {
    value: string
    isAnswer?: boolean
}
interface InputDraft {
    type?: string
    inputType?: string
    question?: string | null
    options?: OptionDraft[]
    randomize?: boolean
    answer?: string | number | null
    allowMultiple?: boolean
    min?: number | null
    max?: number | null
}

// Se guarda sólo con tipo y subtipo elegidos (siempre pasa antes de editar algo). `question` puede faltar hasta que se escribe: el Svelte guardaba el objeto suelto igual
function isStoredInput(draft: InputDraft): draft is StoredInput {
    return (draft.type === "heading" || draft.type === "text" || draft.type === "number" || draft.type === "multi_choice") && typeof draft.inputType === "string"
}

const emptyOption = (): OptionDraft => ({ value: "" })

function createTypes(): ChoiceOption[] {
    return [
        { id: "multi_choice", name: translateText("interaction.multi_choice"), icon: "multi_choice" },
        { id: "text", name: translateText("variables.text"), icon: "text" },
        { id: "number", name: translateText("variables.number"), icon: "number" },
        { id: "heading", name: translateText("interaction.heading"), icon: "info" }
    ]
}

function createInputTypes(): Record<string, ChoiceOption[]> {
    return {
        multi_choice: [
            { id: "buttons", name: translateText("interaction.buttons"), icon: "grid" },
            { id: "checkbox", name: translateText("interaction.checkboxes"), icon: "checkbox" },
            { id: "radio", name: translateText("interaction.radio_buttons"), icon: "radio_button" },
            { id: "dropdown", name: translateText("interaction.dropdown"), icon: "dropdown" }
        ],
        text: [
            // just text input (for now)
            { id: "input", name: translateText("interaction.input"), icon: "keyboard" }
        ],
        number: [
            { id: "input", name: translateText("interaction.input"), icon: "keyboard" },
            { id: "slider", name: translateText("interaction.slider"), icon: "slider" },
            { id: "number_range", name: translateText("interaction.range"), icon: "ruler" }
            // { id: "time_range", name: "Time range", icon: "ruler" }
        ],
        heading: [
            // { id: "none" }
        ]
    }
}

export function InteractionInput() {
    const [types] = useState(createTypes)
    const [inputTypes] = useState(createInputTypes)
    const [opened] = useState(() => {
        const data = get(popupData)
        const interactionId: string = data.id
        const index: number = data.inputIndex ?? -1
        const draft: InputDraft = clone(get(interactions)[interactionId]?.inputs?.[index] || {})
        return { interactionId, index, draft }
    })
    const draftRef = useRef(opened.draft)
    const inputIndex = useRef(opened.index)
    const [input, setInput] = useState(opened.draft)
    const [chosenType, setChosenType] = useState("")
    const [chosenInputType, setChosenInputType] = useState("")
    const [existing, setExisting] = useState(!!opened.draft.type)

    function setDraft(next: InputDraft) {
        draftRef.current = next
        setInput(next)
    }

    function updateInput(next: InputDraft) {
        interactions.update((a) => {
            const interaction = a[opened.interactionId]
            if (!interaction) return a
            if (!interaction.inputs) interaction.inputs = []

            const current = clone(next)
            if (!isStoredInput(current)) return a

            if (inputIndex.current === -1) {
                interaction.inputs.push(current)
                inputIndex.current = interaction.inputs.length - 1
            } else {
                interaction.inputs[inputIndex.current] = current
            }

            return a
        })
    }

    // cualquier clave que no sea type / inputType marca el input como existente y lo guarda
    function updateValue<K extends keyof InputDraft>(key: K, value: InputDraft[K]) {
        const next = { ...draftRef.current, [key]: value }
        setDraft(next)

        setExisting(true)
        updateInput(next)
    }

    // las opciones guardan sin marcar `existing`
    function updateOptions(options: OptionDraft[], extra: Partial<InputDraft> = {}) {
        const next = { ...draftRef.current, ...extra, options }
        setDraft(next)
        updateInput(next)
    }

    function chooseType(type: string) {
        setChosenType(type)
        let next: InputDraft = { ...draftRef.current, type }

        // just "input" for "text" type (for now)
        if (inputTypes[type]?.length < 2) {
            const inputType = inputTypes[type]?.[0]?.id || "none"
            setChosenInputType(inputType)
            next = { ...next, inputType }
        }

        setDraft(next)
    }

    function chooseInputType(inputType: string) {
        setChosenInputType(inputType)
        setDraft({ ...draftRef.current, inputType })
    }

    const options = input.options || []

    if (!existing && !chosenType) return <ChoiceGrid options={types} onClick={chooseType} />

    if (!existing && !chosenInputType) {
        return (
            <>
                <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setChosenType("")} />

                <ChoiceGrid options={inputTypes[input.type ?? ""]} onClick={chooseInputType} />
            </>
        )
    }

    return (
        <>
            {!existing ? (
                <Button
                    className="popup-back"
                    icon="back"
                    iconSize={1.3}
                    title="actions.back"
                    onClick={() => {
                        if (inputTypes[chosenType]?.length < 2) setChosenType("")
                        setChosenInputType("")
                    }}
                />
            ) : null}

            <TextField label={input.type === "heading" ? "interaction.heading" : "interaction.question"} style={input.type === "heading" ? undefined : { marginBottom: "10px" }} value={input.question ?? ""} onChange={(value) => updateValue("question", value)} autofocus={!input.question} />

            {input.type === "multi_choice" ? (
                <div className={styles.options}>
                    {options.map((option, i) => (
                        <InputRow key={i}>
                            <Button
                                title={option?.isAnswer ? "interaction.mark_as_incorrect" : "interaction.mark_as_correct"}
                                icon={option?.isAnswer ? "check" : "close"}
                                iconSize={1.2}
                                className={option?.isAnswer ? styles.correct : styles.incorrect}
                                onClick={() => {
                                    // mark as answer
                                    const next = (draftRef.current.options || []).map((a, index) => (index === i ? { ...a, isAnswer: !a.isAnswer } : a))
                                    updateOptions(next)
                                }}
                            />

                            <TextField
                                label="interaction.option"
                                value={option?.value ?? ""}
                                onChange={(value) => {
                                    const next = [...(draftRef.current.options || [])]
                                    next[i] = { ...(next[i] || emptyOption()), value: value ?? "" }
                                    updateOptions(next)
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && i === (draftRef.current.options?.length || 0) - 1) updateOptions([...(draftRef.current.options || []), emptyOption()])
                                }}
                                autofocus={!!input.question && !option?.value}
                            />
                            <Button icon="delete" title="actions.remove" onClick={() => updateOptions((draftRef.current.options || []).filter((_, index) => index !== i))} />
                        </InputRow>
                    ))}

                    <Button variant="outline" icon="add" disabled={options.length > 0 && options.some((a) => !a.value)} onClick={() => updateOptions([...(draftRef.current.options || []), emptyOption()])}>
                        <T id="interaction.add_option" />
                    </Button>

                    {options.length > 1 ? <ToggleField label="variables.randomize" style={{ marginTop: "10px" }} checked={input.randomize} defaultValue={false} onChange={(checked) => updateValue("randomize", checked)} /> : null}
                </div>
            ) : input.type === "text" ? (
                <>
                    {/* optional - for polls we don't need answers */}
                    <TextField label="interaction.answer (interaction.optional)" value={String(input.answer || "")} onChange={(value) => updateValue("answer", value)} />

                    <ToggleField label="interaction.allow_multiple" checked={input.allowMultiple} defaultValue={false} onChange={(checked) => updateValue("allowMultiple", checked)} />
                </>
            ) : input.type === "number" ? (
                <>
                    <NumberField label="interaction.answer (interaction.optional)" value={Number(input.answer ?? -1)} min={input.min ?? 0} max={input.max ?? 1000} onChange={(value) => updateValue("answer", value)} />

                    <InputRow>
                        <NumberField label="interaction.min" value={input.min ?? 0} min={-10000000} onChange={(value) => updateValue("min", value)} />
                        <NumberField label="interaction.max" value={input.max ?? 1000} max={10000000} onChange={(value) => updateValue("max", value)} />
                    </InputRow>
                </>
            ) : null}
        </>
    )
}
