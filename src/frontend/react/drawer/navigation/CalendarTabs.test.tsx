// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, drawerTabsData, labelsDisabled } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { CalendarTabs } from "./CalendarTabs"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/utils/profile", () => ({ getAccess: () => ({}) }))

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
    NavigationSections: ({ sections, section0 }: SectionsProps) => (
        <div data-testid="sections" data-sections={JSON.stringify(sections)}>
            {section0}
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

describe("CalendarTabs", () => {
    it("muestra el TITLE sólo con labelsDisabled y las dos subpestañas", () => {
        restaurar = setStoresForTest([looseEntry(dictionary, {}), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event", enabled: true } }), looseEntry(labelsDisabled, true), looseEntry(activePopup, "")])

        render(<CalendarTabs />)

        expect(sections()[0][0]).toMatchObject({ id: "TITLE", label: "tabs.calendar" })
        expect(sections()[0][1]).toMatchObject({ id: "event", label: "menu._title_calendar" })
        expect(sections()[0][2]).toMatchObject({ id: "action", label: "calendar.schedule_action" })
    })

    it("el botón de importar abre el popup", () => {
        restaurar = setStoresForTest([looseEntry(dictionary, { actions: { import_calendar: "Importar calendario" } }), looseEntry(drawerTabsData, { calendar: { activeSubTab: "event", enabled: true } }), looseEntry(labelsDisabled, false), looseEntry(activePopup, "")])

        render(<CalendarTabs />)
        fireEvent.click(screen.getByText("Importar calendario").closest("button") as HTMLButtonElement)

        expect(get(activePopup)).toBe("import_calendar")
    })
})
