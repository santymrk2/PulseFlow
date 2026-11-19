// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Date } from "./Date"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("Date", () => {
    it("renderiza_los_campos_por_defecto_con_el_anio_actual", () => {
        const { container } = render(<Date />)
        expect(container.textContent).toContain(String(new globalThis.Date().getFullYear()))
        expect(container.querySelectorAll("span").length).toBe(4)
    })

    it("respeta_un_formato_personalizado", () => {
        const { container } = render(<Date format="d,m,y" />)
        expect(container.querySelectorAll("span").length).toBe(3)
        expect(container.querySelector("span")?.textContent).toContain(new globalThis.Date().getDate() + ".")
    })

    it("actualiza_la_fecha_cada_10_segundos", () => {
        const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
        render(<Date format="d" />)
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000)
    })
})
