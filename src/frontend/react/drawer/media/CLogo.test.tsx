// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CLogo } from "./CLogo"

afterEach(() => cleanup())

describe("CLogo", () => {
    it("renderiza_el_svg", () => {
        const { container } = render(<CLogo />)
        expect(container.querySelector("svg")).toBeTruthy()
    })
})
