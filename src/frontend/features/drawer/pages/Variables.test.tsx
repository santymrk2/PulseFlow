// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeProfile, activeVariableTagFilter, dictionary, labelsDisabled, profiles, randomNumberVariable, selected, variables } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Variables } from "./Variables"

const { resetVariableMock, setRandomValueMock } = vi.hoisted(() => ({ resetVariableMock: vi.fn(), setRandomValueMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../components/actions/apiHelper", () => ({ resetVariable: resetVariableMock }))
vi.mock("../../../shared/utils/helpers/randomValue", () => ({ getSetChars: () => 4, setRandomValue: setRandomValueMock }))

const dict = {
    empty: { general: "Vacío" },
    main: { unnamed: "Sin nombre" },
    actions: { reset: "Reiniciar", decrement: "Restar", increment: "Sumar" },
    variables: { value: "Valor", step: "Paso", number: "Número", randomize: "Aleatorizar" },
    new: { variable: "Nueva variable" },
    media: { previous: "Anterior", next: "Siguiente" }
}

const baseVariable = (extra: Record<string, unknown> = {}) => ({ name: "Var", type: "number", ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(variables, { v1: baseVariable({ number: 5 }) } as never), storeEntry(activeVariableTagFilter, []), storeEntry(randomNumberVariable, {}), storeEntry(activeProfile, null), storeEntry(profiles, {}), storeEntry(labelsDisabled, false), storeEntry(selected, { id: null, data: [] } as never), storeEntry(activePopup, null)])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Variables", () => {
    it("sin variables muestra el vacío", () => {
        act(() => variables.set({}))
        render(<Variables />)
        expect(screen.getByText("Vacío")).toBeTruthy()
    })

    it("los botones suman y restan respetando el paso", () => {
        render(<Variables />)
        fireEvent.click(document.querySelector("#increment") as HTMLElement)
        expect(get(variables).v1.number).toBe(6)
        fireEvent.click(document.querySelector("#decrement") as HTMLElement)
        expect(get(variables).v1.number).toBe(5)
    })

    it("el reset usa el valor por defecto", () => {
        act(() => variables.set({ v1: baseVariable({ number: 9, default: 2 }) } as never))
        render(<Variables />)
        fireEvent.click(document.querySelector('[data-title="Reiniciar"]') as HTMLElement)
        expect(get(variables).v1.number).toBe(2)
    })

    it("el texto editable actualiza la variable al confirmar", () => {
        act(() => variables.set({ v1: baseVariable({ type: "text", text: "hola", enabled: true }) } as never))
        render(<Variables />)
        const input = document.querySelector("input") as HTMLInputElement
        fireEvent.change(input, { target: { value: "chau" } })
        expect(get(variables).v1.text).toBe("chau")
    })

    it("los conjuntos de texto avanzan y retroceden", () => {
        act(() => variables.set({ v1: baseVariable({ type: "text_set", activeTextSet: 0, textSets: [{ a: "1" }, { a: "2" }], textSetKeys: ["a"] }) } as never))
        render(<Variables />)
        fireEvent.click(screen.getByText("Siguiente").closest("button") as HTMLElement)
        expect(get(variables).v1.activeTextSet).toBe(1)
        fireEvent.click(screen.getByText("Anterior").closest("button") as HTMLElement)
        expect(get(variables).v1.activeTextSet).toBe(0)
    })

    it("el aleatorio pide una nueva tirada", () => {
        act(() => variables.set({ v1: baseVariable({ type: "random_number", number: 12, sets: [{ name: "", minValue: 1, maxValue: 9 }] }) } as never))
        render(<Variables />)
        fireEvent.click(document.querySelector("#randomize") as HTMLElement)
        expect(setRandomValueMock).toHaveBeenCalledWith("v1")
    })

    it("con acceso de sólo lectura deshabilita la nueva variable", () => {
        act(() => {
            activeProfile.set("p1")
            profiles.set({ p1: { access: { variables: { global: "read" } } } } as never)
        })
        render(<Variables />)
        expect((document.querySelector('[data-title="Nueva variable"]') as HTMLButtonElement).disabled).toBe(true)
    })

    it("la nueva variable limpia la selección y abre el popup", () => {
        act(() => selected.set({ id: "scene", data: [{ index: 0 }] } as never))
        render(<Variables />)
        fireEvent.click(document.querySelector('[data-title="Nueva variable"]') as HTMLElement)
        expect(get(selected)).toEqual({ id: null, data: [] })
        expect(get(activePopup)).toBe("variable")
    })
})
