// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { drawerTabsData, templates } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ThemeNavigation } from "./ThemeNavigation"

vi.mock("../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({ global: "full" }) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../drawer/pages/Templates", () => ({ Templates: () => <div data-comp="templates" /> }))
vi.mock("../show/left/LeftPanel", () => ({
    LeftPanel: ({ children, title }: { children?: ReactNode; title?: string }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    )
}))
vi.mock("../ui/button/Button", () => ({ Button: () => <button type="button">add</button> }))
vi.mock("./CategoryPicker", () => ({ CategoryPicker: () => <div data-comp="picker" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("ThemeNavigation", () => {
    it("renderiza el panel de plantillas", () => {
        restore = setStoresForTest([looseEntry(drawerTabsData, { templates: { activeSubTab: "all" } }), looseEntry(templates, {})])
        render(<ThemeNavigation />)
        expect(screen.getByText("tabs.templates")).toBeTruthy()
    })
})
