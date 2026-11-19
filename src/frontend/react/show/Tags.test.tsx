// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, globalTags, shows } from "../../shared/core/stores"
import { history } from "../../shared/utils/helpers/history"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Tags } from "./Tags"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => ({ tags: [] }) }) }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span data-icon="tag" /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children, onClick }: { children: unknown; onClick?: () => void }) => <button onClick={onClick}>{children as never}</button> }))
vi.mock("./Tag", () => ({ Tag: ({ tag }: { tag: { id: string } }) => <span data-tag={tag.id} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Tags", () => {
    it("lista las etiquetas ordenadas y marca las del show activo", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(shows, { show1: { quickAccess: { tags: ["tag1"] } } }), looseEntry(globalTags, { tag1: { name: "B", color: "red" }, tag2: { name: "A", color: "blue" } })])
        const { container } = render(<Tags list />)
        expect(container.querySelectorAll("[data-tag]")).toHaveLength(2)
        expect(container.querySelector("[data-tag='tag1']")).toBeTruthy()
    })

    it("crea una etiqueta nueva al hacer click", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(shows, { show1: {} }), looseEntry(globalTags, {})])
        const { getByRole } = render(<Tags />)
        getByRole("button").click()
        expect(history).toHaveBeenCalledTimes(2)
    })
})
