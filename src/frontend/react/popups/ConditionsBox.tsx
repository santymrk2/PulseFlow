import { Fragment } from "react"
import { audioRouting, timers } from "../../stores"
import { clone, sortByName } from "../../components/helpers/array"
import { getDynamicIds, getVariablesIds } from "../../components/helpers/showActions"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { useStore } from "../hooks/useStore"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { TextField } from "../ui/text-field/TextField"
import styles from "./ConditionsBox.module.css"

// Port de components/main/popups/ConditionsBox.svelte. Lee: input (un contenido de condición), timers y audioRouting.
// Emite onChange({ key, value }) = dispatch("change", { key, value }). El valor es lo que entrega cada campo (texto, número o null);
// ConditionValue dice `string`, pero el Svelte ya guardaba números (index, seconds).
export type ConditionChange = { key: string; value: string | number | null }

interface ConditionsBoxProps {
    input: { [key: string]: string }
    onChange?: (change: ConditionChange) => void
}

type Option = { value: string; label: string }

function convertToOptions(object: Record<string, { name?: string }>): Option[] {
    const options = Object.keys(object).map((id) => ({ value: id, label: object[id].name ?? "" }))
    return sortByName(options, "label")
}

function getVariables(): Option[] {
    return getVariablesIds().map((id) => {
        let name = id.replace("$", "").replace("variable_set_", "Set: ").replaceAll("__", ": ").replaceAll("_", " ")
        name = name[0].toUpperCase() + name.slice(1)
        return { value: id, label: name }
    })
}

export function ConditionsBox({ input, onChange }: ConditionsBoxProps) {
    const timersValue = useStore(timers)
    const audioRoutingValue = useStore(audioRouting)

    const conditionValues = {
        element: [
            { value: "text", label: translateText("edit.text") },
            { value: "timer", label: translateText("items.timer") },
            { value: "variable", label: translateText("items.variable") },
            { value: "dynamicValue", label: translateText("actions.dynamic_value") },
            { value: "volume", label: translateText("media.volume") }
        ],
        operator: [
            { value: "is", label: translateText("conditions.is") },
            { value: "isNot", label: translateText("conditions.is_not") },
            { value: "has", label: translateText("conditions.has") },
            { value: "hasNot", label: translateText("conditions.has_not") }
        ],
        data: [{ value: "value", label: translateText("conditions.value") }]
    }
    const numberOperators = [
        { value: "isAbove", label: translateText("conditions.is_above") },
        { value: "isBelow", label: translateText("conditions.is_below") }
    ]

    const customOperators: Record<string, Option[]> = {
        timer: [{ value: "isRunning", label: translateText("conditions.is_running") }, ...clone(numberOperators), { value: "is", label: translateText("conditions.is") }, { value: "isNot", label: translateText("conditions.is_not") }],
        variable: [...clone(conditionValues.operator), ...clone(numberOperators)],
        dynamicValue: [...clone(conditionValues.operator), ...clone(numberOperators)],
        volume: [
            { value: "isAbove", label: translateText("conditions.is_above") },
            { value: "isBelow", label: translateText("conditions.is_below") },
            { value: "is", label: translateText("conditions.is") },
            { value: "isNot", label: translateText("conditions.is_not") }
        ]
    }
    const customData: Record<string, Option[]> = {
        timer: [{ value: "seconds", label: translateText("conditions.seconds") }]
    }
    const noData: string[] = ["isRunning"]

    const elementId = input.element ?? conditionValues.element[0]?.value
    const operatorOptions = customOperators[elementId] ? customOperators[elementId] : conditionValues.operator
    const operatorId = input.operator ? input.operator : operatorOptions[0]?.value

    const channelNodesList = (audioRoutingValue?.channels || [{ id: "main", name: translateText("audio.main") }]).map((c) => ({
        value: c.id,
        label: c.name || (c.id === "main" ? translateText("audio.main") : c.id)
    }))

    const elementOptions: Record<string, Option[]> = {
        timer: [{ value: "", label: translateText("stage.first_active_timer") }, ...convertToOptions(timersValue)],
        variable: getVariables(),
        dynamicValue: getDynamicIds(true).map((a) => ({ value: a, label: a })),
        volume: channelNodesList
    }

    function setValue(conditionId: string, value: string | number | null) {
        if (conditionId === "value" && value === "empty") newToast("Did you mean to leave as empty/blank value?")

        onChange?.({ key: conditionId, value })
    }

    return (
        <div className={styles.box}>
            {Object.entries(conditionValues).map(([conditionId, condition]) => {
                if (!((conditionId === "element" || input.element) && (conditionId !== "data" || !noData.includes(operatorId)))) return null

                const options: Option[] = conditionId === "operator" ? operatorOptions : conditionId === "data" && customData[elementId] ? customData[elementId] : condition
                const value = options.find((a) => a.value === input[conditionId]) || options[0]
                const label = conditionId === "operator" ? "actions.mode" : conditionId === "data" ? "variables.value" : "sort.type"

                return (
                    <Fragment key={conditionId}>
                        {conditionId !== "data" || options.length > 1 ? <SelectField label={label} options={options} value={(conditionId === "element" ? input[conditionId] : value?.value) ?? ""} onChange={(v) => setValue(conditionId, v)} /> : null}

                        {conditionId === "element" && elementOptions[value.value] ? (
                            <>
                                <SelectField label="tools.item" options={elementOptions[value.value]} value={input.elementId ?? ""} onChange={(v) => setValue("elementId", v)} />

                                {/* 0 = active */}
                                {input.element === "variable" && input.elementId?.includes("__") ? <NumberField label="variables.number" value={Number(input.index ?? 0)} onChange={(v) => setValue("index", v)} /> : null}
                            </>
                        ) : null}

                        {conditionId === "data" && value.value === "value" ? <TextField label="variables.value" placeholder={input.element === "volume" ? "-60 → 0" : translateText("conditions.empty")} value={typeof input.value === "string" ? input.value : ""} onChange={(v) => setValue("value", v)} /> : null}
                        {conditionId === "data" && value.value === "seconds" ? <NumberField label="timer.seconds" value={typeof input.seconds === "number" ? input.seconds : 0} max={800000} onChange={(v) => setValue("seconds", v)} /> : null}
                    </Fragment>
                )
            })}
        </div>
    )
}
