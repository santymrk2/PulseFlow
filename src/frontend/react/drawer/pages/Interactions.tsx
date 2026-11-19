import { useEffect, useState } from "react"
import { uid } from "uid"
import type { Interaction, InteractionInput } from "../../../../types/Main"
import { activeInteractions, activePopup, activeRename, interactions, labelsDisabled, openedInteractionId, popupData } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { clone, keysToID, sortByName } from "../../../shared/utils/helpers/array"
import { formatTimeInteraction, getInteraction, initConnection, startInteraction, stopInteraction } from "../../../components/drawer/pages/interactions"
import { T } from "../../../shared/ui/helpers/T"
import { Icon } from "../../../shared/ui/helpers/Icon"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { SelectElem } from "../../../shared/ui/system/SelectElem"
import { Button } from "../../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../../shared/ui/kit/floating-bar/FloatingBar"
import { HiddenInput } from "../../../shared/ui/kit/hidden-input/HiddenInput"
import { InputRow } from "../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../../shared/ui/kit/select-field/SelectField"
import { ToggleField } from "../../../shared/ui/kit/toggle-field/ToggleField"
import styles from "./Interactions.module.css"

// Port de components/drawer/pages/Interactions.svelte: lista de interacciones y editor de la abierta (inputs, opciones, historial y jugadores).
type InputView = InteractionInput & { answer?: string | number; options?: { value: string; isAnswer?: boolean }[] }
type AnswerValue = { value: unknown; time?: number }
type Answers = Record<string, AnswerValue>[]
type Client = { id?: string; name?: string; score?: number }
type InteractionWithId = Interaction & { id: string }

const INPUT_TYPE_ICONS: Record<string, string> = {
    buttons: "grid",
    checkbox: "checkbox",
    radio: "radio_button",
    dropdown: "dropdown",
    input: "keyboard",
    slider: "slider",
    number_range: "ruler"
}

const SCORE_SYSTEMS = [
    { value: "incremental", label: "Incremental", data: "Points to each player with correct answer." },
    { value: "falloff", label: "Falloff", data: "Max points to first with correct answer, decreasing for subsequent correct answers." },
    { value: "speed", label: "Speed", data: "Points based on response speed, decreasing over time." }
]

function hasAnswer(input: InputView | undefined) {
    if (!input) return false
    if (input.type === "text" || input.type === "number") return input.answer !== undefined && input.answer !== ""
    if (input.type === "multi_choice") return !!input.options?.some((o) => o.isAnswer)
    return false
}

function isCorrect(input: InputView | undefined, value: unknown) {
    if (!input) return false
    if (input.type === "text" || input.type === "number") {
        if (input.answer === undefined || input.answer === "") return false
        return String(value).toLowerCase().trim() === String(input.answer).toLowerCase().trim()
    }
    if (input.type === "multi_choice") return !!input.options?.some((o) => o.isAnswer && o.value === value)
    return false
}

