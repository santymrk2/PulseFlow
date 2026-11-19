// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeShow, copyPasteEdit, overlays, selected, showsCache, storedEditMenuState, templates } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { EditTools } from "./EditTools"

vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({ global: "full" }) }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [], isSlideLocked: () => false }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [] }) }) }))
vi.mock("../../shared/utils/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../components/edit/scripts/itemClipboard", () => ({ getBoxStyle: () => ({}), getFilterStyle: () => ({}), getItemStyle: () => ({}), getSlideStyle: () => ({}), setBoxStyle: vi.fn(), setFilterStyle: vi.fn(), setItemStyle: vi.fn(), setSlideStyle: vi.fn() }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ DEFAULT_ITEM_STYLE: "" }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ addStyleString: () => "" }))
vi.mock("../../components/edit/values/boxes", () => ({ itemBoxes: { text: { icon: "text" } } }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("./EditTabs", () => ({ EditTabs: () => <div data-tabs="edit" /> }))
vi.mock("./tools/BoxStyle", () => ({ BoxStyle: () => <div /> }))
vi.mock("./tools/ItemStyle", () => ({ ItemStyle: () => <div /> }))
vi.mock("./tools/OverlayStyle", () => ({ OverlayStyle: () => <div /> }))
vi.mock("./tools/SlideFilters", () => ({ SlideFilters: () => <div /> }))
vi.mock("./tools/SlideStyle", () => ({ SlideStyle: () => <div /> }))
vi.mock("./tools/TemplateStyle", () => ({ TemplateStyle: () => <div /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("EditTools", () => {
    it("muestra estado vacío cuando no hay slide activo", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { items: [], slide: null }), looseEntry(activeShow, null), looseEntry(copyPasteEdit, {}), looseEntry(overlays, {}), looseEntry(selected, { id: null, data: [] }), looseEntry(showsCache, {}), looseEntry(storedEditMenuState, {}), looseEntry(templates, {})])
        const { container } = render(<EditTools />)
        expect(container).toBeTruthy()
    })
})
