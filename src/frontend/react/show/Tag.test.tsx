// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, globalTags, selected } from "../../stores"
import { history } from "../../components/helpers/history"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Tag } from "./Tag"

vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({ _show: () => ({ get: (key: string) => (key === "quickAccess" ? { tags: [] } : null) }) }))
vi.mock("../ui/hidden-input/HiddenInput", () => ({
    HiddenInput: ({ id, onEdit }: { id: string; onEdit?: (detail: { value: string; id: string }) => void }) => <button data-testid={id} onClick={() => onEdit?.({ value: "Nuevo", id })} />
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Tag", () => {
    it("muestra el nombre y alterna la etiqueta del show activo", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1", type: "show" }), looseEntry(globalTags, { tag1: { name: "Nombre", color: "red" } }), looseEntry(selected, { id: null, data: [] })])
        const { container } = render(<Tag tag={{ id: "tag1", name: "Nombre", color: "red" }} />)
        expect(container.firstElementChild!.className).toContain("tag")
        fireEvent.click(container.firstElementChild!)
        expect(history).toHaveBeenCalled()
        expect(vi.mocked(history).mock.calls[0][0]).toMatchObject({ id: "UPDATE", oldData: { id: "show1" } })
    })

    it("renombra la etiqueta existente", () => {
        restore = setStoresForTest([looseEntry(activeShow, { id: "show1" }), looseEntry(globalTags, { tag1: { name: "Nombre", color: "red" } })])
        const { getByTestId } = render(<Tag tag={{ id: "tag1", name: "Nombre", color: "red" }} active />)
        getByTestId("tag_tag1").click()
        expect(vi.mocked(history).mock.calls[0][0]).toMatchObject({ oldData: { id: "tag1" }, newData: { key: "name" } })
    })
})
