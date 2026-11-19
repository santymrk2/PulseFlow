// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actionTags, actions, activeActionTagFilter, activePopup, activeProfile, dictionary, labelsDisabled, popupData, profiles, runningActions, special, timelineRecordingAction } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Actions } from "./Actions"

const { runActionMock, receivedMidiMock } = vi.hoisted(() => ({ runActionMock: vi.fn(), receivedMidiMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../actions/logic/actions", () => ({ runAction: runActionMock, getActionIcon: () => "icon" }))
vi.mock("../../actions/logic/midi", () => ({ convertOldMidiToNewAction: (action: unknown) => action, midiToNote: () => "C4", receivedMidi: receivedMidiMock }))

const dict = {
    empty: { general: "Vacío" },
    media: { play: "Reproducir" },
    new: { action: "Nueva acción" },
    actions: { play_on_midi: "Reproducir en MIDI" },
    show: { grid: "Grilla", list: "Lista" }
}

const action = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, triggers: ["click"], ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(actions, { a1: action("a1"), a2: action("a2", { name: "Otra" }) } as never), storeEntry(actionTags, {}), storeEntry(activeActionTagFilter, []), storeEntry(runningActions, []), storeEntry(special, {}), storeEntry(labelsDisabled, false), storeEntry(activeProfile, null), storeEntry(profiles, {}), storeEntry(popupData, {}), storeEntry(activePopup, null), storeEntry(timelineRecordingAction, { id: "" })])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Actions", () => {
    it("lista las acciones ordenadas por nombre", () => {
        render(<Actions />)
        const botones = screen.getAllByText(/a1|Otra/)
        expect(botones.length).toBe(2)
    })

    it("sin acciones muestra el vacío", () => {
        act(() => actions.set({}))
        render(<Actions />)
        expect(screen.getByText("Vacío")).toBeTruthy()
    })

    it("al reproducir ejecuta la acción y arranca la grabación de timeline", () => {
        render(<Actions />)
        fireEvent.click(screen.getByText("a1").closest("button") as HTMLElement)
        expect(runActionMock).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), { source: "click" })
        expect(get(timelineRecordingAction).id).toBe("run_action")
    })

    it("ctrl+clic no ejecuta", () => {
        render(<Actions />)
        fireEvent.click(screen.getByText("a1").closest("button") as HTMLElement, { ctrlKey: true })
        expect(runActionMock).not.toHaveBeenCalled()
    })

    it("una acción de MIDI envía la nota en lugar de ejecutarse", () => {
        act(() => actions.set({ a1: action("a1", { shows: [{ id: "show1" }] }) } as never))
        render(<Actions />)
        fireEvent.click(screen.getByText("Reproducir en MIDI").closest("button") as HTMLElement)
        expect(receivedMidiMock).toHaveBeenCalledWith({ id: "a1", bypass: true })
        expect(runActionMock).not.toHaveBeenCalled()
    })

    it("filtra por etiqueta y muestra los tags restantes", () => {
        act(() => {
            actions.set({ a1: action("a1", { tags: ["t1", "t2"] }) } as never)
            actionTags.set({ t1: { name: "Uno", color: "red" }, t2: { name: "Dos", color: "blue" } })
            activeActionTagFilter.set(["t1"])
        })
        render(<Actions />)
        expect(screen.getByText("Dos")).toBeTruthy()
    })

    it("muestra el teclado de activación y las acciones desactivadas", () => {
        act(() => actions.set({ a1: action("a1", { keypressActivate: "F5", enabled: false }) } as never))
        render(<Actions />)
        expect(screen.getByText("F5")).toBeTruthy()
    })

    it("con una etiqueta activa permite alternar grilla y lo guarda en special", () => {
        act(() => {
            actions.set({ a1: action("a1", { tags: ["t1"] }) } as never)
            activeActionTagFilter.set(["t1"])
        })
        render(<Actions />)
        fireEvent.click(document.querySelector('[data-title="Lista"]') as HTMLElement)
        expect((get(special) as Record<string, unknown>).actions_gridt1).toBe(true)
        expect(document.querySelector('[data-title="Grilla"]')).toBeTruthy()
    })

    it("la acción nueva abre el popup con datos vacíos", () => {
        act(() => popupData.set({ previo: true }))
        render(<Actions />)
        fireEvent.click(document.querySelector('[data-title="Nueva acción"]') as HTMLElement)
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBe("action")
    })

    it("con acceso de sólo lectura deshabilita la acción nueva", () => {
        act(() => {
            activeProfile.set("p1")
            profiles.set({ p1: { access: { actions: { global: "read" } } } } as never)
        })
        render(<Actions />)
        expect((document.querySelector('[data-title="Nueva acción"]') as HTMLButtonElement).disabled).toBe(true)
    })
})
