// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../shared/core/stores", () => ({
    emitters: { subscribe: (fn: (v: unknown) => void) => { fn({}); return () => {} }, update: vi.fn() },
    actions: { subscribe: (fn: (v: unknown) => void) => { fn({}); return () => {} }, update: vi.fn() },
    popupData: { subscribe: (fn: (v: unknown) => void) => { fn(null); return () => {} }, set: vi.fn() },
    activePopup: { set: vi.fn() }
}))
vi.mock("uid", () => ({ uid: () => "id" }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)), keysToID: () => [], sortByName: (a: unknown[]) => a }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getDynamicValue: (v: unknown) => v }))
vi.mock("./logic/emitters", () => ({ formatData: {} }))
vi.mock("../../shared/ui/kit/button/Button", () => ({ Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }))
vi.mock("../../shared/ui/kit/dynamic-list/DynamicList", () => ({ DynamicList: () => <div data-testid="dynamic-list" /> }))
vi.mock("../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../shared/ui/kit/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div data-testid="select">{label}</div> }))
vi.mock("../../shared/ui/kit/text-field/TextField", () => ({ TextField: ({ label }: { label?: string }) => <div data-testid="text">{label}</div> }))
vi.mock("./MidiValues", () => ({ MidiValues: () => <div data-testid="midi" /> }))

import { ChooseEmitter } from "./ChooseEmitter"

describe("ChooseEmitter", () => {
    afterEach(() => cleanup())

    it("renderiza selector de emisor", () => {
        const { container } = render(<ChooseEmitter value={{ emitter: "", template: "", templateValues: [] } as unknown as never} />)
        expect(container.textContent).toContain("emitters.emitter")
    })
})
