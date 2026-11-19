// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { getResolution } from "../../shared/utils/helpers/output"
import { activePopup, dictionary, outputs, overlays, popupData, previewOutputId, styles } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { clearIslands, islands } from "../../shared/test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { SelectOverlay } from "./SelectOverlay"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({ getResolution: vi.fn(() => ({ width: 1920, height: 1080 })) }))
vi.mock("../../react/drawer/Card", async () => {
    const { islands } = await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")
    return {
        Card: (props: Record<string, unknown>) => {
            islands.Card = { props }
            return <div data-isla="Card" onClick={props.onClick as () => void} />
        }
    }
})
vi.mock("../slide/Textbox", async () => ({ Textbox: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Textbox") }))
vi.mock("../slide/Zoomed", async () => ({ Zoomed: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Zoomed") }))
vi.mock("../../shared/ui/kit/text-field/TextField", () => ({
    TextField: ({ label, value, onInput }: { label: string; value: string; onInput?: (v: string) => void }) => <input data-label={label} value={value} onChange={(e) => onInput?.(e.currentTarget.value)} />
}))

const trigger = vi.fn()
const RES = { width: 1920, height: 1080 }
let restaurar: () => void = () => {}
function montar(data: object = {}, overlaysData: object = { o1: { name: "Overlay uno", color: "red", items: [{ text: "hola" }] }, o2: { name: "Overlay dos" } }) {
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(overlays, overlaysData), looseEntry(outputs, {}), looseEntry(styles, {}), storeEntry(previewOutputId, ""), storeEntry(activePopup, "select_overlay"), storeEntry(dictionary, { new: { overlay: "Nuevo overlay" }, main: { search: "Buscar" }, empty: { search: "Sin resultados", general: "Vacío" } })] as never)
    return render(<SelectOverlay />)
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

describe("SelectOverlay", () => {
    it("renderiza Card, Zoomed y Textbox por overlay con la resolución", () => {
        montar()
        expect(getResolution).toHaveBeenCalled()
        expect(islands.Card.props).toMatchObject({ width: 25, label: "Overlay uno", active: false })
        expect(islands.Card.props.resolution).toEqual(RES)
        expect(islands.Zoomed.props).toMatchObject({ checkered: true, background: "var(--primary);" })
        expect(islands.Textbox.props).toMatchObject({ ref: { type: "overlay", id: "o1" }, preview: true, miniPreview: true })
    })

    it("elegir un overlay llama al trigger, escribe popupData y cierra con el timeout de 500ms", () => {
        const { container } = montar({ trigger })
        fireEvent.click(container.querySelectorAll('[data-isla="Card"]')[1] as HTMLElement)
        expect(trigger).toHaveBeenCalledWith("o1")
        expect(get(popupData)).toMatchObject({ id: "select_overlay", value: "o1" })
        act(() => vi.advanceTimersByTime(0))
        expect(get(activePopup)).toBeNull()
        act(() => vi.advanceTimersByTime(500))
        expect(get(popupData)).toEqual({})
    })

    it("el botón nuevo crea el overlay con history y lo selecciona", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("[data-title='Nuevo overlay']") as HTMLElement)
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", oldData: { id: expect.any(String) }, location: { page: "drawer", id: "overlay" } })
        expect(get(popupData)).toMatchObject({ id: "select_overlay" })
    })

    it("con más de 8 overlays muestra la búsqueda y filtra", () => {
        const many: Record<string, object> = {}
        for (let i = 0; i < 9; i += 1) many[`o${i}`] = { name: `Overlay ${i}` }
        montar({}, many)
        const input = document.querySelector("input[data-label='main.search']") as HTMLInputElement
        expect(input).toBeTruthy()
        fireEvent.change(input, { target: { value: "zz" } })
        expect(screen.getByText("Sin resultados")).toBeTruthy()
        fireEvent.change(input, { target: { value: "Overlay 3" } })
        expect(islands.Card.props.label).toBe("Overlay 3")
    })

    it("respeta hide del popupData", () => {
        montar({ hide: ["o1"] })
        expect(islands.Card.props.label).toBe("Overlay dos")
    })
})
