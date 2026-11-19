// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { getResolution } from "../../shared/utils/helpers/output"
import { openSettings } from "../settings/logic/openSettings"
import { activePopup, activeStyle, currentOutputSettings, dictionary, outputs, popupData, styles } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { clearIslands, islands } from "../../shared/test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { SelectStyle } from "./SelectStyle"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../settings/logic/openSettings", () => ({ openSettings: vi.fn() }))
vi.mock("../../shared/utils/helpers/output", () => ({ getResolution: vi.fn(() => ({ width: 1920, height: 1080 })) }))
vi.mock("../slide/logic/getStyleResolution", () => ({ getStyleResolution: vi.fn(() => "width: 100%;") }))
vi.mock("../../react/drawer/Card", async () => {
    const { islands } = await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")
    return {
        Card: (props: Record<string, unknown>) => {
            islands.Card = { props }
            return <div data-isla="Card" onClick={props.onClick as () => void} />
        }
    }
})
vi.mock("../output/Output", async () => ({ Output: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Output") }))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = {}, stylesData: object = { s1: { name: "Estilo 1" }, s2: { name: "Estilo 2", lines: 2 } }) {
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(styles, stylesData), storeEntry(currentOutputSettings, ""), looseEntry(outputs, {}), storeEntry(activeStyle, ""), storeEntry(activePopup, "select_style"), storeEntry(dictionary, { new: { style: "Nuevo estilo" }, empty: { general: "Vacío" }, guide: { skip: "Saltar" } })] as never)
    return render(<SelectStyle />)
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

describe("SelectStyle", () => {
    it("renderiza una isla Card y Output por estilo con la resolución y el override", () => {
        const { container } = montar()
        expect(container.querySelectorAll("[data-isla='Card']").length).toBe(2)
        expect(container.querySelectorAll("[data-isla='Output']").length).toBe(2)
        expect(islands.Card.props).toMatchObject({ width: 25, label: "Estilo 2", active: false })
        expect(islands.Output.props).toMatchObject({ styleIdOverride: "s2", mirror: true, style: "width: 100%;" })
        expect(getResolution).toHaveBeenCalled()
    })

    it("elegir un estilo dispara el trigger, escribe popupData y cierra", () => {
        const { container } = montar({ trigger })
        fireEvent.click(container.querySelectorAll('[data-isla="Card"]')[1] as HTMLElement)
        expect(trigger).toHaveBeenCalledWith("s2")
        expect(get(popupData)).toMatchObject({ id: "select_style", value: "s2" })
        act(() => vi.advanceTimersByTime(0))
        expect(get(activePopup)).toBeNull()
        act(() => vi.advanceTimersByTime(200))
        expect(get(popupData)).toEqual({})
    })

    it("el botón nuevo crea el estilo, lo selecciona, abre ajustes y escribe activeStyle", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("[data-title='Nuevo estilo']") as HTMLElement)
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: { name: "" } }, oldData: { id: expect.any(String) }, location: { page: "settings", id: "settings_style" } })
        expect(get(activeStyle)).not.toBe("")
        expect(openSettings).toHaveBeenCalledWith("styles")
    })

    it("skip muestra el botón que cierra el popup", () => {
        montar({ skip: true })
        fireEvent.click(screen.getByText("Saltar").closest("button") as HTMLElement)
        expect(get(activePopup)).toBeNull()
    })

    it("sin estilos muestra el mensaje vacío", () => {
        montar({}, {})
        expect(document.body.textContent).toContain("Vacío")
    })
})
