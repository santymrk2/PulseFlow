// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData, styles } from "../../stores"
import { clearFields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { MediaFit } from "./MediaFit"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const trigger = vi.fn()
const updateCustom = vi.fn()
let restaurar: () => void = () => {}
function montar(data: object = {}) {
    restaurar = setStoresForTest([storeEntry(popupData, { active: "contain", styleId: "s1", trigger, updateCustom, ...data }), storeEntry(activePopup, "media_fit"), storeEntry(styles, { s1: { name: "Estilo", blurAmount: 8, blurOpacity: 0.4 } }), storeEntry(dictionary, { media: { contain: "Contener", cover: "Cubrir", fill: "Llenar", blur_fill: "Relleno difuso" }, edit: { blur: "Cantidad de desenfoque", opacity: "Opacidad" } })] as never)
    return render(<MediaFit />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("MediaFit", () => {
    it("renderiza_las_cuatro_opciones_y_marca_la_activa", () => {
        const { container } = montar()
        expect(screen.getByText("Contener")).toBeTruthy()
        expect(screen.getByText("Cubrir")).toBeTruthy()
        expect(screen.getByText("Llenar")).toBeTruthy()
        expect(screen.getByText("Relleno difuso")).toBeTruthy()
        expect(screen.getByText("Contener").closest("button")?.classList.contains("isActive")).toBe(true)
        expect([...container.querySelectorAll("button")].length).toBe(4)
    })

    it("elegir_otra_opcion_llama_a_trigger_y_deja_el_popup_abierto", () => {
        montar()
        fireEvent.click(screen.getByText("Cubrir"))
        expect(trigger).toHaveBeenCalledWith("cover")
        expect(get(activePopup)).toBe("media_fit")
    })

    it("elegir_la_ya_activa_cierra_el_popup", () => {
        montar()
        fireEvent.click(screen.getByText("Contener"))
        expect(trigger).toHaveBeenCalledWith("contain")
        expect(get(activePopup)).toBeNull()
    })

    it("el_boton_de_opciones_solo_aparece_en_blur_y_muestra_los_campos_del_estilo", () => {
        const { container } = montar({ active: "blur" })
        expect(container.querySelector("button.popup-options")).toBeTruthy()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(container.querySelector('[data-field="edit.blur"]')).toBeTruthy()
        expect(container.querySelector('[data-field="edit.opacity"]')).toBeTruthy()
    })

    it("sin_blur_no_hay_boton_de_opciones", () => {
        const { container } = montar()
        expect(container.querySelector("button.popup-options")).toBeNull()
    })

    it("los_campos_de_blur_mandan_los_valores_convertidos_a_updateCustom", () => {
        montar({ active: "blur" })
        const container = document.body
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)

        fire("edit.blur", "onChange", 12)
        expect(updateCustom).toHaveBeenCalledWith({ key: "blurAmount", value: 12 })

        fire("edit.opacity", "onChange", 50)
        expect(updateCustom).toHaveBeenCalledWith({ key: "blurOpacity", value: 0.5 })
    })
})
