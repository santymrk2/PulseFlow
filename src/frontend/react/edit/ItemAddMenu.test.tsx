// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activePopup, activeStage, dictionary, selected, stageShows } from "../../stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ItemAddMenu } from "./ItemAddMenu"

vi.mock("../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))
vi.mock("../ui/menu", () => ({ Menu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>, MenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>, MenuSeparator: () => <hr /> }))
vi.mock("../../components/helpers/showActions", () => ({ getDynamicIds: () => [], replaceDynamicValues: () => "" }))
vi.mock("../../components/stage/stage", () => ({ addStageItem: vi.fn() }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ addItem: vi.fn() }))
vi.mock("../../components/edit/values/items", () => ({ slideItems: [{ label: "group", items: [{ id: "text", label: "items.text", icon: "text" }] }], stageItems: [] }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("ItemAddMenu", () => {
    it("renderiza sin fallar en modo edición de slide", () => {
        restore = setStoresForTest([looseEntry(activeEdit, { slide: 0, type: "show", items: [] }), looseEntry(activePage, "edit"), looseEntry(activeStage, { id: null }), looseEntry(dictionary, {}), looseEntry(stageShows, {}), looseEntry(activePopup, null), looseEntry(selected, { id: null, data: [] })])
        const { container } = render(<ItemAddMenu />)
        expect(container).toBeTruthy()
    })
})
