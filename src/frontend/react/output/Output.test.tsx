// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Output from "./Output"

vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="output-impl" /> }))
vi.mock("../../components/output/OutputImpl.svelte", () => ({ default: {} }))

afterEach(cleanup)

describe("Output", () => {
    it("renderiza", () => {
        const { getByTestId } = render(<Output outputId="o1" />)
        expect(getByTestId("output-impl")).toBeTruthy()
    })
})
