// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxCropping } from "./EditboxCropping"

vi.mock("../../../stores", () => ({
    activeShow: {
        subscribe: (run: (v: unknown) => void) => {
            run({ id: "show1" })
            return () => {}
        }
    }
}))
vi.mock("../../../utils/cursor", () => ({ startResizing: vi.fn(), stopResizing: vi.fn() }))
vi.mock("../../../components/helpers/cropping", async () => {
    const actual = await vi.importActual<typeof import("../../../components/helpers/cropping")>("../../../components/helpers/cropping")
    return actual
})
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))

afterEach(cleanup)

describe("EditboxCropping", () => {
    it("no renderiza overlay cuando no está en modo crop", () => {
        const item: Item = { type: "media", style: "" }
        const { container } = render(<EditboxCropping item={item} index={0} ref={{ id: "s1" }} selected={false} />)
        expect(container.firstChild).toBeNull()
    })
})
