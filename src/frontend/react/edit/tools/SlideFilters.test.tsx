// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeShow, showsCache, templates } from "../../../stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { SlideFilters } from "./SlideFilters"

vi.mock("../../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/historyHelpers", () => ({ historyHelpers: {}, projectReplacers: [] }))
vi.mock("../../../components/actions/apiHelper", () => ({}))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [{ data: { filter: "" } }] }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ addFilterString: () => "" }))
vi.mock("./EditValues", () => ({ EditValues: () => <div data-comp="edit-values" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("SlideFilters", () => {
    it("renderiza los filtros de slide", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(showsCache, { s1: {} }), looseEntry(activeEdit, { slide: 0 }), looseEntry(templates, {})])
        const { container } = render(<SlideFilters />)
        expect(container.querySelector('[data-comp="edit-values"]')).toBeTruthy()
    })
})
