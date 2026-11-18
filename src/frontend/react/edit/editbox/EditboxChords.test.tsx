// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { EditboxChords } from "./EditboxChords"

vi.mock("../../../stores", () => ({
    activeDropId: {
        subscribe: (run: (v: unknown) => void) => {
            run("")
            return () => {}
        },
        set: vi.fn()
    },
    popupData: { set: vi.fn() },
    selected: {
        subscribe: (run: (v: unknown) => void) => {
            run({})
            return () => {}
        },
        set: vi.fn()
    },
    storedChordsData: {
        subscribe: (run: (v: unknown) => void) => {
            run({})
            return () => {}
        },
        set: vi.fn()
    }
}))
vi.mock("../../../utils/popup", () => ({ waitForPopupData: vi.fn(async () => null) }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v)) }))
vi.mock("../../../components/helpers/clipboard", () => ({ deleteAction: vi.fn() }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/edit/scripts/chords", () => ({ addChords: vi.fn() }))

afterEach(cleanup)

describe("EditboxChords", () => {
    it("no renderiza nada sin líneas", () => {
        const item = { type: "text" } as unknown as Item
        const { container } = render(<EditboxChords item={item} autoSize={0} index={0} ref={{ id: "s1" }} />)
        expect(container.firstChild).toBeNull()
    })

    it("renderiza breaks cuando hay líneas y modo acordes", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "C", style: "" }] }] }
        const { container } = render(<EditboxChords item={item} autoSize={0} index={0} ref={{ id: "s1" }} chordsMode />)
        expect(container.querySelectorAll(".break").length).toBe(1)
    })
})
