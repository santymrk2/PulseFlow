// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../../components/helpers/history"
import { categories, dictionary, drawerTabsData, labelsDisabled, shows } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ShowsTabs } from "./ShowsTabs"

vi.mock("../../../utils/common", () => ({ ...commonMock(), hasNewerUpdate: vi.fn(async () => false) }))
vi.mock("../../../utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))

interface SectionsProps {
    sections: unknown
    active?: string
    onRename?: (detail: { id: string; value: string }) => void
    section0?: ReactNode
    section1?: ReactNode
    section2?: ReactNode
    section3?: ReactNode
    section4?: ReactNode
}

vi.mock("./NavigationSections", () => ({
    NavigationSections: ({ sections, onRename, section1 }: SectionsProps) => (
        <div data-testid="sections" data-sections={JSON.stringify(sections)}>
            {section1}
            <button type="button" data-testid="rename" onClick={() => onRename?.({ id: "folder-1", value: "Renombrado" })}>
                renombrar
            </button>
        </div>
    )
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sections = (): Array<Array<Record<string, unknown>>> => JSON.parse(screen.getByTestId("sections").getAttribute("data-sections") || "[]") as Array<Array<Record<string, unknown>>>

const timestamps = { created: 1, modified: null, used: null }

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.clearAllMocks()
})

describe("ShowsTabs", () => {
    beforeEach(() => {
        restaurar = setStoresForTest([
            looseEntry(dictionary, { new: { category: "Nueva categoría" } }),
            looseEntry(drawerTabsData, { shows: { activeSubTab: "all", enabled: true } }),
            looseEntry(labelsDisabled, false),
            looseEntry(categories, { "folder-1": { name: "Vieja", icon: null, default: true } }),
            looseEntry(shows, {
                s1: { name: "Sin categoría", category: null, private: false, timestamps },
                s2: { name: "Con categoría", category: "folder-1", private: false, timestamps },
                s3: { name: "Privado", category: null, private: true, timestamps }
            })
        ])
    })

    it("cuenta los shows visibles y separa la categoría archivada", async () => {
        render(<ShowsTabs />)

        await waitFor(() => expect(sections()[0][0].count).toBe(2))
        expect(sections()[0][1]).toMatchObject({ id: "unlabeled", count: 1 })
        expect(sections()[1][1]).toMatchObject({ id: "folder-1", label: "Vieja", count: 1 })
    })

    it("crear categoría despacha history", async () => {
        render(<ShowsTabs />)
        await waitFor(() => expect(sections()[0][0].count).toBe(2))
        fireEvent.click(screen.getByText("Nueva categoría").closest("button") as HTMLButtonElement)

        expect(history).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    })

    it("renombrar una categoría saca el flag default", async () => {
        render(<ShowsTabs />)
        await waitFor(() => expect(sections()[0][0].count).toBe(2))
        fireEvent.click(screen.getByTestId("rename"))

        expect(get(categories)["folder-1"].name).toBe("Renombrado")
        expect(get(categories)["folder-1"].default).toBeUndefined()
    })
})
