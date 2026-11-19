// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LazyLoad } from "./LazyLoad"

afterEach(cleanup)

const Cargado = () => <p>cargado</p>

describe("LazyLoad", () => {
    it("no_pide_el_componente_mientras_show_es_false", () => {
        const component = vi.fn(() => Promise.resolve({ default: Cargado }))
        render(<LazyLoad component={component} />)
        expect(component).not.toHaveBeenCalled()
        expect(screen.queryByText("cargado")).toBeNull()
    })

    it("con_show_carga_y_renderiza_el_default_una_sola_vez", async () => {
        const component = vi.fn(() => Promise.resolve({ default: Cargado }))
        const { rerender } = render(<LazyLoad component={component} show />)
        expect(await screen.findByText("cargado")).toBeTruthy()
        rerender(<LazyLoad component={component} show />)
        expect(component).toHaveBeenCalledTimes(1)
    })

    it("carga_cuando_show_pasa_a_true", async () => {
        const component = vi.fn(() => Promise.resolve({ default: Cargado }))
        const { rerender } = render(<LazyLoad component={component} show={false} />)
        rerender(<LazyLoad component={component} show />)
        expect(await screen.findByText("cargado")).toBeTruthy()
    })
})
