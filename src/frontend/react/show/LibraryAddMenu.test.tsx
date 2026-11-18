// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LibraryAddMenu } from "./LibraryAddMenu"

vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))

afterEach(() => cleanup())

describe("LibraryAddMenu", () => {
    it("abre el menú y crea un show", () => {
        const { container } = render(<LibraryAddMenu />)
        fireEvent.click(container.querySelector("button")!)
        expect(container.querySelector('[data-slot="menu"]')).toBeTruthy()
        fireEvent.click(container.querySelectorAll('[data-slot="menu-item"]')[0]!)
        expect(container.querySelector('[data-slot="menu"]')).toBeNull()
    })

    it("no abre el menú en modo lectura", () => {
        const { container } = render(<LibraryAddMenu readOnly />)
        expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(container.querySelector("button")!)
        expect(container.querySelector('[data-slot="menu"]')).toBeNull()
    })
})
