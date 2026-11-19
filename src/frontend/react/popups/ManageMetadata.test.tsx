// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { customMetadata } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../../shared/test/kitMocks"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { ManageMetadata } from "./ManageMetadata"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/utils/helpers/show", () => ({ initializeMetadata: () => ({ number: "", title: "", artist: "" }) }))
vi.mock("../../shared/ui/kit/checkbox-field/CheckboxField", async () => ({ CheckboxField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(valor: { disabled: string[]; custom: string[] }) {
    restaurar = setStoresForTest([looseEntry(customMetadata, valor)])
    return render(<ManageMetadata />)
}
const agregar = () => screen.getByText("[settings.add]").closest("button") as HTMLButtonElement
const nombres = () => [...document.querySelectorAll("[data-field='inputs.name']")].map((el) => el.getAttribute("data-value"))
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageMetadata", () => {
    it("lista_un_checkbox_por_campo_por_defecto_marcado_si_no_esta_deshabilitado", () => {
        montar({ disabled: ["title"], custom: [] })
        expect(["meta.number", "meta.title", "meta.artist"].map((label) => fields[label].checked)).toEqual([true, false, true])
    })

    it("alternar_un_campo_actualiza_disabled_conservando_custom", () => {
        montar({ disabled: ["title"], custom: ["x"] })
        fire("meta.artist", "onChange", false)
        expect(get(customMetadata)).toEqual({ disabled: ["title", "artist"], custom: ["x"] })
        fire("meta.title", "onChange", true)
        expect(get(customMetadata)).toEqual({ disabled: ["artist"], custom: ["x"] })
        expect(fields["meta.title"].checked).toBe(true)
    })

    it("lista_los_personalizados_y_editar_cambia_el_primero_con_ese_nombre", () => {
        montar({ disabled: [], custom: ["a", "b"] })
        expect(nombres()).toEqual(["a", "b"])
        expect(fields["inputs.name"].autofocus).toBe(false)
        fire("inputs.name", "onChange", "b2")
        expect(get(customMetadata).custom).toEqual(["a", "b2"])
        expect(nombres()).toEqual(["a", "b2"])
    })

    it("agregar_suma_un_nombre_vacio_con_foco_y_queda_deshabilitado", () => {
        montar({ disabled: [], custom: ["a"] })
        expect(agregar().disabled).toBe(false)
        fireEvent.click(agregar())
        expect(get(customMetadata).custom).toEqual(["a", ""])
        expect(fields["inputs.name"].autofocus).toBe(true)
        expect(agregar().disabled).toBe(true)
        fireEvent.click(agregar())
        expect(get(customMetadata).custom).toEqual(["a", ""])
    })

    it("borrar_saca_el_primero_con_ese_nombre", () => {
        const { container } = montar({ disabled: ["title"], custom: ["a", "b"] })
        fireEvent.click(container.querySelectorAll(".row")[0].querySelector("button") as HTMLElement)
        expect(get(customMetadata)).toEqual({ disabled: ["title"], custom: ["b"] })
        expect(nombres()).toEqual(["b"])
    })
})
