// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Show from "./Show"

vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="show-impl" /> }))
vi.mock("../../components/output/tools/ShowImpl.svelte", () => ({ default: {} }))

afterEach(cleanup)

describe("Show", () => {
    it("renderiza", () => {
        const { getByTestId } = render(<Show currentOutput={{ out: {} } as unknown as never} ref={[]} linesIndex={null} maxLines={null} />)
        expect(getByTestId("show-impl")).toBeTruthy()
    })
})