export function Interactions() {
    const interactionsValue = useStore(interactions)
    const activeInteractionsValue = useStore(activeInteractions)
    const openedInteractionIdValue = useStore(openedInteractionId)
    const labelsDisabledValue = useStore(labelsDisabled)

    const openedId = openedInteractionIdValue
    const openedInteraction = (interactionsValue[openedId] || null) as InteractionWithId | null

    const [answers, setAnswers] = useState<Answers>([])
    const [clients, setClients] = useState<Record<string, Client>>({})
    const [currentAnswer, setCurrentAnswer] = useState<unknown>(null)
    const [inputIndex, setInputIndex] = useState(-1)
    const [closed, setClosed] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const [startTime, setStartTime] = useState(0)
    const [startTimes, setStartTimes] = useState<Record<number, number>>({})
    const [showPlayers, setShowPlayers] = useState(false)
    const [showOptions, setShowOptions] = useState(false)
    const [showHistory, setShowHistory] = useState(false)

    // Suscripciones al juego activo; se rehacen al abrir otra interacción o al arrancar/parar.
    useEffect(() => {
        const unsubscribes: (() => void)[] = []

        if (openedId && activeInteractionsValue.includes(openedId)) {
            const interaction = getInteraction(openedId)
            if (interaction) {
                unsubscribes.push(
                    interaction.onUpdate((data) => {
                        setAnswers(data.answers as Answers)
                        setClients(data.clients as Record<string, Client>)
                        setCurrentAnswer(data.currentAnswer)
                        setInputIndex(data.inputIndex)
                        setClosed(data.closed)
                    })
                )
                unsubscribes.push(
                    interaction.onTick((data) => {
                        setSeconds(data.seconds)
                        setStartTime(data.startTime)
                        setStartTimes(data.startTimes || {})
                        setClosed(data.closed)
                    })
                )
            }
        } else {
            setAnswers([])
            setClients({})
            setCurrentAnswer(null)
            setInputIndex(-1)
            setClosed(false)
            setSeconds(0)
            setStartTime(0)
            setStartTimes({})
        }

        return () => {
            unsubscribes.forEach((unsub) => unsub())
        }
    }, [openedId, activeInteractionsValue])

    const defaultScorePoints = openedInteraction?.options?.scoreSystem === "falloff" ? 10 : openedInteraction?.options?.scoreSystem === "speed" ? 100 : 1

    function createNew() {
        const id = uid()
        interactions.update((a) => {
            a[id] = {
                name: "",
                inputs: [],
                lastConnection: initConnection()
            }
            return a
        })

        activeRename.set(`interaction_${id}`)
    }

    function updateInteractionName(id: string, value: string) {
        if (!value) return

        interactions.update((a) => {
            if (!a[id]) return a

            if (!a[id].name) openedInteractionId.set(id)

            a[id].name = value

            return a
        })
    }

    // OPENED

    function addInput() {
        popupData.set({ id: openedId })
        activePopup.set("interaction_input")
    }

    function rearrangeInputs(direction: "forward" | "backward", index: number) {
        interactions.update((a) => {
            const items = clone(a[openedId]?.inputs)
            if (!items) return a

            const currentItem = items.splice(index, 1)[0]
            if (!currentItem) return a

            if (direction === "forward") index = Math.min(index + 1, items.length)
            else if (direction === "backward") index = Math.max(index - 1, 0)

            a[openedId].inputs = [...items.slice(0, index), currentItem, ...items.slice(index)]

            return a
        })
    }

    function setOption(key: string, value: unknown) {
        interactions.update((a) => {
            if (!a[openedId]) return a
            const options = (a[openedId].options || {}) as Record<string, unknown>

            if (key === "scorePoints" && value === defaultScorePoints) {
                delete options[key]
            } else {
                options[key] = value
            }

            a[openedId].options = options as Interaction["options"]
            return a
        })
    }

    async function start() {
        await startInteraction(openedId)
    }

    function kick(clientId: string) {
        getInteraction(openedId)?.kick(clientId)
    }

    const isActive = !!openedId && activeInteractionsValue.includes(openedId)
    const dbid = openedId ? getInteraction(openedId)?.dbid : undefined

    if (!openedId) {
        return (
            <>
                <div className={styles.interactions}>
                    {sortByName(keysToID(interactionsValue) as InteractionWithId[]).map((interaction) => (
                        <SelectElem key={interaction.id} id="interaction" data={{ id: interaction.id }}>
                            <div
                                className={`${styles.interaction} context #interaction${activeInteractionsValue.includes(interaction.id) ? ` ${styles.active}` : ""}`}
                                onClick={(e) => {
                                    const target = e.target instanceof Element ? e.target : null
                                    if (target?.closest(".edit")) return
                                    openedInteractionId.set(interaction.id)
                                }}
                                role="none"
                            >
                                <p style={interaction.name ? undefined : { fontStyle: "italic", opacity: 0.7 }}>
                                    <HiddenInput value={interaction.name} id={`interaction_${interaction.id}`} onEdit={(e) => updateInteractionName(interaction.id, e.value)} />
                                </p>
                            </div>
                        </SelectElem>
                    ))}
                </div>

                <FloatingBar onlyOne>
                    <Button icon="add" title="new.interaction" onClick={createNew}>
                        {!labelsDisabledValue ? <T id="new.interaction" /> : null}
                    </Button>
                </FloatingBar>
            </>
        )
    }

    const inputs = (openedInteraction?.inputs || []) as InputView[]
    const maxTime = openedInteraction?.options?.maxTime ?? 0
    const allAtOnce = openedInteraction?.options?.allAtOnce

    return (
        <>
            <div className={styles.header}>
                <Button disabled={showOptions || showHistory || showPlayers} style={{ padding: 6 }} icon="back" title="actions.back" onClick={() => openedInteractionId.set("")} />

                <p style={{ flex: 1, ...(openedInteraction?.name ? {} : { fontStyle: "italic", opacity: 0.7 }) }}>{openedInteraction?.name || translateText("main.unnamed")}</p>

                {isActive ? (
                    <>
                        {dbid ? (
                            <span style={{ fontFamily: "monospace", opacity: 0.8 }}>
                                ID: <span style={{ userSelect: "text" }}>{dbid}</span>
                            </span>
                        ) : null}

                        <Button style={{ padding: 6 }} icon="people" onClick={() => setShowPlayers(!showPlayers)} white={!showPlayers}>
                            <span style={{ fontFamily: "monospace", opacity: 0.8 }}>{Object.keys(clients).length}</span>
                        </Button>
                    </>
                ) : !showOptions && openedInteraction?.history?.length ? (
                    <Button style={{ padding: 6 }} icon="history" onClick={() => setShowHistory(!showHistory)} white={!showHistory}>
                        <span style={{ fontFamily: "monospace", opacity: 0.8 }}>{openedInteraction.history.length}</span>
                    </Button>
                ) : null}
            </div>

            {showOptions ? (
                <div className={styles.options}>
                    <ToggleField label="interaction.require_name" checked={openedInteraction?.options?.requireName ?? true} defaultValue={true} onChange={(checked) => setOption("requireName", checked)} />
                    {openedInteraction?.options?.requireName === false ? <ToggleField label="interaction.random_names" checked={openedInteraction?.options?.randomNames ?? false} defaultValue={false} onChange={(checked) => setOption("randomNames", checked)} /> : null}

                    <ToggleField label="interaction.all_at_once" checked={openedInteraction?.options?.allAtOnce ?? false} defaultValue={false} disabled={(openedInteraction?.inputs?.length || 0) <= 1} onChange={(checked) => setOption("allAtOnce", checked)} />

                    {!openedInteraction?.options?.allAtOnce ? (
                        <>
                            <NumberField label="interaction.max_time (conditions.seconds)" value={openedInteraction?.options?.maxTime ?? 0} defaultValue={0} onChange={(value) => setOption("maxTime", value)} />

                            <InputRow>
                                <SelectField label="interaction.score_system" value={openedInteraction?.options?.scoreSystem || "incremental"} options={SCORE_SYSTEMS} onChange={(value) => setOption("scoreSystem", value)} />
                                <NumberField label="interaction.points" value={openedInteraction?.options?.scorePoints ?? defaultScorePoints} defaultValue={defaultScorePoints} onChange={(value) => setOption("scorePoints", value)} />
                            </InputRow>
                        </>
                    ) : null}
                </div>
            ) : showHistory && !isActive ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, overflow: "auto" }}>
                    {clone(openedInteraction?.history || [])
                        .reverse()
                        .map((entry, entryIndex) => (
                            <div key={entryIndex} style={{ backgroundColor: "var(--primary-darkest)", padding: 10, borderRadius: 6 }}>
                                <p style={{ fontSize: "0.8em", opacity: 0.7, marginBottom: 8 }}>{new Date(entry.time).toLocaleString()}</p>

                                {entry.leaderboard?.length ? (
                                    <div style={{ marginBottom: 12, padding: 8, backgroundColor: "var(--bg-hover)", borderRadius: 4 }}>
                                        <p style={{ fontWeight: "bold", fontSize: "0.9em", marginBottom: 6, opacity: 0.9 }}>Leaderboard:</p>
                                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                                            {entry.leaderboard.map((player, playerIndex) => (
                                                <li key={playerIndex} style={{ marginBottom: 4, fontSize: "0.9em" }}>
                                                    <span style={{ fontWeight: "bold" }}>{player.name}</span>: {player.score} pts
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ) : null}

                                <ol style={{ margin: 0, padding: "0 0 0 24px" }}>
                                    {entry.inputs.map((input, inputIndexValue) => (
                                        <li key={inputIndexValue} style={{ marginBottom: 8 }} className={styles.list}>
                                            <p style={{ fontWeight: "bold", marginBottom: 4 }}>{input.question || translateText("main.unnamed")}</p>
                                            <ul style={{ margin: 0, padding: "0 0 0 24px", listStyleType: "disc" }}>
                                                {input.answers.map((answer, answerIndex) => (
                                                    <li key={answerIndex} style={{ marginBottom: 4 }}>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <span style={{ fontWeight: "bold", opacity: 0.9 }}>{answer.name}:</span>
                                                            <span style={{ flex: 1 }}>
                                                                {(Array.isArray(answer.value) ? answer.value : [answer.value]).map((value: unknown, valueIndex: number) => (
                                                                    <span key={valueIndex}>
                                                                        {valueIndex > 0 ? ", " : ""}
                                                                        <span>{String(value)}</span>
                                                                    </span>
                                                                ))}
                                                            </span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                </div>
            ) : showPlayers && isActive ? (
                <div className={styles.players}>
                    {(getInteraction(openedId)?.getClients() || []).map((client, i) => (
                        <div key={client.id || i} className={styles.player}>
                            <Icon id="profiles" white />
                            <p style={{ flex: 1 }}>{client.name || `User #${i + 1}`}</p>

                            <NumberField label="interaction.points" value={client.score ?? 0} style={{ width: 100 }} onChange={(value) => getInteraction(openedId)?.setScore(client.id, value ?? 0)} />
                            <Button style={{ padding: 4 }} red onClick={() => kick(client.id)}>
                                <T id="interaction.kick" />
                            </Button>
                        </div>
                    ))}
                    {Object.keys(clients).length === 0 ? (
                        <p style={{ textAlign: "center", opacity: 0.5, padding: 10, fontStyle: "italic" }}>
                            <T id="settings.connections" />
                        </p>
                    ) : null}
                </div>
            ) : (
                <>
                    <div className={styles.inputs}>
                        {isActive && inputIndex === -1 && allAtOnce !== true ? <div style={{ border: "1px solid var(--secondary)" }}></div> : null}

                        {inputs.map((input, i) => {
                            const inputIcon = input.inputType && input.inputType !== "none" ? INPUT_TYPE_ICONS[input.inputType] : undefined
                            const inputAnswers = Object.entries(answers[i] || {}).sort((a, b) => (a[1]?.time || 0) - (b[1]?.time || 0))
                            const questionStartTime = startTimes[i] || startTime

                            return (
                                <InputRow
                                    key={i}
                                    arrow={isActive && Object.keys(answers[i] || {}).length > 0}
                                    menu={
                                        <>
                                            {inputAnswers.map(([clientId, answerValue]) => (
                                                <p key={clientId} style={{ display: "flex", gap: 8, padding: "4px 8px" }}>
                                                    <span style={{ fontWeight: "bold", opacity: 0.9 }}>{clients[clientId]?.name || `User #${Object.keys(clients).indexOf(clientId) + 1}`}:</span>
                                                    <span style={{ flex: 1, whiteSpace: "normal" }}>
                                                        {(Array.isArray(answerValue?.value) ? answerValue.value : [answerValue?.value]).map((value: unknown, valueIndex: number) => (
                                                            <span key={valueIndex}>
                                                                {valueIndex > 0 ? ", " : ""}
                                                                <span style={isCorrect(input, value) ? { color: "#31ed31", fontWeight: "bold" } : undefined}>{String(value)}</span>
                                                            </span>
                                                        ))}
                                                    </span>

                                                    {questionStartTime && answerValue?.time ? <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{Math.max(0, (answerValue.time - questionStartTime) / 1000).toFixed(1)}s</span> : null}
                                                </p>
                                            ))}
                                        </>
                                    }
                                >
                                    <div
                                        className={`${styles.input} ${isActive ? "" : "context #interaction_input"}${isActive && (i === inputIndex || allAtOnce) ? ` ${styles.active}` : ""}`}
                                        style={{ width: "100%" }}
                                        id={`#${i}`}
                                        data-title={isActive && !allAtOnce && i !== inputIndex ? "Go to this input" : ""}
                                        onClick={(e) => {
                                            if (isActive) {
                                                if (allAtOnce) return

                                                getInteraction(openedId)?.goto(i)
                                                return
                                            }

                                            const target = e.target instanceof Element ? e.target : null
                                            if (target?.closest(".rearrange")) return

                                            popupData.set({ id: openedId, inputIndex: i })
                                            activePopup.set("interaction_input")
                                        }}
                                        role="none"
                                    >
                                        <Icon id={input.type === "heading" ? "info" : input.type} size={1.5} />
                                        {inputIcon ? <Icon id={inputIcon} white /> : null}

                                        <p style={{ flex: 1, ...(input.question ? {} : { fontStyle: "italic", opacity: 0.7 }) }}>{input.question || translateText("main.unnamed")}</p>

                                        {isActive ? (
                                            input.type === "heading" ? null : (
                                                <>
                                                    {/* timer */}
                                                    {i === inputIndex ? (
                                                        <span className={closed ? styles.closed : undefined} style={{ fontFamily: "monospace", opacity: 0.8, marginRight: 8 }}>
                                                            {closed ? "CLOSED" : maxTime > 0 ? formatTimeInteraction(maxTime - seconds) : formatTimeInteraction(seconds)}
                                                        </span>
                                                    ) : null}

                                                    {/* answers count */}
                                                    <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{Object.keys(answers[i] || {}).length || 0}</span>
                                                </>
                                            )
                                        ) : (
                                            <span>
                                                <Button className="rearrange" disabled={i === (openedInteraction?.inputs.length || 0) - 1} icon="down" title="actions.backward" style={{ padding: 8 }} onClick={() => rearrangeInputs("forward", i)} />
                                                <Button className="rearrange" disabled={i === 0} icon="up" title="actions.forward" style={{ padding: 8, borderLeft: "none" }} onClick={() => rearrangeInputs("backward", i)} />
                                            </span>
                                        )}
                                    </div>
                                </InputRow>
                            )
                        })}

                        {!isActive ? (
                            <Button variant="outline" icon="add" style={{ minHeight: 45 }} onClick={addInput}>
                                <T id="interaction.add_input" />
                            </Button>
                        ) : null}
                    </div>

                    {isActive ? (
                        <>
                            <FloatingBar side="left">
                                <Button
                                    icon="stop"
                                    onClick={async () => {
                                        await stopInteraction(openedId)
                                    }}
                                    white
                                    red
                                >
                                    <T id="media.stop" />
                                </Button>
                            </FloatingBar>

                            {!allAtOnce ? (
                                <FloatingBar side="right">
                                    <Button disabled={inputIndex < ((openedInteraction?.inputs?.length || 0) < 2 ? 1 : 0)} title="media.previous" onClick={() => getInteraction(openedId)?.previous()}>
                                        <Icon size={1.3} id="previous" white />
                                    </Button>

                                    {hasAnswer(inputs[inputIndex]) && (currentAnswer === null || currentAnswer === undefined || currentAnswer === "") ? (
                                        <>
                                            <div className="divider"></div>
                                            <Button onClick={() => getInteraction(openedId)?.revealAnswer()}>
                                                <T id="interaction.reveal_answer" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button disabled={inputIndex === (openedInteraction?.inputs?.length || 0) - 1} title="media.next" onClick={() => getInteraction(openedId)?.next()}>
                                            <Icon size={1.3} id="next" white />
                                        </Button>
                                    )}
                                </FloatingBar>
                            ) : null}
                        </>
                    ) : (
                        <FloatingBar side="left">
                            <Button icon="play" disabled={!(openedInteraction?.inputs?.length || 0)} onClick={start} white>
                                <T id="inputs.start" />
                            </Button>
                        </FloatingBar>
                    )}
                </>
            )}

            {!isActive && !showHistory ? (
                <FloatingBar round>
                    <Button isActive={showOptions} title="create_show.more_options" onClick={() => setShowOptions(!showOptions)}>
                        <Icon size={1.1} id="options" white={!showOptions} />
                    </Button>
                </FloatingBar>
            ) : null}
        </>
    )
}
