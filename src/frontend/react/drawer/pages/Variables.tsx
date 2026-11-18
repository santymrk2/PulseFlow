import { Fragment, useEffect } from "react"
import type { Variable } from "../../../../types/Main"
import { activePopup, activeProfile, activeVariableTagFilter, disableDragging, labelsDisabled, randomNumberVariable, selected, variables } from "../../../stores"
import { translateText } from "../../../utils/language"
import { getAccess } from "../../../utils/profile"
import { resetVariable } from "../../../components/actions/apiHelper"
import { keysToID, sortByName } from "../../../components/helpers/array"
import { getSetChars, setRandomValue } from "../../../components/helpers/randomValue"
import { T } from "../../helpers/T"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Center } from "../../system/Center"
import { SelectElem } from "../../system/SelectElem"
import { Button } from "../../ui/button/Button"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { Input } from "../../ui/input/Input"
import { Stepper } from "../../ui/stepper/Stepper"
import { ToggleField } from "../../ui/toggle-field/ToggleField"
import styles from "./Variables.module.css"

// Port de components/drawer/pages/Variables.svelte: números, aleatorios, texto y conjuntos de texto.
const TYPE_ORDER: Record<string, number> = { number: 1, text: 2 }

const TYPE_NAMES = {
    number: "variables.number",
    randomNumber: "variables.random_number",
    text: "variables.text",
    text_set: "variables.text_set"
} as const

type TypeNameKey = (typeof TYPE_NAMES)[keyof typeof TYPE_NAMES]

const MIN_DEFAULT = 0
const MAX_DEFAULT = 1000

