// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { outputs, showsCache } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { FocusItem } from "./FocusItem"

vi.mock("../../../components/helpers/output", () => ({ getActiveOutputs: vi.fn(() => ["out1"]) }))
vi.mock("../AudioPreview", () => ({ AudioPreview: ({ active }: { active: { id: string } }) => <div data-audio={active.id} /> }))
vi.mock("../effect/EffectPreview", () => ({ EffectPreview: () => <div data-effect="true" /> }))
vi.mock("../folder/FolderShow", () => ({ FolderShow: ({ path }: { path: string }) => <div data-folder={path} /> }))
vi.mock("../media/MediaPreview", () => ({ MediaPreview: () => <div data-media="true" /> }))
vi.mock("../overlay/OverlayPreview", () => ({ OverlayPreview: () => <div data-overlay="true" /> }))
vi.mock("../pdf/PdfPreview", () => ({ PdfPreview: () => <div data-pdf="true" /> }))
vi.mock("../Slides", () => ({ Slides: ({ showId }: { showId: string }) => <div data-slides={showId} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(outputs, { out1: { out: { background: { path: "media1" }, overlays: [], effects: [] } } }), looseEntry(showsCache, { show1: { settings: { activeLayout: "layout1" }, layouts: { layout1: { notes: "Notas" } } } })])
}

const show = (type: string, id = "show1") => ({ id, type, index: 0 }) as never

describe("FocusItem", () => {
    it("muestra una vista de medios con outline activo", () => {
        setStores()
        const { container } = render(<FocusItem show={show("image", "media1")} />)
        expect(container.querySelector("[data-media]")).toBeTruthy()
        expect(container.firstElementChild?.className).toContain("active")
    })

    it("muestra audio, sección, overlay, efecto, pdf y carpeta", () => {
        setStores()
        const { container, rerender } = render(<FocusItem show={show("audio")} />)
        expect(container.querySelector("[data-audio]")).toBeTruthy()
        rerender(<FocusItem show={{ id: "show1", type: "section", notes: "Texto" } as never} />)
        expect(container.textContent).toContain("Texto")
        rerender(<FocusItem show={show("overlay")} />)
        expect(container.querySelector("[data-overlay]")).toBeTruthy()
        rerender(<FocusItem show={show("effect")} />)
        expect(container.querySelector("[data-effect]")).toBeTruthy()
        rerender(<FocusItem show={show("pdf")} />)
        expect(container.querySelector("[data-pdf]")).toBeTruthy()
        rerender(<FocusItem show={show("folder")} />)
        expect(container.querySelector("[data-folder]")).toBeTruthy()
    })

    it("muestra slides y notas del layout", () => {
        setStores()
        const { container } = render(<FocusItem show={show("show")} />)
        expect(container.querySelector("[data-slides]")).toBeTruthy()
        expect(container.textContent).toContain("Notas")
    })
})
