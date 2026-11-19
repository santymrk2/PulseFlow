// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeShow, selected, showsCache } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { ItemStyle } from "./ItemStyle"

vi.mock("../../../shared/utils/common", () => ({ wait: () => Promise.resolve() }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/output", () => ({ percentageToAspectRatio: (i: unknown) => i, stylePosToPercentage: (d: unknown) => d }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [] }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getStyles: () => ({}) }))
vi.mock("../logic/scripts/textStyle", () => ({ addFilterString: () => "", addStyleString: () => "" }))
vi.mock("../logic/values/boxes", () => ({ setBoxInputValue: vi.fn() }))
vi.mock("../logic/values/item", () => ({ itemSections: {} }))
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
