// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../test/mockCommon"
import { DateField } from "./DateField"

vi.mock("../../../utils/common", () => commonMock())

afterEach(cleanup)

const input = () => document.querySelector("input") as HTMLInputElement

describe("DateField", () => {
    it("renderiza_un_input_de_fecha_con_el_valor_y_el_estilo", () => {
        render(<DateField label="x" value="2026-11-07" style={{ maxWidth: "50%" }} />)
        expect(input().type).toBe("date")
        expect(input().value).toBe("2026-11-07")
        expect((document.querySelector(".textfield") as HTMLElement).style.maxWidth).toBe("50%")
    })

    it("reenvia_input_y_change_con_el_valor", () => {
        const entradas: string[] = []
        const cambios: string[] = []
        render(<DateField label="x" value="2026-11-07" onInput={(v) => entradas.push(String(v))} onChange={(v) => cambios.push(String(v))} />)
        fireEvent.input(input(), { target: { value: "2026-12-01" } })
        fireEvent.change(input(), { target: { value: "2026-12-02" } })
        expect(entradas).toEqual(["2026-12-01"])
        expect(cambios).toEqual(["2026-12-02"])
    })

    it("reset_usa_el_defaultValue", () => {
        const onChange = vi.fn()
        render(<DateField label="x" value="2026-11-07" defaultValue="2026-01-01" onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("2026-01-01")
    })
})
