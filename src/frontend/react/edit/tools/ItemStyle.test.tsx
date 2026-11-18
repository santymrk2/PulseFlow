// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeShow, selected, showsCache } from "../../../stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ItemStyle } from "./ItemStyle"

vi.mock("../../../utils/common", () => ({ wait: () => Promise.resolve() }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/output", () => ({ percentageToAspectRatio: (i: unknown) => i, stylePosToPercentage: (d: unknown) => d }))
vi.mock("../../../components/helpers/show", () => ({ getLayoutRef: () => [] }))
vi.mock("../../../components/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ addFilterString: () => "", addStyleString: () => "" }))
vi.mock("../../../components/edit/values/boxes", () => ({ setBoxInputValue: vi.fn() }))
vi.mock("../../../components/edit/values/item", () => ({ itemSections: {} }))
vi.mock("./EditValues", () => ({ EditValues: () => <div data-comp="edit-values" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("ItemStyle", () => {
    it("renderiza los valores de estilo del item", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { items: [], slide: 0 }), looseEntry(activeShow, { id: "s1" }), looseEntry(selected, { id: null, data: [] }), looseEntry(showsCache, {})])
        const { container } = render(<ItemStyle allSlideItems={[]} item={null} />)
        expect(container.querySelector('[data-comp="edit-values"]')).toBeTruthy()
    })
})
