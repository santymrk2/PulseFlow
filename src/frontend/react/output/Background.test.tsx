// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Background from "./Background"

vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="bg-media" /> }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../components/output/layers/BackgroundMedia.svelte", () => ({ default: {} }))

afterEach(cleanup)

describe("Background", () => {
    it("renderiza sin datos", () => {
        const { container } = render(<Background data={{} as unknown as never} outputId="o1" transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(container).toBeTruthy()
    })
})