export function Variables() {
    const variablesValue = useStore(variables)
    const activeVariableTagFilterValue = useStore(activeVariableTagFilter)
    const randomNumberVariableValue = useStore(randomNumberVariable)
    const activeProfileValue = useStore(activeProfile)
    const labelsDisabledValue = useStore(labelsDisabled)

    const profile = (activeProfileValue ? getAccess("variables") : {}) as Record<string, string | undefined>
    const readOnly = profile.global === "read"

    const sortedVariables = sortByName(keysToID(variablesValue) as Variable[], "name", true).sort((a, b) => (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0))
    const filteredVariablesTags = sortedVariables.filter((a) => !activeVariableTagFilterValue.length || (a.tags?.length && !activeVariableTagFilterValue.find((tagId) => !a.tags?.includes(tagId)))).filter((a) => !a.tags?.some((tagId) => profile[tagId] === "none"))
    const filteredVariables = filteredVariablesTags

    function updateVariable(value: string | number | boolean, id: string, key: string) {
        variables.update((a) => {
            const record = a[id] as unknown as Record<string, unknown>
            record[key] = value
            return a
        })
    }

    // <svelte:window on:mousedown on:mouseup>
    useEffect(() => {
        function mousedown(e: MouseEvent) {
            const target = e.target instanceof Element ? e.target : null
            if (!target?.closest(".variables")) return
            if (target.tagName === "INPUT" || target.closest("button")) disableDragging.set(true)
        }
        function mouseup() {
            disableDragging.set(false)
        }

        window.addEventListener("mousedown", mousedown)
        window.addEventListener("mouseup", mouseup)
        return () => {
            window.removeEventListener("mousedown", mousedown)
            window.removeEventListener("mouseup", mouseup)
        }
    }, [])

    const numberVariables = filteredVariables.filter((a) => a.type === "number")
    const randomNumberVariables = filteredVariables.filter((a) => a.type === "random_number")
    const textSetVariables = filteredVariables.filter((a) => a.type === "text_set")
    const otherVariables = filteredVariables.filter((a) => a.type !== "number" && a.type !== "random_number" && a.type !== "text_set")

    const centeredRow = !(randomNumberVariables.length + textSetVariables.length + otherVariables.length)
    const centeredRowStyle = centeredRow ? { height: "calc(100% - 15px)", alignItems: "center" } : undefined

    return (
        <>
            <div className={`variables context #variables${readOnly ? "_readonly" : ""} ${styles.variables}`}>
                {filteredVariables.length ? (
                    <>
                        <div className={styles.row} style={centeredRowStyle}>
                            {numberVariables.map((variable) => {
                                const isReadOnly = readOnly || variable.tags?.some((tagId) => profile[tagId] === "read")
                                const number = Number(variable.number) || 0
                                const stepSize = Number(variable.step) || 1
                                const defaultValue = Number(variable.default) || 0
                                const min = Number(variable.minValue ?? MIN_DEFAULT)
                                const max = Number(variable.maxValue ?? MAX_DEFAULT)

                                return (
                                    <SelectElem key={variable.id} id="variable" data={variable} draggable style={{ width: "calc(25% - 5px)" }}>
                                        <div className={`${styles.variable} ${styles.numberBox} context #variable${isReadOnly ? "_readonly" : ""}`}>
                                            <div className={styles.reset}>
                                                <Button align="start" title={translateText("actions.reset")} onClick={() => updateVariable(defaultValue, variable.id || "", "number")}>
                                                    <Icon id="reset" white />
                                                </Button>
                                            </div>

                                            <div className={styles.bigNumber}>
                                                <Stepper title={translateText("variables.value")} style={{ width: "100%" }} value={number} min={min} max={max} step={stepSize} decimals={1} fixed={number.toString().includes(".") ? 1 : 0} buttons={false} onChange={(value) => updateVariable(value, variable.id || "", "number")} />
                                            </div>

                                            <span style={{ justifyContent: "center", padding: 5, width: "100%" }}>
                                                <Icon id={variable.type} right />
                                                <p data-title={variable.name}>
                                                    {variable.name?.length ? (
                                                        variable.name
                                                    ) : (
                                                        <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                                                            <T id="main.unnamed" />
                                                        </span>
                                                    )}
                                                </p>
                                            </span>

                                            <div className={styles.buttons}>
                                                <Button id="decrement" title={translateText("actions.decrement")} onClick={() => updateVariable(Math.max(min, number - 1 * stepSize), variable.id || "", "number")} style={{ flex: 1 }} disabled={number <= min}>
                                                    <Icon id="remove" size={2.8} white />
                                                </Button>
                                                <Button id="increment" title={translateText("actions.increment")} onClick={() => updateVariable(Math.min(max, number + 1 * stepSize), variable.id || "", "number")} style={{ flex: 1 }} disabled={number >= max}>
                                                    <Icon id="add" size={2.8} white />
                                                </Button>
                                            </div>

                                            <div className={styles.inputs}>
                                                <Stepper title={translateText("variables.step")} style={{ flex: 1 }} value={stepSize} min={0.1} step={1} decimals={1} fixed={stepSize.toString().includes(".") ? 1 : 0} onChange={(value) => updateVariable(value, variable.id || "", "step")} buttons={false} />
                                            </div>
                                        </div>
                                    </SelectElem>
                                )
                            })}
                        </div>

                        {numberVariables.length && randomNumberVariables.length ? (
                            <h5>
                                <T id={TYPE_NAMES.randomNumber} />
                            </h5>
                        ) : null}

                        <div className={styles.row} style={centeredRowStyle}>
                            {randomNumberVariables.map((variable) => {
                                const number = Number(variable.number) || 0

                                return (
                                    <SelectElem key={variable.id} style={{ minWidth: "calc(25% - 5px)" }} id="variable" data={variable} draggable>
                                        <div className={`${styles.variable} ${styles.numberBox} context #variable${readOnly ? "_readonly" : ""}`}>
                                            <div className={styles.reset}>
                                                <Button align="start" disabled={!variable.setLog?.length || randomNumberVariableValue[variable.id || ""]} title={translateText("actions.reset")} onClick={() => resetVariable(variable.id || "")}>
                                                    <Icon id="reset" white />
                                                </Button>
                                            </div>

                                            <div className={styles.bigNumber}>{number.toString().padStart(getSetChars(variable.sets), "0")}</div>

                                            {(variable.sets?.length || 0) > 1 ? (
                                                <span style={{ justifyContent: "center", padding: 5, width: "100%" }}>
                                                    <p>{variable.setName || "—"}</p>
                                                </span>
                                            ) : null}

                                            <span style={{ justifyContent: "center", padding: 5, width: "100%" }}>
                                                <Icon id="unknown" right />
                                                <p data-title={variable.name}>
                                                    {variable.name?.length ? (
                                                        variable.name
                                                    ) : (
                                                        <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                                                            <T id="main.unnamed" />
                                                        </span>
                                                    )}
                                                </p>
                                            </span>

                                            <div className={styles.buttons}>
                                                <Button disabled={randomNumberVariableValue[variable.id || ""]} id="randomize" title={translateText("variables.randomize")} onClick={() => setRandomValue(variable.id || "")} style={{ flex: 1 }}>
                                                    <Icon id="shuffle_play" size={2.8} white />
                                                </Button>
                                            </div>
                                        </div>
                                    </SelectElem>
                                )
                            })}
                        </div>

                        {numberVariables.length + randomNumberVariables.length && otherVariables.length ? (
                            <h5>
                                <T id={TYPE_NAMES.text} />
                            </h5>
                        ) : null}

                        <div className={styles.list}>
                            {otherVariables.map((variable, i) => {
                                const title: TypeNameKey | "" = variable.type === otherVariables[i - 1]?.type ? "" : TYPE_NAMES[variable.type as keyof typeof TYPE_NAMES]

                                return (
                                    <Fragment key={variable.id}>
                                        {title && i > 0 ? (
                                            <h5>
                                                <T id={title} />
                                            </h5>
                                        ) : null}

                                        <SelectElem id="variable" data={variable} draggable>
                                            <div className={`${styles.variable} context #variable${readOnly ? "_readonly" : ""}`}>
                                                <span style={{ paddingInlineStart: 5 }}>
                                                    <Icon id={variable.type === "text_set" ? "increase_text" : variable.type} right />
                                                    <p>
                                                        {variable.name?.length ? (
                                                            variable.name
                                                        ) : (
                                                            <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                                                                <T id="main.unnamed" />
                                                            </span>
                                                        )}
                                                    </p>
                                                </span>

                                                <span style={{ gap: 5, width: "70%" }}>
                                                    {variable.type === "text" ? (
                                                        <>
                                                            <Input placeholder={translateText("variables.value") || ""} value={variable.text || ""} onChange={(e) => updateVariable((e.target as HTMLInputElement).value, variable.id || "", "text")} />
                                                            <ToggleField label="" checked={variable.enabled ?? true} style={{ padding: 8, height: 35 }} onChange={(checked) => updateVariable(checked, variable.id || "", "enabled")} />
                                                        </>
                                                    ) : null}
                                                </span>
                                            </div>
                                        </SelectElem>
                                    </Fragment>
                                )
                            })}
                        </div>

                        {numberVariables.length + randomNumberVariables.length + otherVariables.length && textSetVariables.length ? (
                            <h5>
                                <T id={TYPE_NAMES.text_set} />
                            </h5>
                        ) : null}

                        <div className={styles.list}>
                            {textSetVariables.map((variable) => {
                                const activeSet = variable.activeTextSet ?? 0

                                return (
                                    <SelectElem key={variable.id} id="variable" data={variable} draggable>
                                        <div className={`${styles.variable} context #variable${readOnly ? "_readonly" : ""}`}>
                                            <span style={{ paddingInlineStart: 5 }}>
                                                <Icon id="increase_text" right />
                                                <p style={{ display: "flex", gap: 8 }}>
                                                    {variable.name?.length ? (
                                                        variable.name
                                                    ) : (
                                                        <span style={{ opacity: 0.5, fontStyle: "italic" }}>
                                                            <T id="main.unnamed" />
                                                        </span>
                                                    )}

                                                    {(variable.textSetKeys?.length ?? 1 > 1) ? <span style={{ opacity: 0.5, fontSize: "0.8em" }}>{variable.textSetKeys?.length ?? 1}</span> : null}
                                                </p>
                                            </span>

                                            <span style={{ gap: 5, width: "70%" }}>
                                                <p style={{ display: "flex", flex: 1 }}>
                                                    <span style={{ color: "var(--secondary)" }}>#</span>
                                                    <Stepper title={translateText("variables.number")} style={{ width: 40 }} value={activeSet + 1} min={1} max={variable.textSets?.length ?? 1} onChange={(value) => updateVariable(Number(value) - 1, variable.id || "", "activeTextSet")} buttons={false} />
                                                    <span style={{ fontSize: "0.8em", opacity: 0.5 }}>/{variable.textSets?.length || 1}</span>
                                                </p>

                                                <Button align="start" disabled={activeSet === 0} onClick={() => updateVariable(Math.max(activeSet - 1, 0), variable.id || "", "activeTextSet")}>
                                                    <Icon id="back" right />
                                                    <T id="media.previous" />
                                                </Button>
                                                <Button align="start" disabled={activeSet === (variable.textSets?.length ?? 1) - 1} onClick={() => updateVariable(Math.min(activeSet + 1, (variable.textSets?.length ?? 1) - 1), variable.id || "", "activeTextSet")}>
                                                    <Icon id="arrow_forward" right />
                                                    <T id="media.next" />
                                                </Button>
                                            </span>
                                        </div>
                                    </SelectElem>
                                )
                            })}
                        </div>
                    </>
                ) : (
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                )}
            </div>

            <FloatingBar onlyOne>
                <Button
                    disabled={readOnly}
                    icon="add"
                    title="new.variable"
                    onClick={() => {
                        selected.set({ id: null, data: [] })
                        activePopup.set("variable")
                    }}
                >
                    {!labelsDisabledValue ? <T id="new.variable" /> : null}
                </Button>
            </FloatingBar>
        </>
    )
}
