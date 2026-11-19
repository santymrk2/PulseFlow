// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, mediaOptions, scenes } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Scenes } from "./Scenes"

const { historyMock, startSceneMock, findMatchingOutMock } = vi.hoisted(() => ({ historyMock: vi.fn(), startSceneMock: vi.fn(), findMatchingOutMock: vi.fn(() => null) }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getResolution: () => ({ width: 16, height: 9 }), findMatchingOut: findMatchingOutMock, startScene: startSceneMock }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: historyMock }))
vi.mock("./ScenePreview", () => ({ ScenePreview: ({ scene }: { scene: { id: string } }) => <div data-testid={`preview-${scene.id}`} /> }))
vi.mock("./SceneActions", () => ({ SceneActions: ({ sceneId }: { sceneId: string }) => <div data-testid={`actions-${sceneId}`} /> }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    findMatchingOutMock.mockReturnValue(null)
    restaurar = setStoresForTest([storeEntry(dictionary, { empty: { general: "Vacío" }, new: { scene: "Nueva escena" } }), storeEntry(mediaOptions, { columns: 4, mode: "grid" }), storeEntry(scenes, { s1: { name: "Escena A", content: {} }, s2: { name: "Escena B", content: {} } } as never)])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

describe("Scenes", () => {
    it("lista las escenas ordenadas y carga previews y acciones por lotes", () => {
        vi.useFakeTimers()
        render(<Scenes />)
        expect(screen.getByText("Escena A")).toBeTruthy()
        expect(screen.getByText("Escena B")).toBeTruthy()

        act(() => vi.runAllTimers())
        expect(screen.getByTestId("preview-s1")).toBeTruthy()
        expect(screen.getByTestId("actions-s2")).toBeTruthy()
    })

    it("un clic en la tarjeta inicia la escena y con ctrl no", () => {
        vi.useFakeTimers()
        render(<Scenes />)
        fireEvent.click(screen.getByText("Escena A"), { ctrlKey: true })
        expect(startSceneMock).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText("Escena A"))
        expect(startSceneMock).toHaveBeenCalledWith("s1")
    })

    it("sin escenas muestra el vacío", () => {
        restaurar()
        restaurar = setStoresForTest([storeEntry(dictionary, { empty: { general: "Vacío" } }), storeEntry(mediaOptions, { columns: 4, mode: "grid" }), storeEntry(scenes, {})])
        render(<Scenes />)
        expect(screen.getByText("Vacío")).toBeTruthy()
    })

    it("el botón de nueva escena escribe el historial del drawer", () => {
        vi.useFakeTimers()
        render(<Scenes />)
        const botones = screen.getAllByRole("button")
        fireEvent.click(botones[botones.length - 1])
        expect(historyMock).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "scene" } })
    })

    it("ctrl+rueda cambia las columnas del store", () => {
        vi.useFakeTimers()
        const { container } = render(<Scenes />)
        const zona = container.firstElementChild as HTMLElement
        act(() => {
            const evento = new WheelEvent("wheel", { deltaY: -100, bubbles: true })
            Object.defineProperty(evento, "ctrlKey", { value: true })
            zona.dispatchEvent(evento)
        })
        expect(get(mediaOptions).columns).toBe(3)
    })
})
