// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, interactions, popupData } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { InteractionInput } from "./InteractionInput"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { variables: { text: "Texto", number: "Numero" }, interaction: { multi_choice: "Multiple", heading: "Encabezado", buttons: "Botones", checkboxes: "Casillas", radio_buttons: "Radio", dropdown: "Lista", input: "Entrada", slider: "Slider", range: "Rango", add_option: "Agregar opcion" } }
let restaurar: () => void = () => {}
function montar(inputs: object[] = [], popup: object = { id: "i1" }) {
    restaurar = setStoresForTest([looseEntry(interactions, { i1: { name: "Uno", inputs } }), looseEntry(popupData, popup), storeEntry(dictionary, dict)] as never)
    return render(<InteractionInput />)
}
const guardados = () => structuredClone(get(interactions).i1.inputs)
const volver = (container: HTMLElement) => fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("InteractionInput", () => {
    it("nuevo_muestra_los_cuatro_tipos_y_todavia_no_guarda_nada", () => {
        montar()
        expect(["Multiple", "Texto", "Numero", "Encabezado"].every((text) => screen.getByText(text))).toBe(true)
        expect(guardados()).toEqual([])
    })

    it("texto_salta_la_segunda_pantalla_y_la_pregunta_guarda_una_copia", () => {
        montar()
        fireEvent.click(screen.getByText("Texto"))
        expect(fields["interaction.question"].value).toBe("")
        expect(guardados()).toEqual([])

        fire("interaction.question", "onChange", "Que hora es")
        expect(guardados()).toEqual([{ type: "text", inputType: "input", question: "Que hora es" }])

        fire("interaction.question", "onChange", "Otra")
        expect(guardados()).toEqual([{ type: "text", inputType: "input", question: "Otra" }])
    })

    it("encabezado_usa_la_etiqueta_heading_y_el_inputType_none", () => {
        montar()
        fireEvent.click(screen.getByText("Encabezado"))
        fire("interaction.heading", "onChange", "Titulo")
        expect(guardados()).toEqual([{ type: "heading", inputType: "none", question: "Titulo" }])
    })

    it("opcion_multiple_pasa_por_la_segunda_pantalla_y_el_boton_volver_regresa_a_cada_una", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Multiple"))
        expect(["Botones", "Casillas", "Radio", "Lista"].every((text) => screen.getByText(text))).toBe(true)

        volver(container)
        expect(screen.getByText("Texto")).toBeTruthy()

        fireEvent.click(screen.getByText("Multiple"))
        fireEvent.click(screen.getByText("Radio"))
        expect(fields["interaction.question"]).toBeTruthy()
        volver(container)
        expect(screen.getByText("Casillas")).toBeTruthy()
        fireEvent.click(screen.getByText("Radio"))
        fire("interaction.question", "onChange", "Q")
        expect(guardados()).toEqual([{ type: "multi_choice", inputType: "radio", question: "Q" }])
    })

    it("volver_desde_el_formulario_de_texto_regresa_a_la_primera_pantalla", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Texto"))
        volver(container)
        expect(screen.getByText("Encabezado")).toBeTruthy()
    })

    it("numeros_pasa_por_la_segunda_pantalla_y_guarda_respuesta_minimo_y_maximo", () => {
        montar()
        fireEvent.click(screen.getByText("Numero"))
        fireEvent.click(screen.getByText("Slider"))
        fire("interaction.question", "onChange", "Edad")
        expect(fields["interaction.answer (interaction.optional)"]).toMatchObject({ value: -1, min: 0, max: 1000 })
        expect(fields["interaction.min"]).toMatchObject({ value: 0, min: -10000000 })
        expect(fields["interaction.max"]).toMatchObject({ value: 1000, max: 10000000 })

        fire("interaction.answer (interaction.optional)", "onChange", 5)
        fire("interaction.min", "onChange", 2)
        fire("interaction.max", "onChange", 9)
        expect(guardados()).toEqual([{ type: "number", inputType: "slider", question: "Edad", answer: 5, min: 2, max: 9 }])
    })

    it("texto_guarda_respuesta_opcional_y_permitir_multiples", () => {
        montar([{ type: "text", inputType: "input", question: "Q" }], { id: "i1", inputIndex: 0 })
        expect(fields["interaction.answer (interaction.optional)"].value).toBe("")
        fire("interaction.answer (interaction.optional)", "onChange", "Si")
        fire("interaction.allow_multiple", "onChange", true)
        expect(guardados()).toEqual([{ type: "text", inputType: "input", question: "Q", answer: "Si", allowMultiple: true }])
        expect(fields["interaction.allow_multiple"].defaultValue).toBe(false)
    })

    it("un_input_existente_abre_el_formulario_sin_boton_volver_y_edita_el_mismo_indice", () => {
        const { container } = montar(
            [
                { type: "heading", inputType: "none", question: "A" },
                { type: "text", inputType: "input", question: "B" }
            ],
            { id: "i1", inputIndex: 1 }
        )
        expect(container.querySelector("button.popup-back")).toBeNull()
        expect(fields["interaction.question"].value).toBe("B")
        fire("interaction.question", "onChange", "C")
        expect(guardados().map((input) => (input as { question: string }).question)).toEqual(["A", "C"])
    })

    it("sin_la_interaccion_en_el_store_no_escribe", () => {
        montar([], { id: "otra" })
        fireEvent.click(screen.getByText("Texto"))
        fire("interaction.question", "onChange", "Q")
        expect(Object.keys(get(interactions))).toEqual(["i1"])
        expect(guardados()).toEqual([])
    })

    describe("opciones", () => {
        const abrir = () => {
            montar([{ type: "multi_choice", inputType: "buttons", question: "Q", options: [{ value: "a" }] }], { id: "i1", inputIndex: 0 })
        }

        it("agregar_suma_una_opcion_vacia_y_queda_deshabilitado_mientras_haya_una_vacia", () => {
            abrir()
            const agregar = screen.getByText("Agregar opcion").closest("button") as HTMLButtonElement
            expect(agregar.disabled).toBe(false)
            fireEvent.click(agregar)
            expect(guardados()[0]).toMatchObject({ options: [{ value: "a" }, { value: "" }] })
            expect((screen.getByText("Agregar opcion").closest("button") as HTMLButtonElement).disabled).toBe(true)
        })

        it("marcar_como_correcta_alterna_isAnswer", () => {
            abrir()
            fireEvent.click(document.querySelector("[data-title='interaction.mark_as_correct']") as HTMLElement)
            expect(guardados()[0]).toMatchObject({ options: [{ value: "a", isAnswer: true }] })
            fireEvent.click(document.querySelector("[data-title='interaction.mark_as_incorrect']") as HTMLElement)
            expect(guardados()[0]).toMatchObject({ options: [{ value: "a", isAnswer: false }] })
        })

        it("cambiar_el_texto_de_una_opcion_la_guarda", () => {
            abrir()
            fire("interaction.option", "onChange", "z")
            expect(guardados()[0]).toMatchObject({ options: [{ value: "z" }] })
        })

        it("enter_en_la_ultima_opcion_agrega_otra_y_en_otra_tecla_no", () => {
            abrir()
            fire("interaction.option", "onKeyDown", { key: "a" })
            expect(guardados()[0]).toMatchObject({ options: [{ value: "a" }] })
            fire("interaction.option", "onKeyDown", { key: "Enter" })
            expect(guardados()[0]).toMatchObject({ options: [{ value: "a" }, { value: "" }] })
        })

        it("eliminar_saca_la_opcion", () => {
            abrir()
            fireEvent.click(document.querySelector("[data-title='actions.remove']") as HTMLElement)
            expect(guardados()[0]).toMatchObject({ options: [] })
        })

        it("el_toggle_de_orden_aleatorio_aparece_con_mas_de_una_opcion_y_guarda_randomize", () => {
            abrir()
            expect(fields["variables.randomize"]).toBeUndefined()
            fireEvent.click(screen.getByText("Agregar opcion").closest("button") as HTMLElement)
            fire("variables.randomize", "onChange", true)
            expect(guardados()[0]).toMatchObject({ randomize: true })
            expect(fields["variables.randomize"].defaultValue).toBe(false)
        })
    })
})
