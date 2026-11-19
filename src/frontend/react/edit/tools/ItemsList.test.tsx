// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, selected, timers, variables } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ItemsList } from "./ItemsList"

vi.mock("../../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../components/helpers/array", () => ({ clone: (v: unknown) => (Array.isArray(v) ? [...v] : v) }))
vi.mock("../../../components/helpers/media", () => ({ getFileName: (p: string) => p }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ rearrangeItems: vi.fn() }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "texto" }))
vi.mock("../../../components/edit/values/boxes", () => ({ itemBoxes: { text: { icon: "text" } } }))
vi.mock("../../helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ children, onClick }: { children?: unknown; onClick?: (detail: unknown) => void }) => (
        <button type="button" onClick={() => onClick?.({ ctrl: false, shift: false, detail: {}, target: null })}>
            {children as React.ReactNode}
        </button>
    )
}))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("ItemsList", () => {
    it("renderiza items cuando hay elementos", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { items: [] }), looseEntry(selected, { id: null, data: [] }), looseEntry(timers, {}), looseEntry(variables, {})])
        render(<ItemsList allSlideItems={[{ type: "text", lines: [] } as never]} />)
        expect(screen.getByText("edit.arrange_items")).toBeTruthy()
    })
})
