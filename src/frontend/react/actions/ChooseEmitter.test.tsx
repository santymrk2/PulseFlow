// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("../hooks/useStore", () => ({ useStore: () => ({}) }))
vi.mock("../../stores", () => ({
    emitters: { subscribe: (fn: (v: unknown) => void) => { fn({}); return () => {} }, update: vi.fn() },
    actions: { subscribe: (fn: (v: unknown) => void) => { fn({}); return () => {} }, update: vi.fn() },
    popupData: { subscribe: (fn: (v: unknown) => void) => { fn(null); return () => {} }, set: vi.fn() },
    activePopup: { set: vi.fn() }
}))
vi.mock("uid", () => ({ uid: () => "id" }))
vi.mock("../../utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)), keysToID: () => [], sortByName: (a: unknown[]) => a }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getDynamicValue: (v: unknown) => v }))
vi.mock("../../components/actions/emitters", () => ({ formatData: {} }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }))
vi.mock("../ui/dynamic-list/DynamicList", () => ({ DynamicList: () => <div data-testid="dynamic-list" /> }))
vi.mock("../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: ({ label }: { label?: string }) => <div data-testid="select">{label}</div> }))
vi.mock("../ui/text-field/TextField", () => ({ TextField: ({ label }: { label?: string }) => <div data-testid="text">{label}</div> }))
vi.mock("./MidiValues", () => ({ MidiValues: () => <div data-testid="midi" /> }))

import { ChooseEmitter } from "./ChooseEmitter"

describe("ChooseEmitter", () => {
    afterEach(() => cleanup())

    it("renderiza selector de emisor", () => {
        const { container } = render(<ChooseEmitter value={{ emitter: "", template: "", templateValues: [] } as unknown as never} />)
        expect(container.textContent).toContain("emitters.emitter")
    })
})
