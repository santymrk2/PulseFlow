// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { uid } from "uid"
import { history } from "../../shared/utils/helpers/history"
import { getAccess } from "../../shared/utils/profile"
import { activePage, activePopup, currentOutputSettings, dictionary, popupData, stageShows } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { SelectStageLayout } from "./SelectStageLayout"

const { portProps } = vi.hoisted(() => ({ portProps: {} as Record<string, Record<string, unknown>> }))

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("uid", () => ({ uid: vi.fn(() => "layout-nuevo") }))
vi.mock("../stage/StageSlide", () => ({
    StageSlide: (props: Record<string, unknown>) => {
        portProps.StageSlide = props
        return <div data-isla="StageSlide" />
    }
}))
vi.mock("../stage/SkeletonStageSlide", () => ({
    SkeletonStageSlide: (props: Record<string, unknown>) => {
        portProps.SkeletonStageSlide = props
        return <div data-isla="SkeletonStageSlide" />
    }
}))

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
    Object.keys(portProps).forEach((key) => delete portProps[key])
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
        expect(portProps.SkeletonStageSlide.layout).toMatchObject({ name: "Charlie" })
    })

    it("el lazy loader pasa de skeletons a StageSlide a los 80 ms", () => {
        montar()
        expect(portProps.StageSlide).toBeUndefined()
        act(() => vi.advanceTimersByTime(80))
        expect(portProps.StageSlide).toMatchObject({ id: "c", selectable: false })
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
