// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MediaGrid } from "./MediaGrid"

class FakeResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe = vi.fn(() => this.callback([{ contentRect: { height: 400 } }] as ResizeObserverEntry[], this as unknown as ResizeObserver))
    unobserve = vi.fn()
    disconnect = vi.fn()
}

beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number)
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe("MediaGrid", () => {
    it("renderiza_el_primer_item_y_placeholders_para_el_resto", () => {
        const { container } = render(<MediaGrid items={["a", "b", "c"]} columns={2} render={(item) => <span>{String(item)}</span>} />)
        expect(screen.getByText("a")).toBeTruthy()
        expect(container.querySelectorAll("[style*='height']").length).toBeGreaterThan(0)
    })

    it("respeta_el_numero_de_columnas_en_el_ancho", () => {
        const { container } = render(<MediaGrid items={["a", "b"]} columns={4} render={(item) => <span>{String(item)}</span>} />)
        expect(container.innerHTML).toContain("width: 25%")
    })

    it("actualiza_la_visible_al_hacer_scroll", () => {
        render(<MediaGrid items={["a", "b", "c", "d", "e"]} columns={1} render={(item) => <span>{String(item)}</span>} />)
        const grid = document.querySelector("[class*='grid']") as HTMLElement
        act(() => {
            fireEvent.scroll(grid, { target: { scrollTop: 1000 } })
        })
        expect(screen.getByText("a")).toBeTruthy()
    })
})
