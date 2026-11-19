// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup, drawerTabsData, overlayCategories, selected, templateCategories } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { CategoryPicker } from "./CategoryPicker"

vi.mock("../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({ global: "full" }) }))
vi.mock("../../app/wiring/createData", () => ({ setExampleEffects: vi.fn(), setExampleOverlays: vi.fn(), setExampleTemplates: vi.fn() }))
vi.mock("../../shared/utils/helpers/clipboard", () => ({ deleteAction: vi.fn() }))
vi.mock("../ui/button/Button", () => ({ Button: () => <button type="button">btn</button> }))
vi.mock("../ui/input/Input", () => ({ Input: () => <input /> }))
vi.mock("../ui/menu", () => ({ Menu: ({ children }: { children?: ReactNode }) => <div>{children}</div>, MenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>, MenuSeparator: () => <hr /> }))
vi.mock("../ui/select-field/SelectField", () => ({ SelectField: () => <div data-select="field" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("CategoryPicker", () => {
    it("renderiza el selector de categorías", () => {
        restore = setStoresForTest([looseEntry(templateCategories, { c1: { name: "Cat" } }), looseEntry(overlayCategories, {}), looseEntry(drawerTabsData, { templates: { activeSubTab: "all" }, overlays: { activeSubTab: "all" } }), looseEntry(activePopup, null), looseEntry(selected, { id: null, data: [] })])
        const { container } = render(<CategoryPicker kind="templates" />)
        expect(container.querySelector('[data-select="field"]')).toBeTruthy()
    })
})
