// @vitest-environment happy-dom
import { get } from "../../../shared/core/lib/store"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeProject, activeShow, popupData, projects } from "../../../shared/core/stores"
import { history } from "../../../components/helpers/history"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ProjectShowPlaceholder } from "./ProjectShowPlaceholder"

vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../system/DropArea", () => ({ DropArea: ({ children }: { children: unknown }) => <div>{children as never}</div> }))
vi.mock("../../system/Center", () => ({ Center: ({ children }: { children: unknown }) => <div>{children as never}</div> }))
vi.mock("../../ui/button/Button", () => ({ Button: ({ children, onClick }: { children: unknown; onClick?: () => void }) => <button onClick={onClick}>{children as never}</button> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("ProjectShowPlaceholder", () => {
    it("abre el selector de show cuando el proyecto existe", () => {
        restore = setStoresForTest([looseEntry(activeProject, "project1"), looseEntry(projects, { project1: { id: "project1", name: "P", created: 0, parent: "root", shows: [{ id: "show1", type: "show" }] } }), looseEntry(activeShow, { id: "show1", type: "show", index: 0 }), looseEntry(activePopup, null), looseEntry(popupData, {})])
        const { getByRole } = render(<ProjectShowPlaceholder />)
        getByRole("button").click()
        expect(get(activePopup)).toBe("select_show")
        const data = get(popupData) as { action?: string; trigger?: (id: string) => void }
        expect(data.action).toBe("select_show")
        data.trigger?.("show2")
        expect(history).toHaveBeenCalled()
        expect(get(activeShow)).toMatchObject({ id: "show2", index: 0 })
    })

    it("muestra el mensaje cuando no hay proyecto", () => {
        restore = setStoresForTest([looseEntry(activeProject, null), looseEntry(projects, {})])
        const { container } = render(<ProjectShowPlaceholder />)
        expect(container.textContent).toContain("empty.project_select")
    })
})
