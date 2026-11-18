// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { AudioMicrophone } from "../../audio/audioMicrophone"
import { AudioPlayer } from "../../audio/audioPlayer"
import { requestMain } from "../../IPC/main"
import { timecode } from "../../stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Timecode } from "./Timecode"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: { getOutputs: vi.fn() } }))
vi.mock("../../audio/audioMicrophone", () => ({ AudioMicrophone: { getList: vi.fn() } }))
vi.mock("../../IPC/main", () => ({ requestMain: vi.fn() }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/input-row/InputRow", async () => {
    const { FieldMock } = await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")
    return { InputRow: (p: object) => <FieldMock {...p} label={`row:${(p as { style?: { marginTop?: number } }).style?.marginTop || 0}`} /> }
})

let restaurar: () => void = () => {}
function montar(value: object = {}) {
    restaurar = setStoresForTest([looseEntry(timecode, value)] as never)
    return render(<Timecode />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.mocked(AudioPlayer.getOutputs).mockResolvedValue([{ value: "out1", label: "Salida 1", channels: 2 }])
    vi.mocked(AudioMicrophone.getList).mockResolvedValue([{ deviceId: "mic1", label: "Mic 1" }] as never)
    vi.mocked(requestMain).mockResolvedValue([{ name: "MIDI 1" }] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Timecode", () => {
    it("usa valores por defecto y carga las salidas de audio LTC", async () => {
        montar()
        expect(fields["sort.type"]).toMatchObject({ value: "send" })
        expect(fields["actions.mode"].value).toBe("LTC")
        expect(fields["settings.frame_rate"]).toMatchObject({ value: "25", defaultValue: "25" })
        expect(fields["edit.offset (ms)"]).toMatchObject({ value: 0, min: -60000, max: 60000, step: 100, defaultValue: 0 })
        await waitFor(() => expect(fields["audio.custom_output"].options).toEqual([{ value: "out1", label: "Salida 1", channels: 2 }]))
    })

    it("cambiar tipo y modo carga los micrófonos y escribe en el store", async () => {
        montar()
        fire("sort.type", "onChange", "receive")
        expect(get(timecode).type).toBe("receive")
        await waitFor(() => expect(fields["live.microphones"].options).toEqual([{ value: "mic1", label: "Mic 1" }]))
        fire("actions.mode", "onChange", "LTC")
        expect(get(timecode).mode).toBe("LTC")
    })

    it("en MTC send pide las salidas MIDI y muestra midi.output", async () => {
        montar({ mode: "MTC", type: "send" })
        await waitFor(() => expect(fields["midi.output"].options).toEqual([{ value: "MIDI 1", label: "MIDI 1" }]))
        expect(requestMain).toHaveBeenCalledWith(Main.GET_MIDI_OUTPUTS)
    })

    it("en MTC receive pide las entradas MIDI", async () => {
        montar({ mode: "MTC", type: "receive" })
        await waitFor(() => expect(fields["midi.input"].options).toEqual([{ value: "MIDI 1", label: "MIDI 1" }]))
        expect(requestMain).toHaveBeenCalledWith(Main.GET_MIDI_INPUTS)
    })

    it("el framerate y el offset se guardan como números", () => {
        montar()
        fire("settings.frame_rate", "onChange", "30")
        expect(get(timecode).framerate).toBe(30)
        fire("edit.offset (ms)", "onChange", 250)
        expect(get(timecode).offset).toBe(250)
    })

    it("sin tipo ni modo no consulta dispositivos", () => {
        montar({ type: "", mode: "" })
        expect(AudioPlayer.getOutputs).not.toHaveBeenCalled()
        expect(requestMain).not.toHaveBeenCalled()
    })
})
