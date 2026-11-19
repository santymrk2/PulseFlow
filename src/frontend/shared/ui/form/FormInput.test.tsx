// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../core/stores", () => ({
    special: { subscribe: () => () => {} },
    activePage: { subscribe: () => () => {} },
    activeEdit: { subscribe: () => () => {} },
    activePopup: { set: vi.fn() }
}))
vi.mock("../../utils/helpers/select", () => ({ select: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../kit/text-field/TextField", () => ({ TextField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} value={String(p.value ?? "")} onChange={() => {}} /> }))
vi.mock("../kit/number-field/NumberField", () => ({ NumberField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} type="number" value={Number(p.value ?? 0)} data-style-type={typeof p.style} style={p.style as never} readOnly /> }))
vi.mock("../kit/checkbox-field/CheckboxField", () => ({ CheckboxField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} type="checkbox" checked={!!p.checked} readOnly /> }))
vi.mock("../kit/select-field/SelectField", () => ({ SelectField: (p: Record<string, unknown>) => <select aria-label={String(p.label ?? "")} /> }))
vi.mock("../kit/color-field/ColorField", () => ({ ColorField: () => <div data-testid="color" /> }))
vi.mock("../kit/colors-field/ColorsField", () => ({ ColorsField: () => <div data-testid="colors" /> }))
vi.mock("../kit/date-field/DateField", () => ({ DateField: () => <input type="date" /> }))
vi.mock("../kit/time-field/TimeField", () => ({ TimeField: () => <input type="time" /> }))
vi.mock("../../../features/actions/MidiValues", () => ({ MidiValues: () => <div data-testid="midi" /> }))
vi.mock("../../../features/actions/RestValues", () => ({ RestValues: () => <div data-testid="rest" /> }))
vi.mock("../kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button>{children}</button> }))

import { FormInput } from "./FormInput"

describe("FormInput", () => {
    afterEach(() => cleanup())

    it("renderiza un campo de texto para input string", () => {
        const { container } = render(<FormInput input={{ type: "string", name: "Nombre", value: "abc" } as unknown as never} />)
        expect(container.querySelector("input")).toBeTruthy()
    })

    it("renderiza checkbox para input checkbox", () => {
        const { container } = render(<FormInput input={{ type: "checkbox", name: "Activo", value: true } as unknown as never} />)
        expect(container.querySelector('input[type="checkbox"]')).toBeTruthy()
    })

    it("convierte el style string del input a objeto antes de pasarlo al campo (F01)", () => {
        const { container } = render(<FormInput input={{ type: "number", name: "N", value: 1, style: "flex: 1;" } as unknown as never} />)
        const field = container.querySelector("input") as HTMLInputElement
        expect(field.getAttribute("data-style-type")).toBe("object")
        expect(field.style.flex).toContain("1")
    })
})
