// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { IntersectionObserver } from "./IntersectionObserver"

afterEach(() => cleanup())

describe("IntersectionObserver", () => {
    it("renderiza_el_contenedor_y_acepta_children_funcion", () => {
        const { container } = render(<IntersectionObserver>{(intersecting) => <span>{intersecting ? "si" : "no"}</span>}</IntersectionObserver>)
        expect(container.querySelector("div")).toBeTruthy()
        expect(screen.getByText("no")).toBeTruthy()
    })
})
