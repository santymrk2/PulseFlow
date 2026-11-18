// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BreakCountdown } from "./BreakCountdown"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("BreakCountdown", () => {
    it("sin_active_key_no_muestra_nada", () => {
        const { container } = render(<BreakCountdown breakDuration={10} />)
        expect(container.firstElementChild).toBeNull()
    })

    it("con_active_key_y_duracion_muestra_el_anillo", () => {
        vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1)
        const { container } = render(<BreakCountdown activeKey="k1" breakDuration={10} ratio={2} />)
        const svg = container.querySelector("svg")
        expect(svg).toBeTruthy()
        expect(svg?.getAttribute("width")).toBe("25")
        expect(container.querySelectorAll("circle").length).toBe(2)
    })

    it("libera_el_raf_al_cambiar_de_key", () => {
        const raf = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1)
        const cancel = vi.spyOn(globalThis, "cancelAnimationFrame")
        const { rerender } = render(<BreakCountdown activeKey="k1" breakDuration={10} />)
        expect(raf).toHaveBeenCalled()
        rerender(<BreakCountdown activeKey="k2" breakDuration={10} />)
        expect(cancel).toHaveBeenCalled()
    })
})
