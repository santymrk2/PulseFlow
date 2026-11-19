// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actions, dictionary, outputs, scenes } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { SceneActions } from "./SceneActions"

const { historyMock } = vi.hoisted(() => ({ historyMock: vi.fn() }))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/helpers/history", () => ({ history: historyMock }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, { actions: { remove: "Quitar", remove_binding: "Quitar vínculo" } }), storeEntry(scenes, { escena: { name: "Escena 1", action: "act1", bindings: ["out1"] } } as never), storeEntry(actions, { act1: { name: "Mi acción", triggers: [] } } as never), storeEntry(outputs, { out1: { id: "out1", name: "Pantalla 1" } } as never)])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

describe("SceneActions", () => {
    it("muestra la acción personalizada y el nombre de la salida vinculada", () => {
        render(<SceneActions columns={5} sceneId="escena" />)
        expect(screen.getByText("Mi acción")).toBeTruthy()
        expect(screen.getByText("Pantalla 1")).toBeTruthy()
    })

    it("con varias salidas vinculadas muestra la cantidad", () => {
        restaurar()
        restaurar = setStoresForTest([storeEntry(dictionary, {}), storeEntry(scenes, { escena: { name: "Escena 1", bindings: ["out1", "out2"] } } as never), storeEntry(actions, {}), storeEntry(outputs, {})])
        render(<SceneActions columns={5} sceneId="escena" />)
        expect(screen.getByText("2")).toBeTruthy()
    })

    it("al quitar la acción escribe el historial con scene_key action_<id>", () => {
        vi.useFakeTimers()
        render(<SceneActions columns={5} sceneId="escena" />)
        fireEvent.click(screen.getByText("Mi acción").closest("button") as HTMLElement)
        act(() => vi.runAllTimers())
        expect(historyMock).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { key: "action", data: "" },
            oldData: { id: "escena" },
            location: { page: "drawer", id: "scene_key", override: "action_escena" }
        })
    })

    it("al quitar los vínculos escribe el historial con scene_key bindings_<id>", () => {
        vi.useFakeTimers()
        render(<SceneActions columns={5} sceneId="escena" />)
        fireEvent.click(screen.getAllByRole("button")[1])
        act(() => vi.runAllTimers())
        expect(historyMock).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { key: "bindings", data: [] },
            oldData: { id: "escena" },
            location: { page: "drawer", id: "scene_key", override: "bindings_escena" }
        })
    })

    it("sin escena no renderiza iconos", () => {
        restaurar()
        restaurar = setStoresForTest([storeEntry(dictionary, {}), storeEntry(scenes, {}), storeEntry(actions, {}), storeEntry(outputs, {})])
        const { container } = render(<SceneActions columns={5} sceneId="inexistente" />)
        expect(container.querySelectorAll("button").length).toBe(0)
    })
})
