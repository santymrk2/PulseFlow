// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VirtualList } from "./VirtualList"
import styles from "./VirtualList.module.css"

// happy-dom no hace layout: la altura de una fila sale de data-h de su contenido, la del viewport es fija
const VIEWPORT = 100
beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains(styles.viewport)) return VIEWPORT
        return Number(this.firstElementChild?.getAttribute("data-h") ?? 0)
    })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

const filas = (alturas: (i: number) => number, n = 100) => Array.from({ length: n }, (_, i) => ({ i, h: alturas(i) }))
const render_ = (item: { i: number; h: number }) => (
    <li data-h={item.h} data-i={item.i}>
        fila {item.i}
    </li>
)
const contents = () => document.querySelector(`.${styles.contents}`) as HTMLElement
const visibles = () => [...document.querySelectorAll("li")].map((li) => Number(li.getAttribute("data-i")))

describe("VirtualList", () => {
    it("renderiza_solo_las_filas_que_llenan_el_viewport_con_alturas_medidas", () => {
        // 40 + 40 + 40 = 120 >= 100: tres filas
        render(<VirtualList items={filas(() => 40)} height="100px" render={render_} />)
        expect(visibles()).toEqual([0, 1, 2])
        const viewport = document.querySelector(`.${styles.viewport}`) as HTMLElement
        expect(viewport.style.height).toBe("100px")
    })

    it("el_padding_inferior_usa_el_promedio_de_las_alturas_medidas", () => {
        // medidas: 10, 30, 50, 70 -> promedio (0 + 160) / 4 = 40; restan 96 filas
        render(<VirtualList items={filas((i) => 10 + 20 * i)} height="100px" render={render_} />)
        expect(visibles()).toEqual([0, 1, 2, 3])
        expect(contents().style.paddingTop).toBe("0px")
        expect(contents().style.paddingBottom).toBe(`${96 * 40}px`)
    })

    it("con_itemHeight_fijo_se_usa_ese_y_no_la_medida", () => {
        render(<VirtualList items={filas((i) => 10 + 20 * i)} height="100px" itemHeight={25} render={render_} />)
        expect(visibles()).toEqual([0, 1, 2, 3])
        expect(contents().style.paddingBottom).toBe(`${96 * 25}px`)
    })

    it("al_scrollear_el_rango_y_el_padding_superior_siguen_las_alturas_medidas", () => {
        render(<VirtualList items={filas(() => 40)} height="100px" render={render_} />)
        const viewport = document.querySelector(`.${styles.viewport}`) as HTMLElement
        Object.defineProperty(viewport, "scrollTop", { value: 200, configurable: true })
        fireEvent.scroll(viewport)
        // 200 / 40 = fila 5 arriba del todo
        expect(visibles()[0]).toBe(5)
        expect(contents().style.paddingTop).toBe(`${5 * 40}px`)
    })

    it("scroll_al_indice_activo_aterriza_en_la_fila_correcta_con_alturas_mixtas", () => {
        vi.useFakeTimers()
        const scrollTo = vi.fn()
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: scrollTo, configurable: true })
        // alturas 20 (par) y 60 (impar)
        const items = filas((i) => (i % 2 ? 60 : 20))
        render(<VirtualList items={items} height="100px" activeIndex={null} render={render_} />)
        cleanup()
        render(<VirtualList items={items} height="100px" activeIndex={3} render={render_} />)
        act(() => {
            vi.runAllTimers()
        })
        // filas 0..2 miden 20+60+20 = 100 -> la fila 3 (60) termina en 160 > 100: scrollea a 100 menos 30% del viewport
        const llamada = scrollTo.mock.calls.at(-1)?.[0] as { top: number }
        expect(llamada.top).toBe(100 - VIEWPORT * 0.3)
    })

    it("al_subir_sobre_filas_no_medidas_corrige_el_scrollTop_como_handle_scroll", () => {
        const scrollTo = vi.fn()
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: scrollTo, configurable: true })
        const real = (i: number) => (i % 2 ? 60 : 20)
        render(<VirtualList items={filas(real)} height="100px" render={render_} />)
        const viewport = document.querySelector(`.${styles.viewport}`) as HTMLElement
        const irA = (scrollTop: number) => {
            Object.defineProperty(viewport, "scrollTop", { value: scrollTop, configurable: true })
            fireEvent.scroll(viewport)
        }

        irA(0) // las filas siguientes a las visibles quedan en el height_map con el promedio
        const promedio = parseFloat(contents().style.paddingBottom) / (100 - visibles().length)
        irA(2000) // salto hacia abajo: las filas del medio no se midieron
        const s1 = visibles()[0]

        scrollTo.mockClear()
        irA(1000) // sube sobre filas no medidas
        const s2 = visibles()[0]
        expect(s2).toBeLessThan(s1)

        // handle_scroll: d = suma de alturas reales - suma de lo estimado, sólo de las filas ya renderizadas entre s2 y s1
        let d = 0
        for (let i = s2; i < Math.min(s1, s2 + visibles().length); i++) d += real(i) - promedio
        expect(d).not.toBe(0)
        expect(scrollTo).toHaveBeenLastCalledWith(0, 1000 + d)
    })

    it("sin_activeIndex_no_scrollea", () => {
        vi.useFakeTimers()
        const scrollTo = vi.fn()
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: scrollTo, configurable: true })
        render(<VirtualList items={filas(() => 40)} render={render_} />)
        act(() => {
            vi.runAllTimers()
        })
        expect(scrollTo).not.toHaveBeenCalled()
    })

    it("className_se_aplica_al_viewport", () => {
        render(<VirtualList items={filas(() => 40, 3)} className="extra" render={render_} />)
        expect(document.querySelector(`.${styles.viewport}`)?.classList.contains("extra")).toBe(true)
    })
})
