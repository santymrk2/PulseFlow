// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SlideItemTransition from "./SlideItemTransition"

vi.mock("../../shared/core/stores", () => ({ scriptureSettings: { subscribe: (fn: (value: unknown) => void) => (fn({ template: "t" }), () => {}) }, templates: { subscribe: (fn: (value: unknown) => void) => (fn({}), () => {}) } }))
vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../shared/utils/helpers/output", () => ({ getStyleTemplate: () => ({}), itemNeedsAutoSize: () => false, slideHasAutoSizeItem: () => false }))
vi.mock("./OutputTransition", () => ({ OutputTransition: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))

afterEach(cleanup)

describe("SlideItemTransition", () => {
    it("renderiza render prop", () => {
        const { container } = render(
            <SlideItemTransition globalTransition={{ type: "none", duration: 0 } as unknown as never} item={{ id: "i1" } as unknown as never}>
                {() => <span data-testid="child">x</span>}
            </SlideItemTransition>
        )
        expect(container).toBeTruthy()
    })
})
