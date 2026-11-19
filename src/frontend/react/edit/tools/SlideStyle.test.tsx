// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeShow, showsCache, templates } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { SlideStyle } from "./SlideStyle"

vi.mock("../../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../shared/core/values/extensions", () => ({ mediaExtensions: [], audioExtensions: [], videoExtensions: [], imageExtensions: [], presentationExtensions: [] }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/historyHelpers", () => ({ historyHelpers: {}, projectReplacers: [] }))
vi.mock("../../../components/actions/apiHelper", () => ({}))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../components/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [{ settings: {} }] }) }) }))
vi.mock("../../ui/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../../ui/color-field/ColorField", () => ({ ColorField: () => <div /> }))
vi.mock("../../ui/file-field/FileField", () => ({ FileField: () => <div /> }))
vi.mock("../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../ui/popup-field/PopupField", () => ({ PopupField: () => <div /> }))
vi.mock("./ItemsList", () => ({ ItemsList: () => <div data-items="list" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("SlideStyle", () => {
    it("renderiza estilo de slide", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { slide: 0 }), looseEntry(activeShow, { id: "show1" }), looseEntry(activePage, "edit"), looseEntry(showsCache, { show1: { slides: {} } }), looseEntry(templates, {})])
        const { container } = render(<SlideStyle allSlideItems={[]} />)
        expect(container.querySelector('[data-items="list"]')).toBeTruthy()
    })
})
