// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { midiInListen } from "../../components/actions/midi"
import { actions, activeShow, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearIslands, emit, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SlideMidi } from "./SlideMidi"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/actions/midi", () => ({ midiInListen: vi.fn() }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../../components/actions/MidiValues.svelte", () => ({ default: { isla: "MidiValues" } }))
vi.mock("../../components/main/Tip.svelte", () => ({ default: { isla: "Tip" } }))

let restaurar: () => void = () => {}
const montarSlideMidi = (data: object = {}, actionsData: object = {}): ReturnType<typeof render> => {
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(actions, actionsData), storeEntry(activeShow, { id: "sh1" }), storeEntry(dictionary, {})] as never)
    return render(<SlideMidi />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("SlideMidi", () => {
    it("muestra el tip y MidiValues con el valor por defecto y playSlide", () => {
        montarSlideMidi({ id: "a1" })
        expect(islands.Tip.props).toEqual({ type: "info", value: "actions.play_on_midi_tip", bottom: 20 })
        expect(islands.MidiValues.props).toMatchObject({ firstActionId: undefined, playSlide: true })
        expect(islands.MidiValues.props.value).toMatchObject({ type: "noteon", defaultValues: true })
    })

    it("sin id en popupData genera uno nuevo", () => {
        montarSlideMidi()
        const data = get(popupData)
        expect(typeof data.id).toBe("string")
        expect(data.id.length).toBeGreaterThan(0)
    })

    it("cargar un action existente usa su midi como valor de la isla", () => {
        montarSlideMidi({ id: "a1" }, { a1: { name: "Acción", triggers: ["index_1"], midi: { type: "control", values: { note: 5, velocity: 1, channel: 2 } } } })
        expect(islands.MidiValues.props.firstActionId).toBe("index_1")
        expect(islands.MidiValues.props.value).toMatchObject({ type: "control", values: { note: 5 } })
    })

    it("un change de MidiValues guarda el action, agrega el show activo y vuelve a escuchar midi", () => {
        montarSlideMidi({ id: "a1", index: 0 }, { a1: { name: "Acción", triggers: [] } })
        const midi = { type: "noteon", values: { note: 42, velocity: 1, channel: 1 }, defaultValues: true }
        emit("MidiValues", "change", midi)
        expect(get(actions).a1).toMatchObject({ name: "Acción", midi: { type: "noteon", values: { note: 42 } }, shows: [{ id: "sh1" }] })
        expect((get(actions).a1 as { midi?: { defaultValues?: boolean } }).midi?.defaultValues).toBeUndefined()
        expect(midiInListen).toHaveBeenCalledTimes(1)
        expect(islands.MidiValues.props.value).toMatchObject({ values: { note: 42 } })
    })

    it("sin show seleccionado no agrega shows", () => {
        montarSlideMidi({ id: "a1" }, { a1: { name: "Acción", triggers: [] } })
        const active = get(activeShow) as { id: string } | null
        if (active) active.id = "otro"
        emit("MidiValues", "change", { type: "noteon", values: { note: 1, velocity: 1, channel: 1 } })
        expect((get(actions).a1 as { shows?: unknown[] }).shows).toEqual([])
    })
})
