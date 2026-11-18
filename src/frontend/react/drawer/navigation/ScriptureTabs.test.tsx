// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeScripture, dictionary, drawerTabsData, labelsDisabled, scriptures } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ScriptureTabs } from "./ScriptureTabs"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/profile", () => ({ getAccess: () => ({}) }))

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
    NavigationSections: ({ sections, onRename, section0, section1, section2 }: SectionsProps) => (
        <div data-testid="sections" data-sections={JSON.stringify(sections)}>
            {section0}
            {section1}
            {section2}
            <button type="button" data-testid="rename" onClick={() => onRename?.({ id: "folder-1", value: "Renombrado" })}>
                renombrar
            </button>
        </div>
    )
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sections = (): Array<Array<Record<string, unknown>>> => JSON.parse(screen.getByTestId("sections").getAttribute("data-sections") || "[]") as Array<Array<Record<string, unknown>>>

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("ScriptureTabs", () => {
    beforeEach(() => {
        restaurar = setStoresForTest([
            looseEntry(dictionary, { new: { collection: "Nueva colección", scripture: "Nueva Escritura" } }),
            looseEntry(drawerTabsData, { scripture: { activeSubTab: "all", enabled: true } }),
            looseEntry(labelsDisabled, false),
            looseEntry(activeScripture, { reference: { book: 1, chapters: [1], verses: [1] } }),
            looseEntry(activePopup, ""),
            looseEntry(scriptures, {
                "folder-1": { name: "Favorito", favorite: true },
                col: { name: "Colección", collection: { versions: ["v1"] } },
                api: { name: "API", api: true },
                local: { name: "Local" }
            })
        ])
    })

    it("separa favoritos, colecciones y bibles con el separador API", () => {
        render(<ScriptureTabs />)

        expect(sections()[0][0]).toMatchObject({ id: "TITLE", label: "category.favourites" })
        expect(sections()[0][1]).toMatchObject({ id: "folder-1", label: "Favorito" })
        expect(sections()[1][0]).toMatchObject({ id: "TITLE", label: "scripture.collections" })
        expect(sections()[1][1]).toMatchObject({ id: "col", label: "Colección", count: 1 })
        expect(sections()[2].some((item) => item?.label === "API")).toBe(true)
    })

    it("abre el popup correspondiente desde los botones", () => {
        render(<ScriptureTabs />)

        fireEvent.click(screen.getByText("Nueva colección").closest("button") as HTMLButtonElement)
        expect(get(activePopup)).toBe("create_collection")

        fireEvent.click(screen.getByText("Nueva Escritura").closest("button") as HTMLButtonElement)
        expect(get(activePopup)).toBe("import_scripture")
    })

    it("renombrar guarda el customName", () => {
        render(<ScriptureTabs />)
        fireEvent.click(screen.getByTestId("rename"))

        expect(get(scriptures)["folder-1"].customName).toBe("Renombrado")
    })
})
