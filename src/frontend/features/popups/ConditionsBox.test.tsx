// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { newToast } from "../../shared/utils/common"
import { audioRouting, dictionary, timers } from "../../shared/core/stores"
import { clearFields, fields, fire } from "../../shared/test/kitMocks"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { ConditionsBox } from "./ConditionsBox"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../shared/utils/helpers/showActions", () => ({ getDynamicIds: vi.fn(() => ["clock", "date"]), getVariablesIds: vi.fn(() => ["$variable_set_a", "$var__x"]) }))
vi.mock("../../shared/ui/kit/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(input: Record<string, string | number>, onChange = vi.fn()) {
    restaurar = setStoresForTest([
        looseEntry(timers, { t1: { name: "Zeta" }, t2: { name: "Alfa" } }),
        looseEntry(audioRouting, {
            channels: [
                { id: "main", name: "" },
                { id: "c2", name: "Coro" }
            ]
        }),
        storeEntry(dictionary, { conditions: { empty: "vacío", is: "es", is_running: "corre", is_above: "mayor" }, stage: { first_active_timer: "Primer timer" }, audio: { main: "Principal" } })
    ] as never)
    render(<ConditionsBox input={input as never} onChange={onChange} />)
    return onChange
}
const options = (label: string) => fields[label].options as { value: string; label: string }[]

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ConditionsBox", () => {
    it("renderiza_sólo_el_selector_de_tipo_sin_elemento", () => {
        montar({})
        expect(Object.keys(fields)).toEqual(["sort.type"])
        expect(options("sort.type").map((a) => a.value)).toEqual(["text", "timer", "variable", "dynamicValue", "volume"])
        expect(fields["sort.type"].value).toBe("")
    })

    it("un_texto_muestra_modo_y_valor_con_el_placeholder_vacío", () => {
        montar({ element: "text", operator: "isNot", value: "hola" })
        expect(options("actions.mode").map((a) => a.value)).toEqual(["is", "isNot", "has", "hasNot"])
        expect(fields["actions.mode"].value).toBe("isNot")
        expect(fields["variables.value"]).toMatchObject({ value: "hola", placeholder: "vacío" })
        expect(fields["tools.item"]).toBeUndefined()
    })

    it("el_modo_cae_al_primero_si_el_operador_guardado_no_existe", () => {
        montar({ element: "timer", operator: "hasNot" })
        expect(fields["actions.mode"].value).toBe("isRunning")
    })

    it("timer_ofrece_operadores_propios_primer_timer_y_los_timers_ordenados", () => {
        montar({ element: "timer", operator: "is", elementId: "t2" })
        expect(options("actions.mode").map((a) => a.value)).toEqual(["isRunning", "isAbove", "isBelow", "is", "isNot"])
        expect(options("tools.item")).toEqual([
            { value: "", label: "Primer timer" },
            { value: "t2", label: "Alfa" },
            { value: "t1", label: "Zeta" }
        ])
        expect(fields["tools.item"].value).toBe("t2")
        expect(options("actions.mode").length).toBe(5)
    })

    it("timer_con_isRunning_oculta_el_dato_y_con_otro_operador_muestra_segundos", () => {
        montar({ element: "timer", operator: "isRunning" })
        expect(fields["timer.seconds"]).toBeUndefined()
        expect(fields["variables.value"]).toBeUndefined()

        cleanup()
        restaurar()
        clearFields()
        montar({ element: "timer", operator: "isAbove", seconds: 12 })
        expect(fields["timer.seconds"]).toMatchObject({ value: 12, max: 800000 })
        expect(fields["variables.value"]).toBeUndefined()
    })

    it("variable_lista_las_variables_con_nombre_legible_y_pide_número_si_el_id_tiene_doble_guión_bajo", () => {
        montar({ element: "variable", elementId: "$var__x", index: "3" })
        expect(options("tools.item")).toEqual([
            { value: "$variable_set_a", label: "Set: a" },
            { value: "$var__x", label: "Var: x" }
        ])
        expect(fields["variables.number"]).toMatchObject({ value: 3 })
        expect(options("actions.mode").map((a) => a.value)).toEqual(["is", "isNot", "has", "hasNot", "isAbove", "isBelow"])
    })

    it("variable_sin_doble_guión_bajo_no_muestra_el_número", () => {
        montar({ element: "variable", elementId: "$variable_set_a" })
        expect(fields["variables.number"]).toBeUndefined()
    })

    it("valor_dinámico_y_volumen_arman_su_lista_de_items", () => {
        montar({ element: "dynamicValue" })
        expect(options("tools.item")).toEqual([
            { value: "clock", label: "clock" },
            { value: "date", label: "date" }
        ])

        cleanup()
        restaurar()
        clearFields()
        montar({ element: "volume", value: "-10" })
        expect(options("tools.item")).toEqual([
            { value: "main", label: "Principal" },
            { value: "c2", label: "Coro" }
        ])
        expect(fields["variables.value"].placeholder).toBe("-60 → 0")
        expect(options("actions.mode").map((a) => a.value)).toEqual(["isAbove", "isBelow", "is", "isNot"])
    })

    it("cada_campo_emite_change_con_su_clave_y_valor", () => {
        const onChange = montar({ element: "variable", elementId: "$var__x" })
        fire("sort.type", "onChange", "timer")
        fire("actions.mode", "onChange", "has")
        fire("tools.item", "onChange", "$variable_set_a")
        fire("variables.number", "onChange", 2)
        fire("variables.value", "onChange", "abc")
        expect(onChange.mock.calls.map((c) => c[0])).toEqual([
            { key: "element", value: "timer" },
            { key: "operator", value: "has" },
            { key: "elementId", value: "$variable_set_a" },
            { key: "index", value: 2 },
            { key: "value", value: "abc" }
        ])
    })

    it("segundos_emite_la_clave_seconds", () => {
        const onChange = montar({ element: "timer", operator: "is" })
        fire("timer.seconds", "onChange", 30)
        expect(onChange).toHaveBeenCalledWith({ key: "seconds", value: 30 })
    })

    it("escribir_empty_avisa_con_un_toast_y_emite_igual", () => {
        const onChange = montar({ element: "text" })
        fire("variables.value", "onChange", "empty")
        expect(newToast).toHaveBeenCalledWith("Did you mean to leave as empty/blank value?")
        expect(onChange).toHaveBeenCalledWith({ key: "value", value: "empty" })

        vi.mocked(newToast).mockClear()
        fire("variables.value", "onChange", "otra")
        expect(newToast).not.toHaveBeenCalled()
    })
})
