// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, popupData } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../shared/utils/popup"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { OutputSetup } from "./OutputSetup"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../import/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../edit/logic/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

const dict = { settings: { window: "Ventana", local_output: "Salida local", network_output: "Salida de red" }, popup: { confirm: "Confirmar" } }
let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([storeEntry(popupData, {}), storeEntry(dictionary, dict)] as never)
    return render(<OutputSetup />)
}
const confirmar = () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Confirmar") as HTMLButtonElement
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("OutputSetup", () => {
    it("muestra_los_tipos_locales_y_de_red", () => {
        montar()
        expect(screen.getByText("Salida local")).toBeTruthy()
        expect(screen.getByText("Salida de red")).toBeTruthy()
        expect(screen.getByText("Ventana")).toBeTruthy()
        expect(screen.getByText("NDI®")).toBeTruthy()
        expect(screen.getByText("RTMP")).toBeTruthy()
    })

    it("el_boton_está_deshabilitado_hasta_elegir_una_opción", () => {
        montar()
        expect(confirmar().disabled).toBe(true)
        fireEvent.click(screen.getByText("Ventana"))
        expect(confirmar().disabled).toBe(false)
    })

    it("confirmar_escribe_los_tipos_elegidos_en_popupData", () => {
        montar()
        fireEvent.click(screen.getByText("Ventana"))
        fireEvent.click(screen.getByText("NDI®"))
        fireEvent.click(confirmar())
        expect(get(popupData)).toEqual({ id: "choose_output_type", value: { localType: "window", networkType: "ndi" } })
    })

    it("volver_a_elegir_la_misma_opción_la_deselecciona", () => {
        montar()
        fireEvent.click(screen.getByText("Ventana"))
        expect(confirmar().disabled).toBe(false)
        fireEvent.click(screen.getByText("Ventana"))
        expect(confirmar().disabled).toBe(true)
    })

    it("Enter_confirma_la_selección_actual", () => {
        montar()
        fireEvent.click(screen.getByText("RTMP"))
        act(() => {
            expect(triggerPopupSubmit()).toBe(true)
        })
        expect(get(popupData)).toEqual({ id: "choose_output_type", value: { localType: "", networkType: "rtmp" } })
    })
})
