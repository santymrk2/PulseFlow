// Port de components/main/popups/Timecode.svelte. Lee: timecode (tipo, modo, framerate, offset y entrada/salida de audio o MIDI).
// Escribe: timecode en cada cambio; consulta las salidas/entradas según modo y tipo (LTC/MTC, send/receive).
import { useEffect, useState } from "react"
import { Main } from "../../../types/IPC/Main"
import { AudioMicrophone } from "../../shared/audio/audioMicrophone"
import { AudioPlayer } from "../../shared/audio/audioPlayer"
import { requestMain } from "../../shared/core/ipc/main"
import { timecode } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import inputRowStyles from "../../shared/ui/kit/input-row/InputRow.module.css"
import { NumberField } from "../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../shared/ui/kit/select-field/SelectField"

interface Option {
    value: string
    label: string
}

const types = [
    { label: "Send", value: "send" },
    { label: "Receive", value: "receive" }
]

const modes = [
    { label: "LTC (Linear Timecode)", value: "LTC" },
    { label: "MTC (MIDI Timecode)", value: "MTC" }
    // { label: "Ableton", value: "ableton" }
]

const frameratesList = [24, 25, 29.97, 30] // [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]
const framerates = frameratesList.map((a) => ({ label: a.toString(), value: a.toString() }))

export function Timecode() {
    const timecodeValue = useStore(timecode)
    const type = timecodeValue.type ?? "send"
    const mode = timecodeValue.mode ?? "LTC"
    const framerate = timecodeValue.framerate ?? 25
    const offset = timecodeValue.offset ?? 0

    const [audioOutputs, setAudioOutputs] = useState<Option[]>([])
    const [audioInputs, setAudioInputs] = useState<Option[]>([])
    const [midiOutputs, setMidiOutputs] = useState<Option[]>([])
    const [midiInputs, setMidiInputs] = useState<Option[]>([])

    function updateValue(key: string, value: unknown) {
        timecode.update((a) => ({ ...a, [key]: value }))
    }

    // I/O
    useEffect(() => {
        async function getValues() {
            if (mode === "LTC") {
                if (type === "send") {
                    if (audioOutputs.length) return
                    setAudioOutputs(await AudioPlayer.getOutputs())
                } else {
                    if (audioInputs.length) return
                    setAudioInputs((await AudioMicrophone.getList()).map((device) => ({ value: device.deviceId, label: device.label })))
                }
            } else if (mode === "MTC") {
                if (type === "send") {
                    if (midiOutputs.length) return
                    const data = (await requestMain(Main.GET_MIDI_OUTPUTS)) || []
                    setMidiOutputs(data.map((a) => ({ value: a.name, label: a.name })))
                } else {
                    if (midiInputs.length) return
                    const data = (await requestMain(Main.GET_MIDI_INPUTS)) || []
                    setMidiInputs(data.map((a) => ({ value: a.name, label: a.name })))
                }
            }
        }
        if (mode && type) void getValues()
    }, [mode, type])

    return (
        <>
            <div className={inputRowStyles.row}>
                <SelectField label="sort.type" options={types} value={type} onChange={(value) => updateValue("type", value)} />

                {type === "send" || mode === "LTC" ? <SelectField label="settings.frame_rate" options={framerates} value={framerate.toString()} defaultValue="25" onChange={(value) => updateValue("framerate", Number(value))} /> : null}
            </div>

            <div className={inputRowStyles.row} style={{ marginTop: 10 }}>
                <SelectField label="actions.mode" options={modes} value={mode} onChange={(value) => updateValue("mode", value)} />

                {mode === "LTC" ? (
                    type === "send" ? (
                        <SelectField label="audio.custom_output" options={audioOutputs} value={timecodeValue.audioOutput || ""} onChange={(value) => updateValue("audioOutput", value)} allowEmpty />
                    ) : (
                        <SelectField label="live.microphones" options={audioInputs} value={timecodeValue.audioInput || ""} onChange={(value) => updateValue("audioInput", value)} allowEmpty />
                    )
                ) : mode === "MTC" ? (
                    type === "send" ? (
                        <SelectField label="midi.output" value={timecodeValue.midiOutput || ""} options={midiOutputs} onChange={(value) => updateValue("midiOutput", value)} allowEmpty />
                    ) : (
                        <SelectField label="midi.input" value={timecodeValue.midiInput || ""} options={midiInputs} onChange={(value) => updateValue("midiInput", value)} allowEmpty />
                    )
                ) : null}
            </div>

            <NumberField label="edit.offset (ms)" value={offset} min={-60000} max={60000} step={100} defaultValue={0} onChange={(value) => updateValue("offset", value)} />
        </>
    )
}
