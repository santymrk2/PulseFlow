import { useEffect, useRef, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { ToMain } from "../../../types/IPC/ToMain"
import { destroyMain, receiveToMain, requestMain } from "../../shared/core/ipc/main"
import { popupData } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { T } from "../../shared/ui/helpers/T"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"
import type { API_midi } from "./logic/api"
import { defaultMidiActionChannels, midiToNote } from "./logic/midi"

export interface MidiValuesProps {
    value: API_midi
    firstActionId?: string
    type?: "input" | "output" | "emitter"
    playSlide?: boolean
    simple?: boolean
    onChange?: (value: API_midi) => void
}

const types = [
    { value: "noteon", label: "noteon" },
    { value: "noteoff", label: "noteoff" },
    { value: "control", label: "control" }
]

export function MidiValues({ value, firstActionId = "", type = "input", playSlide = false, simple = false, onChange }: MidiValuesProps) {
    const currentPopupData = useStore(popupData) as { id?: string } | null
    const midi = value || ({} as API_midi)
    const [inputs, setInputs] = useState<Array<{ name: string }>>([{ name: "—" }])
    const [outputs, setOutputs] = useState<Array<{ name: string }>>([{ name: "—" }])
    const [autoValues, setAutoValues] = useState(false)
    const autoRef = useRef(autoValues)
    autoRef.current = autoValues
    const midiRef = useRef(midi)
    midiRef.current = midi

    const hasActions = !!firstActionId

    function change(next: API_midi) {
        onChange?.(next)
    }

    function setValues(key: string, val: unknown) {
        const next = { ...midi, values: { ...(midi.values || { note: 0, velocity: type === "input" ? -1 : 0, channel: 1 }) } } as API_midi
        ;(next.values as Record<string, unknown>)[key] = val
        change(next)
    }

    function setMidi(key: string, val: unknown) {
        if (val === "input") return
        change({ ...midi, [key]: val } as API_midi)
    }

    useEffect(() => {
        if (type === "input") {
            requestMain(Main.GET_MIDI_INPUTS, undefined, (data) => {
                if (!data?.length) return
                setInputs(data)
                if (!midiRef.current.input) change({ ...midiRef.current, input: data[0]?.name } as API_midi)
            })
        } else {
            requestMain(Main.GET_MIDI_OUTPUTS, undefined, (data) => {
                if (!data?.length) return
                setOutputs(data)
                if (!midiRef.current.output) change({ ...midiRef.current, output: data[0]?.name } as API_midi)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type])

    useEffect(() => {
        if (midi.values?.note) return
        const timer = setTimeout(() => {
            if (!midiRef.current.values?.note && midiRef.current.values?.note !== 0) setValues("note", 0)
        }, 50)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midi.values?.note])

    useEffect(() => {
        const listenerId = receiveToMain(ToMain.RECEIVE_MIDI2, (data) => {
            if (!autoRef.current || !data) return
            if (data.id === currentPopupData?.id && data.type === midiRef.current.type) {
                const next = { ...midiRef.current, values: { ...(data.values || {}) } } as API_midi
                if (firstActionId.includes("index_") && next.values) next.values.velocity = -1
                change(next)
            }
        })
        return () => destroyMain(listenerId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPopupData?.id, firstActionId])

    function toggleAutoValues(checked: boolean) {
        setAutoValues(checked)
        change(midi)
    }

    function toggleDefaultValues(checked: boolean) {
        let next = { ...midi, defaultValues: checked } as API_midi & { defaultValues?: boolean }
        const defaults = (defaultMidiActionChannels as Record<string, Partial<API_midi>>)[firstActionId]
        if (checked && defaults) next = { ...next, ...defaults }
        change(next)
    }

    const noActionOrDefaultValues = type !== "emitter" && (!hasActions || ((midi as { defaultValues?: boolean }).defaultValues && (defaultMidiActionChannels as Record<string, unknown>)[firstActionId]))

    return (
        <>
            {type !== "emitter" ? (
                <>
                    {type === "input" ? (
                        <SelectField label="midi.input" value={midi.input || ""} options={inputs.map((a) => ({ value: a.name, label: a.name }))} onChange={(v) => setMidi("input", v)} />
                    ) : (
                        <SelectField label="midi.output" value={midi.output || ""} options={outputs.map((a) => ({ value: a.name, label: a.name }))} onChange={(v) => setMidi("output", v)} />
                    )}
                    {type !== "output" && !simple ? <br /> : null}
                </>
            ) : null}

            {hasActions && midi.type !== "control" ? (
                <ToggleField label="midi.use_default_values" disabled={!!((midi as { defaultValues?: boolean }).defaultValues && !(defaultMidiActionChannels as Record<string, unknown>)[firstActionId])} checked={!!(midi as { defaultValues?: boolean }).defaultValues} onChange={toggleDefaultValues} />
            ) : null}

            {!noActionOrDefaultValues ? <ToggleField label="midi.auto_values" checked={autoValues} onChange={toggleAutoValues} /> : null}

            {type !== "emitter" ? <SelectField label="midi.type" disabled={!!(noActionOrDefaultValues && type !== "output" && !playSlide)} value={midi.type || "noteon"} options={types} onChange={(v) => setMidi("type", v)} /> : null}

            {midi.type === "control" ? (
                <>
                    <NumberField label="midi.controller" value={midi.values?.controller || 0} max={127} onChange={(v) => setValues("controller", v)} />
                    <NumberField label="variables.value" value={midi.values?.value || 0} max={127} onChange={(v) => setValues("value", v)} />
                </>
            ) : (
                <>
                    <NumberField label={`midi.note <span style='color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;'>${midiToNote(midi.values?.note ?? 0)}</span>`} disabled={!!(noActionOrDefaultValues && type !== "output" && !playSlide)} value={midi.values?.note || 0} max={127} onChange={(v) => setValues("note", v)} />

                    {(!noActionOrDefaultValues && firstActionId?.includes("index_")) || type === "output" || type === "emitter" || playSlide ? (
                        <>
                            {type === "input" ? (
                                <InputRow>
                                    <p style={{ fontSize: "0.7em", opacity: 0.8 }}>
                                        <T id="midi.tip_velocity" />
                                    </p>
                                </InputRow>
                            ) : null}
                            <NumberField label="midi.velocity" value={midi.values?.velocity ?? (type === "input" ? -1 : 0)} min={type === "input" ? -1 : 0} max={127} onChange={(v) => setValues("velocity", v)} />
                        </>
                    ) : null}
                </>
            )}
            <NumberField label="midi.channel" disabled={!!(noActionOrDefaultValues && type !== "output" && !playSlide)} value={midi.values?.channel ?? 1} min={1} max={16} onChange={(v) => setValues("channel", v)} />
        </>
    )
}
