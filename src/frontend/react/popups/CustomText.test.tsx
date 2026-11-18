// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { special } from "../../stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { CustomText } from "./CustomText"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../ui/textarea-field/TextareaField", async () => ({ TextareaField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(value: object) {
    restaurar = setStoresForTest([looseEntry(special, value)] as never)
    return render(<CustomText />)
}
beforeEach(() => clearFields())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CustomText", () => {
    it("muestra_el_texto_guardado_en_special_splashText", () => {
        montar({ splashText: "hola", otro: 1 })
        expect(fields["edit.text"]).toMatchObject({ value: "hola", rows: 5, placeholder: "empty.text...", autofocus: true })
    })

    it("sin_texto_guardado_arranca_vacío", () => {
        montar({})
        expect(fields["edit.text"].value).toBe("")
    })

    it("cambiar_guarda_splashText_sin_perder_el_resto_de_special", () => {
        montar({ splashText: "a", otro: 1 })
        fire("edit.text", "onChange", "nuevo")
        expect(get(special)).toEqual({ splashText: "nuevo", otro: 1 })
    })
})
