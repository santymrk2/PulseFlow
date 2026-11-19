// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../shared/utils/helpers/array", () => ({
    clone: (v: unknown) => JSON.parse(JSON.stringify(v))
}))
vi.mock("../ui/h-rule/HRule", () => ({ HRule: ({ title }: { title: string }) => <h3>{title}</h3> }))
vi.mock("./FormInput", () => ({ FormInput: ({ input }: { input: { name?: string } }) => <div data-testid="form-input">{input?.name}</div> }))

import { FormInputs } from "./FormInputs"

describe("FormInputs", () => {
    afterEach(() => cleanup())

    it("renderiza título y entradas", () => {
        const { container, getAllByTestId } = render(<FormInputs title="Opciones" inputs={[{ type: "string", name: "a" } as unknown as never, { type: "number", name: "b" } as unknown as never]} />)
        expect(container.textContent).toContain("Opciones")
        expect(getAllByTestId("form-input").length).toBe(2)
    })
})
