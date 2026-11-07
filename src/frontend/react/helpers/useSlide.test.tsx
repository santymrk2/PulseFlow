// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SLIDE_EASING, useSlide } from "./useSlide"

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete (Element.prototype as { animate?: unknown }).animate
})

function Panel({ open }: { open: boolean }) {
    const slide = useSlide<HTMLDivElement>(open, 200)
    return slide.mounted ? <div ref={slide.ref}>panel</div> : null
}

function mockAnimate() {
    let terminar: () => void = () => {}
    const finished = new Promise<Animation>((resolve) => {
        terminar = () => resolve({} as Animation)
    })
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ finished, cancel }))
    Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate })
    return { animate, cancel, terminar }
}

describe("useSlide", () => {
    it("al_abrir_monta_y_anima_de_0_a_lo_medido_con_la_duracion_y_el_easing", () => {
        const { animate } = mockAnimate()
        const { rerender } = render(<Panel open={false} />)
        expect(screen.queryByText("panel")).toBeNull()
        expect(animate).not.toHaveBeenCalled()
        rerender(<Panel open />)
        expect(screen.getByText("panel")).toBeTruthy()
        expect(animate).toHaveBeenCalledTimes(1)
        const [keyframes, opciones] = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
        expect(opciones).toEqual(expect.objectContaining({ duration: 200, easing: SLIDE_EASING }))
        expect(SLIDE_EASING).toBe("cubic-bezier(0.215, 0.61, 0.355, 1)")
        expect(keyframes[0]).toEqual(expect.objectContaining({ height: "0px", opacity: 0, paddingTop: "0px", marginBottom: "0px", borderTopWidth: "0px", overflow: "hidden" }))
        expect(keyframes[keyframes.length - 1]).toHaveProperty("height")
    })

    it("al_cerrar_sigue_montado_hasta_que_finished_resuelve_y_despues_se_desmonta", async () => {
        const { animate, terminar } = mockAnimate()
        const { rerender } = render(<Panel open />)
        rerender(<Panel open={false} />)
        expect(animate).toHaveBeenCalledTimes(2)
        const [keyframes] = animate.mock.calls[1] as unknown as [Keyframe[]]
        expect(keyframes[keyframes.length - 1]).toEqual(expect.objectContaining({ height: "0px", opacity: 0 }))
        expect(screen.getByText("panel")).toBeTruthy()
        await act(async () => {
            terminar()
        })
        expect(screen.queryByText("panel")).toBeNull()
    })

    it("reabrir_antes_de_terminar_cancela_la_salida_y_no_desmonta", async () => {
        const { cancel, terminar } = mockAnimate()
        const { rerender } = render(<Panel open />)
        rerender(<Panel open={false} />)
        rerender(<Panel open />)
        expect(cancel).toHaveBeenCalled()
        await act(async () => {
            terminar()
        })
        expect(screen.getByText("panel")).toBeTruthy()
    })

    it("sin_animate_monta_y_desmonta_sin_animar", () => {
        expect((Element.prototype as { animate?: unknown }).animate).toBeUndefined()
        const { rerender } = render(<Panel open={false} />)
        rerender(<Panel open />)
        expect(screen.getByText("panel")).toBeTruthy()
        rerender(<Panel open={false} />)
        expect(screen.queryByText("panel")).toBeNull()
    })
})
