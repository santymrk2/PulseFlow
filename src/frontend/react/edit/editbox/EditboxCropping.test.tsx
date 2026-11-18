// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EditboxCropping } from "./EditboxCropping"

vi.mock("../../../stores", () => ({
    activeShow: {
        subscribe: (run: (v: unknown) => void) => {
            run({ id: "s1" })
            return () => {}
        }
    }
}))
vi.mock("../../../utils/cursor", () => ({ startResizing: vi.fn(), stopResizing: vi.fn() }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))

afterEach(cleanup)

describe("EditboxCropping", () => {
    it("no renderiza overlay cuando no está activo", () => {
        const { container } = render(<EditboxCropping item={{ type: "media" } as any} index={0} ref={{ id: "x" }} selected={false} />)
        expect(container.querySelector(".cropOverlay")).toBeFalsy()
    })

    it("expone handle imperativo via handleRef", () => {
        const handleRef = { current: null as any }
        render(<EditboxCropping item={{ type: "media" } as any} index={0} ref={{ id: "x" }} selected handleRef={handleRef} />)
        expect(typeof handleRef.current?.handleDblclick).toBe("function")
        expect(typeof handleRef.current?.handleKeydown).toBe("function")
    })
})
