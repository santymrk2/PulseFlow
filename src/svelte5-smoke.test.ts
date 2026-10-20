import { writable } from "svelte/store"
import { describe, expect, it, vi } from "vitest"
import { render } from "svelte/server"

// El botón único importa el idioma y los stores de la app (tooltips traducidos e íconos). Se cortan acá: la
// cadena llega a pdfjs, que necesita DOM, y este test corre en node.
vi.mock("./frontend/utils/language", () => ({ translateText: (id: string) => `T(${id})` }))
vi.mock("./frontend/stores", () => ({ dictionary: writable({}), activePopup: writable(null), localeDirection: writable("ltr"), selected: writable({ id: null, data: [] }) }))

import Button from "./frontend/lib/components/ui/button/button.svelte"

// Smoke test: prueba que el compilador y el runtime de Svelte 5 renderizan un componente (SSR con
// `svelte/server`) y fija el contrato del botón único (F14.8a): variante `ghost` y tamaño `sm` por defecto.
describe("Svelte 5 runtime", () => {
    it("renderiza el botón con la variante y el tamaño por defecto", () => {
        const { html } = render(Button, { props: {} })

        expect(html).toContain("<button")
        expect(html).toMatch(/class="btn ghost sm\b/)
    })

    it("aplica las clases de variante y tamaño", () => {
        const { html } = render(Button, { props: { variant: "default", size: "md" } })

        expect(html).toMatch(/class="btn default md\b/)
    })

    it("marca los estados con clases (las usan los CSS de los padres)", () => {
        const { html } = render(Button, { props: { isActive: true, red: true, tab: true } })

        expect(html).toContain("isActive")
        expect(html).toContain("red")
        expect(html).toContain("tab")
    })

    it("deshabilita el botón", () => {
        const { html } = render(Button, { props: { disabled: true } })

        expect(html).toContain("disabled")
        expect(html).toContain('tabindex="-1"')
    })

    it("traduce `title` al tooltip y deja pasar un `data-title` directo", () => {
        const withTitle = render(Button, { props: { title: "menu.search" } }).html
        expect(withTitle).toContain('data-title="T(menu.search)"')

        const direct = render(Button, { props: { "data-title": "Buscar" } }).html
        expect(direct).toContain('data-title="Buscar"')
    })

    it("un botón sólo con ícono se marca `iconOnly`", () => {
        const { html } = render(Button, { props: { icon: "add" } })

        expect(html).toContain("iconOnly")
    })
})
