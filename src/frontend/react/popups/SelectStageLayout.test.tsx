// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { uid } from "uid"
import { history } from "../../components/helpers/history"
import { getAccess } from "../../utils/profile"
import { activePage, activePopup, currentOutputSettings, dictionary, popupData, stageShows } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SelectStageLayout } from "./SelectStageLayout"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("uid", () => ({ uid: vi.fn(() => "layout-nuevo") }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../../components/stage/StageSlide.svelte", () => ({ default: { isla: "StageSlide" } }))
vi.mock("../../components/stage/SkeletonStageSlide.svelte", () => ({ default: { isla: "SkeletonStageSlide" } }))

const layouts = {
    a: { name: "Alfa", items: { i: { currentOutput: { source: "out1" } } } },
    b: { name: "Beta", items: { i: { currentOutput: { source: "out2" } } } },
    c: { name: "Charlie", items: { i: { currentOutput: { source: "out2" } } } }
}
const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = {}, shows: object = layouts, access: object = {}) {
    vi.mocked(getAccess).mockReturnValue(access as never)
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(stageShows, shows), storeEntry(currentOutputSettings, "out1"), storeEntry(activePopup, "select_stage_layout"), storeEntry(activePage, "show"), storeEntry(dictionary, { new: { style: "Nuevo estilo" }, empty: { general: "Vacío" } })] as never)
    return render(<SelectStageLayout />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("SelectStageLayout", () => {
    it("filtra los layouts sin acceso y los que usan la salida actual, ordenados por nombre", () => {
        const { container } = montar()
        expect(container.querySelectorAll("div[role='button']")).toHaveLength(2)
        expect(islands.SkeletonStageSlide.props.layout).toMatchObject({ name: "Charlie" })
    })

    it("el lazy loader pasa de skeletons a StageSlide a los 80 ms", () => {
        montar()
        expect(islands.StageSlide).toBeUndefined()
        act(() => vi.advanceTimersByTime(80))
        expect(islands.StageSlide.props).toMatchObject({ id: "c", selectable: false })
    })

    it("elegir un layout llama al trigger, escribe popupData y cierra con el reset de 200 ms", () => {
        const { container } = montar({ trigger })
        fireEvent.click(container.querySelectorAll("div[role='button']")[0] as HTMLElement)
        expect(trigger).toHaveBeenCalledWith("b")
        expect(get(popupData)).toMatchObject({ id: "select_stage_layout", value: "b" })
        act(() => vi.advanceTimersByTime(0))
        expect(get(activePopup)).toBeNull()
        act(() => vi.advanceTimersByTime(200))
        expect(get(popupData)).toEqual({})
    })

    it("crear nuevo escribe history, selecciona el id y abre la página stage", () => {
        montar({ trigger })
        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        expect(uid).toHaveBeenCalled()
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", oldData: { id: "layout-nuevo" }, location: { page: "stage", id: "stage" } })
        expect(trigger).toHaveBeenCalledWith("layout-nuevo")
        expect(get(activePage)).toBe("stage")
    })

    it("respeta permiso none y muestra vacío si no queda ninguno", () => {
        montar({}, layouts, { b: "none", c: "none" })
        expect(screen.getByText("Vacío")).toBeTruthy()
    })
})
