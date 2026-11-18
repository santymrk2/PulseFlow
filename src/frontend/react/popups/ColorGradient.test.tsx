// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../stores"
import { triggerPopupSubmit } from "../../utils/popup"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ColorGradient } from "./ColorGradient"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../ui/color-field/ColorField", () => ({
    ColorField: (p: { value: string; onInput: (v: string) => void }) => (
        <button data-kind="color" data-value={p.value} onClick={() => p.onInput("#abcdef")}>
            color
        </button>
    )
}))
vi.mock("../ui/number-field/NumberField", () => ({
    NumberField: (p: { value: number; min: number; max: number; onChange: (v: number) => void }) => (
        <button data-kind="pos" data-value={p.value} data-min={p.min} data-max={p.max} onClick={() => p.onChange(p.value + 1)}>
            pos
        </button>
    )
}))
vi.mock("../ui/radial-field/RadialField", () => ({
    RadialField: (p: { value: number; onChange: (v: number) => void }) => (
        <button data-kind="deg" data-value={p.value} onClick={() => p.onChange(45)}>
            deg
        </button>
    )
}))
vi.mock("../ui/select-field/SelectField", () => ({
    SelectField: (p: { label: string; value: string; onChange: (v: string) => void }) => (
        <button data-kind={p.label} data-value={p.value} onClick={() => p.onChange(p.label === "sort.type" ? "radial-gradient" : "ellipse")}>
            {p.label}
        </button>
    )
}))

const BASE = "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)"
let restaurar: () => void = () => {}
function montar(data: object) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activePopup, "color_gradient"), storeEntry(dictionary, { actions: { save: "Guardar", delete: "Borrar" }, settings: { add: "Agregar" } })] as never)
    return render(<ColorGradient />)
}
const preview = (c: HTMLElement) => (c.firstElementChild as HTMLElement).style.background
const kinds = (c: HTMLElement, kind: string) => [...c.querySelectorAll(`[data-kind='${kind}']`)] as HTMLElement[]
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ColorGradient", () => {
    it("renderiza_la_vista_previa_y_una_fila_por_color", () => {
        const { container } = montar({ value: BASE })
        expect(preview(container)).toContain("linear-gradient(90deg")
        expect(kinds(container, "color").map((e) => e.dataset.value)).toEqual(["#ff0000", "#0000ff"])
        expect(kinds(container, "pos").map((e) => [e.dataset.min, e.dataset.max])).toEqual([
            ["0", "100"],
            ["0", "100"]
        ])
        expect(kinds(container, "deg")[0].dataset.value).toBe("90")
    })

    it("sin_degradado_usa_el_valor_por_defecto", () => {
        const { container } = montar({ value: "#ff0000" })
        expect(kinds(container, "color").length).toBe(3)
        expect(kinds(container, "deg")[0].dataset.value).toBe("120")
    })

    it("guardar_llama_trigger_con_el_degradado_y_cierra", () => {
        const trigger = vi.fn()
        montar({ value: BASE, trigger })
        fireEvent.click(screen.getByText("Guardar"))
        expect(trigger).toHaveBeenCalledWith("linear-gradient(90deg,#ff0000 0%,#0000ff 100%)")
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBeNull()
    })

    it("sin_trigger_guardar_igual_vacia_popupData_y_cierra", () => {
        montar({ value: BASE })
        fireEvent.click(screen.getByText("Guardar"))
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBeNull()
    })

    it("enter_guarda_con_el_valor_actual", () => {
        const trigger = vi.fn()
        const { container } = montar({ value: BASE, trigger })
        fireEvent.click(kinds(container, "color")[0])
        act(() => {
            triggerPopupSubmit()
        })
        expect(trigger).toHaveBeenCalledWith("linear-gradient(90deg,#abcdef 0%,#0000ff 100%)")
    })

    it("cambiar_color_y_posicion_actualiza_la_vista_previa", () => {
        const { container } = montar({ value: BASE })
        fireEvent.click(kinds(container, "pos")[1])
        fireEvent.click(kinds(container, "deg")[0])
        fireEvent.click(kinds(container, "color")[1])
        expect(preview(container)).toContain("45deg")
        expect(preview(container)).toContain("#abcdef")
    })

    it("pasar_a_radial_cambia_el_angulo_por_la_forma", () => {
        const trigger = vi.fn()
        const { container } = montar({ value: BASE, trigger })
        fireEvent.click(kinds(container, "sort.type")[0])
        expect(kinds(container, "color.shape")[0].dataset.value).toBe("circle")
        expect(kinds(container, "deg").length).toBe(0)
        fireEvent.click(screen.getByText("Guardar"))
        expect(trigger).toHaveBeenCalledWith("radial-gradient(circle,#ff0000 0%,#0000ff 100%)")
    })

    it("agregar_suma_un_blanco_al_100_y_con_mas_de_dos_aparece_borrar", () => {
        const { container } = montar({ value: BASE })
        expect(container.querySelectorAll("[data-title='Borrar']").length).toBe(0)
        fireEvent.click(screen.getByText("Agregar"))
        expect(kinds(container, "color").map((e) => e.dataset.value)).toEqual(["#ff0000", "#0000ff", "#ffffff"])
        expect(container.querySelectorAll("[data-title='Borrar']").length).toBe(3)
        fireEvent.click(container.querySelectorAll("[data-title='Borrar']")[0])
        expect(kinds(container, "color").map((e) => e.dataset.value)).toEqual(["#0000ff", "#ffffff"])
        expect(container.querySelectorAll("[data-title='Borrar']").length).toBe(0)
    })

    it("subir_intercambia_el_color_con_el_anterior_y_solo_existe_desde_la_segunda_fila", () => {
        const { container } = montar({ value: BASE })
        const subir = () => [...container.querySelectorAll("button")].filter((b) => !b.dataset.kind && b.textContent === "" && !b.dataset.title)
        expect(subir().length).toBe(1)
        fireEvent.click(subir()[0])
        expect(kinds(container, "color").map((e) => e.dataset.value)).toEqual(["#0000ff", "#ff0000"])
    })
})
