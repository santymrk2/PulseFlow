import { useEffect, useState, type KeyboardEvent } from "react"
import { get } from "../../lib/store"
import { uid } from "uid"
import type { Variable } from "../../../types/Main"
import { clone, moveToPos } from "../../components/helpers/array"
import { createStore, updateStore } from "../../components/helpers/historyStores"
import { activePopup, drawerTabsData, selected, variables } from "../../stores"
import { translateText } from "../../utils/language"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { ChoiceGrid } from "../ui/choice-grid/ChoiceGrid"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { TextField } from "../ui/text-field/TextField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./Variable.module.css"

// Port de components/main/popups/Variable.svelte. Lee: selected (al montar), variables, drawerTabsData; escribe variables (createStore/updateStore)
// y activePopup = null con Enter en el nombre de una variable de texto. Se conserva el console.log heredado de minValue.
const DEFAULT_VARIABLE = { name: "", type: "number" } as Variable
const DEFAULT_SET = { name: "", minValue: 1, maxValue: 1000 }
const MIN_ABSOLUTE = -10000000
const MAX_ABSOLUTE = 10000000
const MIN_DEFAULT = 0
const MAX_DEFAULT = 1000

export function Variable() {
    const [existing, setExisting] = useState(() => get(selected).id === "variable" && !!get(selected).data[0]?.id)
    const [variableId] = useState(() => (get(selected).id === "variable" && get(selected).data[0]?.id ? get(selected).data[0].id : uid()))
    const [currentVariable, setCurrentVariable] = useState<Variable>(() => clone(get(variables)[variableId] || DEFAULT_VARIABLE))
    const [chosenType, setChosenType] = useState("")
    const [showMoreRN, setShowMoreRN] = useState(false)

    const types = [
        { id: "number", name: translateText("variables.number"), icon: "number" },
        { id: "random_number", name: translateText("variables.random_number"), icon: "unknown" },
        { id: "text", name: translateText("variables.text"), icon: "text" },
        { id: "text_set", name: translateText("variables.text_set"), icon: "increase_text" }
    ]
    const min = Number(currentVariable.minValue ?? MIN_DEFAULT)
    const max = Number(currentVariable.maxValue ?? MAX_DEFAULT)

    useEffect(() => {
        console.log(currentVariable.minValue)
    }, [currentVariable.minValue])

    function applyValue(source: Variable, raw: unknown, key: string): Variable {
        const value = raw
        if (value === undefined || value === null) return source

        const next: Record<string, unknown> = { ...source }
        if (key === "default" && Number(source.number || 0) === Number(source.default || 0)) next.number = Number(value)
        if (key === "minValue") {
            if (Number(source.default || 0) < Number(value)) Object.assign(next, applyValue(source, value, "default"))
            if (max < Number(value)) Object.assign(next, applyValue(source, value, "maxValue"))
        }
        if (key === "maxValue") {
            if (Number(source.default || 0) > Number(value)) Object.assign(next, applyValue(source, value, "default"))
            if (min > Number(value)) Object.assign(next, applyValue(source, value, "minValue"))
        }

        if (key === "name") {
            let name = String(value)
            let match: [string, Variable] | undefined
            do {
                match = Object.entries(get(variables)).find(([id, a]) => id !== variableId && name.toLowerCase() === a.name.toLowerCase())
                if (match) name += " 2"
            } while (match)
            next.name = name
        } else {
            next[key] = value
        }

        return next as unknown as Variable
    }

    function updateValue(value: unknown, key: string) {
        const next = applyValue(currentVariable, value, key)
        setCurrentVariable(next)
        if (key === "type") return

        if (existing) {
            updateStore("variables", variableId, next)
        } else {
            if (get(drawerTabsData).functions?.activeSubTab === "variables" && get(drawerTabsData).functions?.activeSubmenu) {
                next.tags = [get(drawerTabsData).functions!.activeSubmenu!]
            }
            createStore("variables", next, variableId)
            setExisting(true)
        }
    }

    function saveVariable(next: Variable) {
        setCurrentVariable(next)
        variables.update((a) => {
            a[variableId] = next
            return a
        })
    }

    function updateSet(index: number, value: unknown, key: string) {
        if (typeof value !== "number" && !value) return

        const next = clone(currentVariable)
        if (!next.sets) next.sets = []
        if (!next.sets[index]) next.sets[index] = { ...DEFAULT_SET }
        ;(next.sets[index] as Record<string, unknown>)[key] = value
        saveVariable(next)
    }

    function duplicateSet(index: number) {
        if (!currentVariable.sets?.[index]) return
        const next = clone(currentVariable)
        const variable = { ...next.sets![index], name: `${next.sets![index].name} 2` }
        next.sets!.splice(index + 1, 0, variable)
        saveVariable(next)
    }

    function removeSet(index: number) {
        if (!currentVariable.sets?.[index]) return
        const next = clone(currentVariable)
        next.sets!.splice(index, 1)
        saveVariable(next)
    }

    function addTextSet() {
        const next = clone(currentVariable)
        if (!next.textSets) next.textSets = [{}]
        next.textSets.push({})
        saveVariable(next)
    }

    function moveTextSetUp(index: number) {
        if (currentVariable.textSets?.[index] === undefined) return
        const next = clone(currentVariable)
        next.textSets = moveToPos(next.textSets!, index, index - 1)
        saveVariable(next)
    }

    function removeTextSet(index: number) {
        if (currentVariable.textSets?.[index] === undefined) return
        const next = clone(currentVariable)
        next.textSets!.splice(index, 1)
        saveVariable(next)
    }

    function addTextSetVariable() {
        const next = clone(currentVariable)
        if (!next.textSetKeys) next.textSetKeys = [""]
        next.textSetKeys.push("")
        saveVariable(next)
    }

    function moveKeyUp(index: number) {
        if (currentVariable.textSetKeys?.[index] === undefined) return
        const next = clone(currentVariable)
        next.textSetKeys = moveToPos(next.textSetKeys!, index, index - 1)
        saveVariable(next)
    }

    function removeTextSetVariable(index: number) {
        if (currentVariable.textSetKeys?.[index] === undefined) return
        const next = clone(currentVariable)
        next.textSetKeys!.splice(index, 1)
        saveVariable(next)
    }

    function updateTextSetVariableName(index: number, value: string | null) {
        const next = clone(currentVariable)
        if (!next.textSetKeys) next.textSetKeys = [""]

        let name = value || ""
        while (next.textSetKeys.find((item, i) => i !== index && item === name)) name += " 2"
        next.textSetKeys[index] = name
        saveVariable(next)
    }

    function textSetKeydown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Tab" && e.currentTarget.value) addTextSetVariable()
    }

    function updateTextSetValue(index: number, name: string, value: string | null) {
        const next = clone(currentVariable)
        if (!next.textSets) next.textSets = [{}]
        if (!next.textSets[index]) next.textSets[index] = {}
        next.textSets[index][name] = value || ""
        saveVariable(next)
    }

    function resetTextSetValues() {
        if (!currentVariable.textSets) return
        saveVariable({ ...currentVariable, textSets: currentVariable.textSets.map(() => ({})) })
    }

    function nameKeydown(e: KeyboardEvent<HTMLInputElement>) {
        if (currentVariable.type === "text" && e.key === "Enter" && e.currentTarget.value) activePopup.set(null)
    }

    if (!existing && !chosenType) {
        return (
            <ChoiceGrid
                options={types}
                onClick={(id) => {
                    setChosenType(id)
                    updateValue(id, "type")
                }}
            />
        )
    }

    return (
        <>
            {!existing ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => setChosenType("")} /> : null}

            <TextField label="inputs.name" style={{ marginBottom: "10px" }} disabled={!existing && !!currentVariable.name} value={currentVariable.name} onChange={(value) => updateValue(value, "name")} autofocus={!currentVariable.name} onKeyDown={nameKeydown} />

            {currentVariable.type === "number" ? (
                <>
                    <NumberField label="variables.default_value" value={currentVariable.default || 0} step={1} min={min} max={max} onChange={(value) => updateValue(value, "default")} />
                    <InputRow>
                        <NumberField label="variables.minimum" value={currentVariable.minValue ?? MIN_DEFAULT} step={1} min={MIN_ABSOLUTE} max={MAX_ABSOLUTE} onChange={(value) => updateValue(value, "minValue")} />
                        <NumberField label="variables.maximum" value={currentVariable.maxValue ?? MAX_DEFAULT} step={1} min={MIN_ABSOLUTE} max={MAX_ABSOLUTE} onChange={(value) => updateValue(value, "maxValue")} />
                    </InputRow>
                </>
            ) : currentVariable.type === "random_number" ? (
                <>
                    <Button className={`popup-options ${showMoreRN ? "active" : ""}`} icon="options" iconSize={1.3} title={showMoreRN ? "actions.close" : "create_show.more_options"} onClick={() => setShowMoreRN(!showMoreRN)} white />

                    {showMoreRN ? (
                        <>
                            <ToggleField label="edit.each_number_once" checked={currentVariable.eachNumberOnce} defaultValue={false} onChange={(value) => updateValue(value, "eachNumberOnce")} />

                            <InputRow>
                                <ToggleField label="popup.animate" checked={currentVariable.animate} defaultValue={false} style={{ flex: 1 }} onChange={(value) => updateValue(value, "animate")} />
                                {currentVariable.animate ? <ToggleField label="edit.towards_result" checked={currentVariable.animateTowardsResult} defaultValue={false} style={{ flex: 1 }} onChange={(value) => updateValue(value, "animateTowardsResult")} /> : null}
                            </InputRow>
                            {currentVariable.animate ? (
                                <InputRow>
                                    <NumberField label="transition.duration (s)" value={currentVariable.animationDuration ?? 3} step={0.1} min={0.1} max={10} defaultValue={3} onChange={(value) => updateValue(value, "animationDuration")} />
                                </InputRow>
                            ) : null}

                            <HRule />
                        </>
                    ) : null}

                    {(currentVariable.sets || [DEFAULT_SET]).map((set, i) => (
                        <InputRow key={i} style={{ borderRadius: "4px", overflow: "hidden" }}>
                            {(currentVariable.sets?.length || 0) > 1 ? (
                                <>
                                    <span style={{ backgroundColor: "var(--primary-darker)", fontWeight: "bold", fontSize: "0.8em", display: "flex", alignItems: "center", padding: "0 10px" }}>
                                        <span style={{ color: "var(--secondary)", display: "flex", alignItems: "center" }}>#</span>
                                        {i + 1}
                                    </span>
                                    <TextField label="inputs.name" style={{ flex: 2 }} value={set.name} onChange={(value) => updateSet(i, value, "name")} autofocus={!!currentVariable.name && !set.name} />
                                </>
                            ) : null}

                            <NumberField label="variables.minimum" style={{ flex: 1 }} value={set.minValue ?? DEFAULT_SET.minValue} step={1} min={0} max={MAX_ABSOLUTE} onChange={(value) => updateSet(i, value, "minValue")} />
                            <NumberField label="variables.maximum" style={{ flex: 1 }} value={set.maxValue ?? DEFAULT_SET.maxValue} step={1} min={0} max={MAX_ABSOLUTE} onChange={(value) => updateSet(i, value, "maxValue")} />
                            {(currentVariable.sets?.length || 1) > 1 ? (
                                <>
                                    <Button icon="duplicate" title="actions.duplicate" onClick={() => duplicateSet(i)} />
                                    <Button icon="delete" title="actions.delete" onClick={() => removeSet(i)} red />
                                </>
                            ) : null}
                        </InputRow>
                    ))}

                    <Button
                        variant="outline"
                        icon="add"
                        onClick={() => {
                            if (!currentVariable.sets) updateSet(0, DEFAULT_SET.minValue, "minValue")
                            updateSet(currentVariable.sets?.length || 0, DEFAULT_SET.minValue, "minValue")
                        }}
                    >
                        <T id="variables.add_set" />
                    </Button>

                    {currentVariable.setLog?.length ? (
                        <>
                            <HRule title="popup.history" />

                            <div style={{ overflow: "auto", maxHeight: "250px" }}>
                                {currentVariable.setLog.map((log, i) => (
                                    <InputRow key={i} style={{ borderRadius: "4px", overflow: "hidden", backgroundColor: "var(--primary-darker)", borderBottom: "1px solid var(--primary-lighter)" }}>
                                        {(currentVariable.sets?.length || 0) > 1 ? <p style={{ width: "30%", minWidth: "initial", padding: "6px 10px" }}>{log.name}</p> : null}
                                        <p style={{ borderLeft: "1px solid var(--primary-lighter)", padding: "6px 10px" }}>{log.number}</p>
                                    </InputRow>
                                ))}
                            </div>
                        </>
                    ) : null}
                </>
            ) : currentVariable.type === "text_set" ? (
                <>
                    <Button className="popup-options" icon="reset" iconSize={1.1} title="actions.reset" onClick={resetTextSetValues} white />

                    {(currentVariable.textSets?.length ? currentVariable.textSets : [{}]).map((textSet, i) => (
                        <div key={i} className={`${styles.text_set} ${(currentVariable.textSets?.length ?? 1) > 1 && (currentVariable.activeTextSet ?? 0) === i ? styles.active : ""}`} style={i === 0 ? undefined : { marginTop: "10px" }}>
                            <p style={{ borderBottom: "1px solid var(--primary-lighter)" }} className={styles.part}>
                                <span style={{ color: "var(--secondary)" }}>#</span>
                                {i + 1}
                            </p>

                            {(currentVariable.textSetKeys ?? [""]).map((key, keyIndex) => (
                                <InputRow key={keyIndex}>
                                    {i === 0 ? <TextField label="inputs.name" disabled={!!(key && textSet?.[key]) || i > 0} value={key} onInput={(value) => updateTextSetVariableName(keyIndex, value)} onKeyDown={textSetKeydown} /> : <p style={{ width: "50%", display: "flex", alignItems: "center", padding: "0 10px", borderBottom: "1px solid var(--primary-lighter)" }}>{key}</p>}

                                    <TextField label="variables.value" disabled={!key} value={textSet[key] || ""} onChange={(value) => updateTextSetValue(i, key, value)} />

                                    {(currentVariable.textSetKeys?.length ?? 1) > 1 && i === 0 ? (
                                        <>
                                            {keyIndex > 0 ? <Button icon="up" onClick={() => moveKeyUp(keyIndex)} /> : null}
                                            <Button icon="delete" title="actions.delete" onClick={() => removeTextSetVariable(keyIndex)} />
                                        </>
                                    ) : null}
                                </InputRow>
                            ))}

                            {i === 0 ? (
                                <Button style={{ width: "100%" }} icon="add" disabled={!currentVariable.textSetKeys?.length || currentVariable.textSetKeys.find((a) => !a) === ""} onClick={addTextSetVariable}>
                                    <T id="new.variable" />
                                </Button>
                            ) : null}
                            {i > 0 ? (
                                <div className={styles.delete}>
                                    <Button style={{ padding: "8px" }} icon="up" onClick={() => moveTextSetUp(i)} />
                                    <Button style={{ padding: "8px" }} icon="delete" title="actions.delete" onClick={() => removeTextSet(i)} />
                                </div>
                            ) : null}
                        </div>
                    ))}

                    <Button variant="outline" style={{ marginTop: "10px", width: "100%" }} icon="add" disabled={!currentVariable.textSets?.length} onClick={addTextSet}>
                        <T id="variables.add_set" />
                    </Button>
                </>
            ) : null}
        </>
    )
}
