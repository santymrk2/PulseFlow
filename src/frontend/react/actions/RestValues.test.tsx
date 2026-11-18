// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: ({ label, onChange }: { label?: string; onChange?: (v: unknown) => void }) => <button onClick={() => onChange?.("POST")}>{label}</button> }))
vi.mock("../ui/text-field/TextField", () => ({ TextField: ({ label, value, onChange }: { label?: string; value?: string; onChange?: (v: string) => void }) => <input aria-label={label} value={value || ""} onChange={(e) => onChange?.(e.target.value)} /> }))

import { RestValues } from "./RestValues"

describe("RestValues", () => {
    afterEach(() => cleanup())

    it("renderiza campos de URL y método", () => {
        const { container } = render(<RestValues value={{ url: "http://x", method: "GET" } as unknown as never} />)
        expect(container.querySelector('input[aria-label="inputs.url"]')).toBeTruthy()
        expect(container.textContent).toContain("inputs.method")
    })

    it("emite cambios al actualizar la URL", () => {
        const onChange = vi.fn()
        const { container } = render(<RestValues value={{ url: "", method: "GET" } as unknown as never} onChange={onChange} />)
        const input = container.querySelector('input[aria-label="inputs.url"]') as HTMLInputElement
        fireEvent.change(input, { target: { value: "http://a" } })
        expect(onChange).toHaveBeenCalled()
    })
})
