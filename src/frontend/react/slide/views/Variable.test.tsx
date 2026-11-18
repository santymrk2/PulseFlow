// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setDrawerTabData } from "../../../components/helpers/historyHelpers"
import { replaceDynamicValues } from "../../../components/helpers/showActions"
import { activeDrawerTab, drawer, variables } from "../../../stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Variable } from "./Variable"

vi.mock("../../../components/helpers/showActions", () => ({ replaceDynamicValues: vi.fn((text: string, _ref: unknown, updater: number) => `${text}:${updater}`) }))
vi.mock("../../../components/helpers/historyHelpers", () => ({ setDrawerTabData: vi.fn() }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(variables, { v1: { type: "text", text: "Hola", enabled: true }, v2: { type: "number", number: 42 }, v3: { type: "text", text: "Oculto", enabled: false }, v4: { type: "text", text: "{time_}", enabled: true } }), looseEntry(drawer, { height: 20, stored: 300 }), looseEntry(activeDrawerTab, "slide")])
})
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe("Variable", () => {
    it("renderiza_el_valor_de_la_variable_por_id", () => {
        render(<Variable id="v1" />)
        expect(screen.getByText("Hola:0")).toBeTruthy()
    })

    it("un_numero_se_muestra_sin_llamar_a_replaceDynamicValues", () => {
        render(<Variable id="v2" />)
        expect(screen.getByText("42")).toBeTruthy()
        expect(vi.mocked(replaceDynamicValues)).not.toHaveBeenCalled()
    })

    it("una_variable_deshabilitada_lleva_la_clase_hidden", () => {
        const { container } = render(<Variable id="v3" />)
        expect((container.firstElementChild as HTMLElement).className).toContain("hidden")
    })

    it("con_edit_el_doble_click_abre_la_pestana_de_variables_y_el_cajon", () => {
        render(<Variable id="v1" edit />)
        fireEvent.doubleClick(screen.getByText("Hola:0"))
        expect(setDrawerTabData).toHaveBeenCalledWith("functions", "variables")
        expect(get(activeDrawerTab)).toBe("functions")
        expect(get(drawer).height).toBe(300)
    })

    it("sin_edit_el_doble_click_no_abre_nada", () => {
        render(<Variable id="v1" />)
        fireEvent.doubleClick(screen.getByText("Hola:0"))
        expect(setDrawerTabData).not.toHaveBeenCalled()
    })

    it("con_valores_dinamicos_actualiza_el_contador_cada_segundo", () => {
        vi.useFakeTimers()
        render(<Variable id="v4" />)
        expect(screen.getByText("{time_}:0")).toBeTruthy()
        act(() => vi.advanceTimersByTime(1000))
        expect(screen.getByText("{time_}:1")).toBeTruthy()
    })
})
