// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { AspectRatio } from "./AspectRatio"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object) {
    restaurar = setStoresForTest([storeEntry(popupData, { trigger, ...data }), storeEntry(activePopup, "aspect_ratio"), storeEntry(dictionary, { screen: { width: "Ancho", height: "Alto" }, settings: { output_resolution_ratio: "Resolución como ratio", font_size_ratio: "Escala de fuente" } })] as never)
    return render(<AspectRatio />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AspectRatio", () => {
    it("renderiza_las_7_proporciones_y_marca_la_activa", () => {
        const { container } = montar({})
        expect(screen.getByText("16:9")).toBeTruthy()
        expect(screen.getByText("2.39:1")).toBeTruthy()
        expect([...container.querySelectorAll("button")].filter((b) => /^[\d.]+:\d+$/.test(b.textContent ?? "")).length).toBe(7)
        expect(screen.getByText("16:9").closest("button")?.classList.contains("isActive")).toBe(true)
    })

    it("elegir_otra_proporcion_llama_a_trigger_y_no_cierra", () => {
        montar({ active: { width: 16, height: 9 } })
        fireEvent.click(screen.getByText("4:3"))
        expect(trigger).toHaveBeenCalledWith({ width: 4, height: 3 })
        expect(get(activePopup)).toBe("aspect_ratio")
    })

    it("elegir_la_ya_activa_llama_a_trigger_vacia_popupData_y_cierra", () => {
        montar({})
        fireEvent.click(screen.getByText("16:9"))
        expect(trigger).toHaveBeenCalledWith({ width: 16, height: 9 })
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBeNull()
    })

    it("una_proporcion_fuera_de_la_lista_muestra_las_opciones_extra_y_la_vista_previa_cierra", () => {
        const { container } = montar({ active: { width: 5, height: 2 } })
        expect(screen.getByText("Ancho")).toBeTruthy()
        fireEvent.click(container.querySelector("div[role=button][style*=aspect-ratio]") as HTMLElement)
        expect(get(activePopup)).toBeNull()
    })

    it("el_toggle_de_resolucion_como_ratio_manda_el_active_con_la_marca", () => {
        montar({})
        fireEvent.click(screen.getByText("Resolución como ratio").closest("[role=switch]") as HTMLElement)
        expect(trigger).toHaveBeenCalledWith({ width: 16, height: 9, outputResolutionAsRatio: true })
    })

    it("el_boton_de_opciones_muestra_la_escala_de_fuente_y_cambiarla_llama_a_trigger", () => {
        const { container } = montar({})
        expect(screen.queryByText("Escala de fuente")).toBeNull()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(screen.getByText("Escala de fuente")).toBeTruthy()
        const input = [...container.querySelectorAll("input")].find((i) => i.value === "100") as HTMLInputElement
        fireEvent.change(input, { target: { value: "150" } })
        expect(trigger).toHaveBeenCalledWith({ width: 16, height: 9, fontSizeRatio: 150 })
    })
})
