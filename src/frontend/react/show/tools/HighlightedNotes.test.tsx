// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { groups } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { HighlightedNotes } from "./HighlightedNotes"

vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/helpers/show", () => ({ getGlobalGroup: (name: string) => (name === "Grupo" ? "g1" : null) }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe("HighlightedNotes", () => {
    it("resalta los grupos conocidos en el backdrop", () => {
        restore = setStoresForTest([looseEntry(groups, { g1: { name: "Grupo", color: "#ff0000" } })])
        const { container } = render(<HighlightedNotes value="Antes [Grupo] después" />)
        const overlay = container.querySelector("[class*='highlight-overlay']")!
        expect(overlay.querySelector(".bracket-content")?.textContent).toBe("Grupo")
        expect(overlay.innerHTML).toContain("color: #ff0000 !important")
    })

    it("avisa de la edición con debounce", () => {
        vi.useFakeTimers()
        restore = setStoresForTest([looseEntry(groups, {})])
        const onEdit = vi.fn()
        const { container } = render(<HighlightedNotes value="" onEdit={onEdit} />)
        fireEvent.input(container.querySelector("textarea")!, { target: { value: "Hola" } })
        vi.advanceTimersByTime(100)
        expect(onEdit).toHaveBeenCalledWith("Hola")
    })
})
