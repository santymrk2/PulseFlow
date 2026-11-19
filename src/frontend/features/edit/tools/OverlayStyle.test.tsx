// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OverlayStyle } from "./OverlayStyle"

vi.mock("./ItemsList", () => ({ ItemsList: () => <div data-items="list" /> }))

afterEach(cleanup)

describe("OverlayStyle", () => {
    it("renderiza la lista de items", () => {
        const { container } = render(<OverlayStyle allSlideItems={[]} />)
        expect(container.querySelector('[data-items="list"]')).toBeTruthy()
    })
})
