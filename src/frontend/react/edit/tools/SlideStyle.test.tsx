// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activeShow, showsCache, templates } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { SlideStyle } from "./SlideStyle"

vi.mock("../../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../shared/core/values/extensions", () => ({ mediaExtensions: [], audioExtensions: [], videoExtensions: [], imageExtensions: [], presentationExtensions: [] }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/historyHelpers", () => ({ historyHelpers: {}, projectReplacers: [] }))
vi.mock("../../../features/actions/logic/apiHelper", () => ({}))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ slides: () => ({ get: () => [{ settings: {} }] }) }) }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../../../shared/ui/kit/color-field/ColorField", () => ({ ColorField: () => <div /> }))
vi.mock("../../../shared/ui/kit/file-field/FileField", () => ({ FileField: () => <div /> }))
vi.mock("../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/kit/popup-field/PopupField", () => ({ PopupField: () => <div /> }))
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
