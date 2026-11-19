// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ScenesInfo } from "./ScenesInfo"

afterEach(cleanup)

describe("ScenesInfo", () => {
    it("no renderiza nada, como el Svelte original", () => {
        const { container } = render(<ScenesInfo />)
        expect(container.innerHTML).toBe("")
    })
})
