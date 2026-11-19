// @vitest-environment happy-dom
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { dictionary } from "../../core/stores"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { T } from "./T"

const DICCIONARIO = {
    toast: { save_error: "No se pudo", greet: "Hola $1", list: "uno{}dos", upper: "ABC" }
}

let restaurar: () => void = () => {}

function conDiccionario() {
    restaurar = setStoresForTest([storeEntry(dictionary, DICCIONARIO)])
}

function textoDe(ui: Parameters<typeof render>[0]) {
    return render(ui).container.textContent
}

afterEach(() => restaurar())

describe("T", () => {
    it("traduce_la_clave_categoria_punto_clave", () => {
        conDiccionario()
        expect(textoDe(<T id="toast.save_error" />)).toBe("No se pudo")
    })

    it("reemplaza_los_placeholders_con_replace", () => {
        conDiccionario()
        expect(textoDe(<T id="toast.greet" replace={["Ana"]} />)).toBe("Hola Ana")
    })

    it("pasa_a_minusculas_con_lowercase", () => {
        conDiccionario()
        expect(textoDe(<T id="toast.upper" lowercase />)).toBe("abc")
    })

    it("elige_la_parte_de_index_al_partir_por_llaves_vacias", () => {
        conDiccionario()
        expect(textoDe(<T id="toast.list" index={1} />)).toBe("dos")
    })

    it("ignora_los_marcadores_$_y_:$", () => {
        conDiccionario()
        expect(textoDe(<T id="$:toast.save_error:$" />)).toBe("No se pudo")
    })

    it("clave_inexistente_muestra_el_id_entre_corchetes", () => {
        conDiccionario()
        expect(textoDe(<T id="toast.no_existe" />)).toBe("[toast.no_existe]")
    })

    it("id_sin_punto_muestra_el_id_entre_corchetes", () => {
        conDiccionario()
        expect(textoDe(<T id="sinpunto" />)).toBe("[sinpunto]")
    })
})
