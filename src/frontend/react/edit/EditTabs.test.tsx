// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { EditTabs } from "./EditTabs"

vi.mock("../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick, title, isActive, disabled }: { children?: ReactNode; onClick?: () => void; title?: string; isActive?: boolean; disabled?: boolean }) => (
        <button type="button" onClick={onClick} title={title} data-active={String(!!isActive)} disabled={disabled}>
            {children}
        </button>
    )
}))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("EditTabs", () => {
    it("renderiza pestañas y cambia la activa", () => {
        restore = setStoresForTest([looseEntry(activePage, "show"), looseEntry(dictionary, {}), looseEntry(labelsDisabled, false), looseEntry(openToolsTab, "")])
        const onActiveChange = vi.fn()
        render(<EditTabs tabs={{ slide: { name: "edit.slide", icon: "slide" }, items: { name: "edit.items", icon: "items" } } as never} active="slide" onActiveChange={onActiveChange} />)
        expect(screen.getByText("edit.slide")).toBeTruthy()
        fireEvent.click(screen.getByTitle("edit.items"))
        expect(onActiveChange).toHaveBeenCalledWith("items")
    })
})
