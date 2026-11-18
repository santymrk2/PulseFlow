// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../../hooks/useStore", () => ({ useStore: () => ({ v1: { name: "Var 1", type: "text" } }) }))
vi.mock("../../../stores", () => ({ variables: {} }))
vi.mock("../../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../components/helpers/array", () => ({ sortByName: (a: unknown[]) => a }))
vi.mock("../../ui/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div data-testid="select">{label}</div> }))
vi.mock("../../ui/number-field/NumberField", () => ({ NumberField: ({ label }: { label?: string }) => <div data-testid="number">{label}</div> }))
vi.mock("../../ui/text-field/TextField", () => ({ TextField: ({ label }: { label?: string }) => <div data-testid="text">{label}</div> }))
vi.mock("../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

import { VariableInputs } from "./VariableInputs"

describe("VariableInputs", () => {
    afterEach(() => cleanup())

    it("renderiza selector de variable", () => {
        const { container } = render(<VariableInputs value={{}} />)
        expect(container.textContent).toContain("items.variable")
    })
})
