// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../slide/Zoomed", () => ({ Zoomed: ({ children }: { children?: any }) => <div data-testid="zoomed">{children}</div> }))
vi.mock("../slide/Textbox", () => ({ Textbox: () => <div data-testid="textbox" /> }))
vi.mock("../slide/views/MediaItem", () => ({ MediaItem: () => <div data-testid="media-item" /> }))
vi.mock("../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../hooks/useStore", () => ({ useStore: () => null }))

import { Pdf } from "./Pdf"

describe("Pdf", () => {
    afterEach(() => cleanup())

    it("renderiza sin datos", () => {
        const { container } = render(<Pdf shows={[]} options={{}} />)
        expect(container.querySelector("main")).toBeTruthy()
    })

    it("renderiza contenido de presentación en modo chordSheet", () => {
        const show = {
            id: "s1",
            name: "Demo",
            type: "show",
            meta: {},
            settings: { activeLayout: "l1" },
            layouts: { l1: { slides: [{ id: "sl1" }], notes: "" } },
            slides: { sl1: { group: "Verse", items: [{ lines: [{ text: [{ value: "Hola" }] }] }] } }
        }
        const { container } = render(<Pdf shows={[show]} options={{ type: "chordSheet", title: true }} />)
        expect(container.textContent).toContain("Demo")
        expect(container.textContent).toContain("Hola")
    })
})
