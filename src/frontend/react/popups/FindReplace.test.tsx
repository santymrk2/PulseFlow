// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { format } from "../../components/context/menuClick"
import { activePopup, dictionary, popupData } from "../../stores"
import { newToast } from "../../utils/common"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { clearFields, fields, fire } from "../test/kitMocks"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { FindReplace } from "./FindReplace"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../components/context/menuClick", () => ({ format: vi.fn() }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const obj = { sel: { id: "slide", data: [{ index: 0 }] }, menu: { id: "find_replace" } }
let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([looseEntry(popupData, obj), storeEntry(activePopup, "find_replace"), storeEntry(dictionary, { actions: { find_replace: "Buscar y reemplazar" } })] as never)
    return render(<FindReplace />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("FindReplace", () => {
    it("renderiza_buscar_y_reemplazar_y_la_opción_de_mayúsculas_sólo_con_más_opciones", () => {
        const { container } = montar()
        expect(fields["actions.find"]).toMatchObject({ value: "", autofocus: true })
        expect(fields["actions.replace"].value).toBe("")
        expect(fields["actions.case_sensitive"]).toBeUndefined()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(fields["actions.case_sensitive"]).toMatchObject({ checked: true, defaultValue: true })
    })

    it("el_botón_llama_a_format_con_lo_escrito_vacía_popupData_y_cierra", () => {
        montar()
        fire("actions.find", "onInput", "Dios")
        fire("actions.replace", "onInput", "Señor")
        fireEvent.click(screen.getByText("Buscar y reemplazar"))
        expect(format).toHaveBeenCalledTimes(1)
        expect(format).toHaveBeenCalledWith("find_replace", obj, { findValue: "Dios", replaceValue: "Señor", caseSentitive: true })
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBeNull()
    })

    it("desmarcar_mayúsculas_se_envía_como_caseSentitive_false", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        fire("actions.case_sensitive", "onChange", false)
        fire("actions.find", "onInput", "a")
        fireEvent.click(screen.getByText("Buscar y reemplazar"))
        expect(format).toHaveBeenCalledWith("find_replace", obj, { findValue: "a", replaceValue: "", caseSentitive: false })
    })

    it("Enter_reemplaza_igual_que_el_botón", () => {
        montar()
        fire("actions.find", "onInput", "x")
        expect(triggerPopupSubmit()).toBe(true)
        expect(format).toHaveBeenCalledWith("find_replace", obj, { findValue: "x", replaceValue: "", caseSentitive: true })
    })

    it("sin_texto_a_buscar_avisa_y_no_formatea_ni_cierra", () => {
        montar()
        fireEvent.click(screen.getByText("Buscar y reemplazar"))
        expect(newToast).toHaveBeenCalledWith("empty.input")
        expect(format).not.toHaveBeenCalled()
        expect(get(activePopup)).toBe("find_replace")
        expect(get(popupData)).toEqual(obj)
    })

    it("cerrar_sin_confirmar_no_formatea_y_desregistra_Enter", () => {
        const { unmount } = montar()
        unmount()
        expect(format).not.toHaveBeenCalled()
        expect(triggerPopupSubmit()).toBe(false)
    })
})
