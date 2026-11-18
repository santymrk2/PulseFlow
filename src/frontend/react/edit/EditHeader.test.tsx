// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePopup, editMode, groups, showsCache, slideNotesActive, special, templates } from "../../stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { EditHeader } from "./EditHeader"

vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick, title }: { children?: ReactNode; onClick?: () => void; title?: string }) => (
        <button type="button" title={title} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: () => [] }))
vi.mock("../../components/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [] }) }) }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("EditHeader", () => {
    it("muestra el nombre del show y el placeholder", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { slide: 0, items: [] }), looseEntry(activePopup, null), looseEntry(editMode, "default"), looseEntry(groups, {}), looseEntry(showsCache, { s1: { name: "Show 1", settings: {} } }), looseEntry(slideNotesActive, false), looseEntry(special, {}), looseEntry(templates, {})])
        render(<EditHeader showId="s1" />)
        expect(screen.getByText("Show 1")).toBeTruthy()
    })
})
