// @vitest-environment happy-dom
import { act, createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { tick } from "svelte"
import { afterEach, describe, expect, it, vi } from "vitest"
import Saludo from "./__fixtures__/Saludo.svelte"
import { SvelteIsland } from "./SvelteIsland" // Vitest corre en node y Svelte resuelve su build de servidor (mount no existe); acá se fuerza el de cliente
vi.mock("svelte", async () => vi.importActual("../../../../node_modules/svelte/src/index-client.js"))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

describe("SvelteIsland", () => {
    it("renderiza_el_componente_svelte", () => {
        render(createElement(SvelteIsland, { component: Saludo, props: { nombre: "Ana" } }))
        expect(screen.getByText("Hola Ana")).toBeTruthy()
    })

    it("actualiza_las_props_al_re_renderizar", async () => {
        const { rerender } = render(createElement(SvelteIsland, { component: Saludo, props: { nombre: "Ana" } }))
        await act(async () => {
            rerender(createElement(SvelteIsland, { component: Saludo, props: { nombre: "Beto" } }))
            await tick()
        })
        expect(screen.getByText("Hola Beto")).toBeTruthy()
    })

    it("reenvia_los_eventos_con_el_mismo_detail", () => {
        const saludo = vi.fn()
        render(createElement(SvelteIsland, { component: Saludo, props: { nombre: "Beto" }, events: { saludo } }))
        fireEvent.click(screen.getByText("Saludar"))
        expect(saludo).toHaveBeenCalledTimes(1)
        expect(saludo.mock.calls[0][0].detail).toBe("Beto")
    })

    it("vacia_el_contenedor_al_desmontar", () => {
        const { container, unmount } = render(createElement(SvelteIsland, { component: Saludo, props: { nombre: "Ana" } }))
        expect(container.textContent).toContain("Hola Ana")
        unmount()
        expect(container.textContent).toBe("")
    })
})
