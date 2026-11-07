// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireWheel } from "../test/fireWheel"
import { Autoscroll } from "./Autoscroll"
import styles from "./Autoscroll.module.css"

const scrollTo = vi.fn()
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo")

beforeEach(() => {
    vi.useFakeTimers()
    scrollTo.mockClear()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo })
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollTo", original)
    else delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo
})

const avanzar = (ms: number) =>
    act(() => {
        vi.advanceTimersByTime(ms)
    })

describe("Autoscroll", () => {
    it("renderiza_lo_principal_con_la_clase_y_el_estilo_del_padre", () => {
        render(
            <Autoscroll className="mia" style={{ display: "flex" }}>
                <span>hijo</span>
            </Autoscroll>
        )
        const div = screen.getByText("hijo").parentElement as HTMLElement
        expect(div.classList.contains(styles.scroll)).toBe(true)
        expect(div.classList.contains("mia")).toBe(true)
        expect(div.style.display).toBe("flex")
    })

    it("nace_instantaneo_y_vuelve_a_suave_tras_smoothTimeout", () => {
        render(<Autoscroll smoothTimeout={800}>x</Autoscroll>)
        const div = screen.getByText("x")
        expect(div.classList.contains(styles.instantScroll)).toBe(true)
        avanzar(800)
        expect(div.classList.contains(styles.instantScroll)).toBe(false)
    })

    it("shouldSkipSmooth_vuelve_a_hacerlo_instantaneo", () => {
        const { rerender } = render(<Autoscroll smoothTimeout={100}>x</Autoscroll>)
        avanzar(100)
        rerender(
            <Autoscroll smoothTimeout={100} shouldSkipSmooth={1}>
                x
            </Autoscroll>
        )
        expect(screen.getByText("x").classList.contains(styles.instantScroll)).toBe(true)
    })

    it("no_hace_scroll_al_montar_pero_si_cuando_cambia_offset", () => {
        const { rerender } = render(
            <Autoscroll offset={100} timeout={150}>
                x
            </Autoscroll>
        )
        avanzar(1000)
        expect(scrollTo).not.toHaveBeenCalled()
        rerender(
            <Autoscroll offset={250} timeout={150}>
                x
            </Autoscroll>
        )
        expect(screen.getByText("x").getAttribute("style")).toContain("scroll-behavior: smooth")
        avanzar(150)
        expect(scrollTo).toHaveBeenCalledWith(0, 250)
    })

    it("con_disabled_no_hace_scroll", () => {
        const { rerender } = render(
            <Autoscroll offset={-1} disabled>
                x
            </Autoscroll>
        )
        rerender(
            <Autoscroll offset={50} disabled>
                x
            </Autoscroll>
        )
        avanzar(2000)
        expect(scrollTo).not.toHaveBeenCalled()
    })

    it("scrollea_dentro_del_droparea_si_existe", () => {
        const { rerender } = render(
            <Autoscroll offset={-1} timeout={10}>
                <div className="droparea" />
            </Autoscroll>
        )
        rerender(
            <Autoscroll offset={70} timeout={10}>
                <div className="droparea" />
            </Autoscroll>
        )
        avanzar(10)
        expect(scrollTo.mock.contexts[0]).toBe(document.querySelector(".droparea"))
    })

    it("wheel_despacha_onWheel_con_el_evento_y_cancela_el_scroll_pendiente", () => {
        const onWheel = vi.fn()
        const { rerender } = render(
            <Autoscroll offset={-1} timeout={100} onWheel={onWheel}>
                x
            </Autoscroll>
        )
        rerender(
            <Autoscroll offset={90} timeout={100} onWheel={onWheel}>
                x
            </Autoscroll>
        )
        const event = fireWheel(screen.getByText("x"), { deltaY: 5 })
        expect(onWheel).toHaveBeenCalledWith({ event })
        avanzar(150)
        expect(scrollTo).not.toHaveBeenCalled()
    })

    it("entrega_el_elemento_en_scrollElem", () => {
        const ref = { current: null as HTMLDivElement | null }
        render(<Autoscroll scrollElem={ref}>x</Autoscroll>)
        expect(ref.current).toBe(screen.getByText("x"))
    })
})
