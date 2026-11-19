// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, showNotesActive, showsCache } from "../../shared/core/stores"
import { sendMain } from "../../shared/core/ipc/main"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowNotes } from "./ShowNotes"

vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/common", () => ({ DEFAULT_WIDTH: 300 }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({
    _show: () => ({ layouts: () => ({ get: () => ["Mira https://example.com"], set: vi.fn() }) })
}))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span data-icon /> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children: unknown }) => <button>{children as never}</button> }))
vi.mock("../system/Resizeable", () => ({ Resizeable: ({ children }: { children: unknown }) => <div data-resizeable>{children as never}</div> }))
vi.mock("./tools/Notes", () => ({ Notes: ({ value }: { value: string }) => <textarea data-notes value={value} readOnly /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("ShowNotes", () => {
    it("muestra las notas con enlaces clickeables", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(showsCache, { show1: { settings: { activeLayout: "l1" }, layouts: { l1: { notes: "Nota" } } } }), looseEntry(showNotesActive, false)])
        const { container } = render(<ShowNotes />)
        const link = container.querySelector("a")!
        expect(link.getAttribute("href")).toBe("https://example.com")
        link.click()
        expect(sendMain).toHaveBeenCalled()
    })

    it("abre el editor redimensionable cuando showNotesActive está activo", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(showsCache, { show1: { settings: { activeLayout: "l1" }, layouts: { l1: {} } } }), looseEntry(showNotesActive, true)])
        const { container } = render(<ShowNotes />)
        expect(container.querySelector("[data-resizeable]")).toBeTruthy()
        expect(container.querySelector("[data-notes]")).toBeTruthy()
    })
})
