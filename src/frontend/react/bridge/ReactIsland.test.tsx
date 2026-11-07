// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react"
import { mount, unmount } from "svelte"
import { describe, expect, it, vi } from "vitest"
import ReactIsland from "./ReactIsland.svelte" // Vitest corre en node y Svelte resuelve su build de servidor (mount no existe); acá se fuerza el de cliente
vi.mock("svelte", async () => vi.importActual("../../../../node_modules/svelte/src/index-client.js"))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let limpiezas = 0

interface SaludoProps {
    nombre: string
}

function Saludo({ nombre }: SaludoProps) {
    useEffect(() => () => void limpiezas++, [])
    return createElement("span", null, `Hola ${nombre}`)
}

describe("ReactIsland", () => {
    it("monta_el_componente_react_y_desmonta", async () => {
        const target = document.createElement("div")
        document.body.appendChild(target)
        let app: ReturnType<typeof mount> | undefined
        await act(async () => {
            app = mount(ReactIsland, { target, props: { component: Saludo, props: { nombre: "Ana" } } })
        })
        expect(target.textContent).toBe("Hola Ana")
        expect(limpiezas).toBe(0)

        await act(async () => {
            if (app) unmount(app)
        })
        await act(async () => {})
        expect(target.textContent).toBe("")
        expect(limpiezas).toBe(1)
    })
})
