// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxChords } from "./EditboxChords"

vi.mock("../../../shared/core/stores", () => ({
    activeDropId: {
        subscribe: (r: any) => {
            r("")
            return () => {}
        },
        set: vi.fn()
    },
    popupData: { set: vi.fn() },
    selected: { set: vi.fn() },
    storedChordsData: {
        subscribe: (r: any) => {
            r({})
            return () => {}
        },
        set: vi.fn()
    }
}))
vi.mock("../../../shared/utils/popup", () => ({ waitForPopupData: vi.fn(async () => null) }))
vi.mock("../../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../shared/utils/helpers/clipboard", () => ({ deleteAction: vi.fn() }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../logic/scripts/chords", () => ({ addChords: vi.fn() }))

afterEach(cleanup)

describe("EditboxChords", () => {
    it("renderiza contenedor de acordes para ítems con líneas", () => {
        const item: Item = { lines: [{ align: "", text: [{ value: "Do", style: "" }], chords: [] }] } as any
        const { container } = render(<EditboxChords item={item} index={0} ref={{ id: "s1" }} chordsMode />)
        expect(container.querySelector(".edit.chords")).toBeTruthy()
    })

    it("no renderiza nada sin líneas", () => {
        const item: Item = { type: "text" } as any
        const { container } = render(<EditboxChords item={item} index={0} ref={{ id: "s1" }} />)
        expect(container.firstChild).toBeNull()
    })
})
