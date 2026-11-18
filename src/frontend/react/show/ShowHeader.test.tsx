// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendMain } from "../../IPC/main"
import { activeEdit, activePage, activePopup, autoOpenedTimeline, openToolsTab, outputs, showNotesActive, shows, showsCache, special, styles as stylesStore, templates } from "../../stores"
import { history } from "../../components/helpers/history"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowHeader } from "./ShowHeader"

vi.mock("../../IPC/main", () => ({ sendMain: vi.fn(), Main: { URL: "url" } }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string, _a?: unknown, params?: string[]) => (params?.[0] ? `${id} ${params[0]}` : id)) }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/output", () => ({ allOutputsHasStyleTemplate: vi.fn(() => false), getFirstActiveOutput: vi.fn(() => null) }))
vi.mock("../../components/helpers/show", () => ({ removeTemplatesFromShow: vi.fn() }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ title, onClick, children }: { title?: string; onClick?: () => void; children?: ReactNode }) => (
        <button type="button" data-title={title} onClick={onClick}>
            {children}
        </button>
    )
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(show: unknown = null) {
    restore = setStoresForTest([looseEntry(showsCache, show ? { s1: show } : {}), looseEntry(outputs, {}), looseEntry(stylesStore, {}), looseEntry(special, {}), looseEntry(templates, {}), looseEntry(showNotesActive, false), looseEntry(shows, {}), looseEntry(activeEdit, {}), looseEntry(activePage, "show"), looseEntry(activePopup, null), looseEntry(autoOpenedTimeline, false), looseEntry(openToolsTab, "tools")])
}

describe("ShowHeader", () => {
    it("muestra el nombre del show y el conteo de slides", () => {
        setStores({ id: "s1", name: "Mi show", layouts: { l1: { slides: [{}, {}] } }, settings: { activeLayout: "l1" } })
        render(<ShowHeader showId="s1" />)
        expect(screen.getByText("Mi show")).toBeTruthy()
        expect(screen.getByText(/ui\.slides 2/)).toBeTruthy()
    })

    it("muestra el placeholder de show sin nombre", () => {
        setStores({ id: "s1", layouts: {}, settings: {} })
        render(<ShowHeader showId="s1" />)
        expect(screen.getByText("main.unnamed")).toBeTruthy()
    })

    it("oculta las opciones cuando hideOptions está activo", () => {
        setStores({ id: "s1", name: "Mi show", layouts: {}, settings: {} })
        const { container } = render(<ShowHeader showId="s1" hideOptions />)
        expect(container.querySelector(".showDropdown")).toBeNull()
        expect(sendMain).not.toHaveBeenCalled()
        expect(history).not.toHaveBeenCalled()
    })
})
