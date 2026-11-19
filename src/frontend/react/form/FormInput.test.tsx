// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/core/stores", () => ({
    special: { subscribe: () => () => {} },
    activePage: { subscribe: () => () => {} },
    activeEdit: { subscribe: () => () => {} },
    activePopup: { set: vi.fn() }
}))
vi.mock("../../components/helpers/select", () => ({ select: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../ui/text-field/TextField", () => ({ TextField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} value={String(p.value ?? "")} onChange={() => {}} /> }))
vi.mock("../ui/number-field/NumberField", () => ({ NumberField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} type="number" value={Number(p.value ?? 0)} readOnly /> }))
vi.mock("../ui/checkbox-field/CheckboxField", () => ({ CheckboxField: (p: Record<string, unknown>) => <input aria-label={String(p.label ?? "")} type="checkbox" checked={!!p.checked} readOnly /> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: (p: Record<string, unknown>) => <select aria-label={String(p.label ?? "")} /> }))
vi.mock("../ui/color-field/ColorField", () => ({ ColorField: () => <div data-testid="color" /> }))
vi.mock("../ui/colors-field/ColorsField", () => ({ ColorsField: () => <div data-testid="colors" /> }))
vi.mock("../ui/date-field/DateField", () => ({ DateField: () => <input type="date" /> }))
vi.mock("../ui/time-field/TimeField", () => ({ TimeField: () => <input type="time" /> }))
vi.mock("../actions/MidiValues", () => ({ MidiValues: () => <div data-testid="midi" /> }))
vi.mock("../actions/RestValues", () => ({ RestValues: () => <div data-testid="rest" /> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button>{children}</button> }))

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
})
