import { variables } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { sortByName } from "../../../shared/utils/helpers/array"
import { useStore } from "../../hooks/useStore"
import { SelectField } from "../../ui/select-field/SelectField"
import { NumberField } from "../../ui/number-field/NumberField"
import { TextField } from "../../ui/text-field/TextField"
import { InputRow } from "../../ui/input-row/InputRow"

interface VariableValue {
    id?: string
    key?: string
    value?: unknown
    setId?: string
    text_set?: string
    text_set_number?: number
}

export interface VariableInputsProps {
    value: VariableValue
    onUpdate?: (detail: { key: string; value: unknown }) => void
}

function convertToOptions(a: Record<string, { name?: string; type?: string }>) {
    const options = Object.keys(a).map((id) => ({ value: id, label: a[id].name || "", data: translateText(`variables.${a[id].type}`) }))
    return sortByName(options, "label")
}

const stateOptions = [
    { value: "", label: "Toggle" },
    { value: "off", label: "Off" },
    { value: "on", label: "On" }
]

export function VariableInputs({ value, onUpdate }: VariableInputsProps) {
    const currentVariables = useStore(variables)
    const variableOptions = convertToOptions(currentVariables)
    const variable = value?.id ? currentVariables[value.id] : undefined
    const currentType = variable?.type as string | undefined

    const variableModes: Record<string, { value: string; label: string }[]> = {
        text: [
            { value: "enabled", label: translateText("variables.set_state") },
            { value: "value", label: translateText("variables.value") }
        ],
        number: [
            { value: "value", label: translateText("variables.value") },
            { value: "increment", label: translateText("actions.increment") },
            { value: "decrement", label: translateText("actions.decrement") },
            { value: "expression", label: translateText("actions.expression") }
        ],
        random_number: [
            { value: "randomize", label: translateText("variables.randomize") },
            { value: "reset", label: translateText("actions.reset") }
        ],
        text_set: [
            { value: "next", label: translateText("media.next") },
            { value: "previous", label: translateText("media.previous") },
            { value: "value", label: translateText("variables.number") },
            { value: "text_set", label: translateText("variables.value") }
        ]
    }

    const defaultMode: Record<string, string> = {
        text: "enabled",
        number: "value",
        random_number: "randomize",
        text_set: "next"
    }

    function updateValue(key: string, v: unknown) {
        onUpdate?.({ key, value: v })
        if (key === "id") {
            onUpdate?.({ key: "key", value: undefined })
            onUpdate?.({ key: "value", value: undefined })
        }
    }

    function textStateChange(next: string | null) {
        let v: unknown = undefined
        if (next === "off") v = false
        else if (next === "on") v = true
        else v = undefined
        onUpdate?.({ key: "value", value: v })
    }

    return (
        <>
            <SelectField label="items.variable" options={variableOptions} value={value?.id || ""} onChange={(v) => updateValue("id", v ?? "")} />

            {value?.id ? (
                <InputRow>
                    <SelectField label="actions.mode" options={(currentType && variableModes[currentType]) || []} value={String(value?.key || (currentType ? (defaultMode[currentType] || "") : ""))} onChange={(v) => updateValue("key", v ?? "")} />

                    {value?.key === "value" || variable?.type === "number" ? (
                        (variable?.type === "number" && value?.key !== "expression") || variable?.type === "text_set" ? (
                            <NumberField label="variables.value" value={!isNaN(Number(value?.value)) ? Number(value?.value || "1") : 1} step={1} onChange={(v) => updateValue("value", v)} />
                        ) : (
                            <TextField label="variables.value" value={isNaN(Number(value?.value)) ? String(value?.value || "") : ""} placeholder={value?.key === "expression" ? "Use math & dynamic variable values" : ""} onChange={(v) => updateValue("value", v)} />
                        )
                    ) : variable?.type === "text" ? (
                        <SelectField label="variables.value" options={stateOptions} value={typeof value?.value === "boolean" ? (value.value ? "on" : "off") : ""} onChange={textStateChange} />
                    ) : variable?.type === "text_set" && value?.key === "text_set" ? (
                        <>
                            <SelectField label="variables.text_set" options={((variable as { textSetKeys?: string[] }).textSetKeys || []).map((name) => ({ value: name, label: name }))} value={((variable as { textSetKeys?: string[] }).textSetKeys || []).find((name) => name === value?.text_set) || ""} onChange={(v) => updateValue("text_set", v ?? "")} />
                            <NumberField label="variables.number" value={value?.text_set_number ?? 1} onChange={(v) => updateValue("text_set_number", v)} />
                            <TextField label="variables.value" value={String(value?.value || "")} onChange={(v) => updateValue("value", v)} />
                        </>
                    ) : null}
                </InputRow>
            ) : null}
        </>
    )
}
