// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Effect from "./Effect"

vi.mock("../../shared/core/stores", () => ({
    effects: { update: (fn: (value: unknown) => void) => fn({}), subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) },
    hoveredEffectItem: { subscribe: (fn: (value: unknown) => void) => (fn(null), () => {}) }
}))
vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => null }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)), getChangedKeys: () => [] }))
vi.mock("../../components/output/effects/effectRenderer", () => ({
    EffectRender: class {
        highlightedIndex: number | null = null
        stop() {}
        updateItems() {}
    }
}))

afterEach(cleanup)

describe("Effect", () => {
    it("renderiza canvas", () => {
        const { container } = render(<Effect effect={{ id: "e1", items: [] } as unknown as never} />)
        expect(container.querySelector("canvas")).toBeTruthy()
    })
})
