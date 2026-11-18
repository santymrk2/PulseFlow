// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Preview from "./Preview"

vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="preview-impl" /> }))
vi.mock("../../components/output/preview/PreviewImpl.svelte", () => ({ default: {} }))

afterEach(cleanup)

describe("Preview", () => {
    it("renderiza", () => {
        const { getByTestId } = render(<Preview />)
        expect(getByTestId("preview-impl")).toBeTruthy()
    })
})
