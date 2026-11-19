// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EffectOutput from "./EffectOutput"

vi.mock("../../shared/core/stores", () => ({ effects: { subscribe: (fn: (value: unknown) => void) => (fn({ e1: { id: "e1", items: [] } }), () => {}) } }))
vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({ e1: { id: "e1", items: [] } }) }))
vi.mock("./Effect", () => ({ Effect: () => <div data-testid="effect" />, default: () => <div data-testid="effect" /> }))
vi.mock("./OutputTransition", () => ({ OutputTransition: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>, default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))

afterEach(cleanup)

describe("EffectOutput", () => {
    it("renderiza efectos existentes", () => {
        const { getAllByTestId } = render(<EffectOutput ids={["e1", "missing"]} transition={{ type: "none", duration: 0 } as unknown as never} />)
        expect(getAllByTestId("effect").length).toBe(1)
    })
})
