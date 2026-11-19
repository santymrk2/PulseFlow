// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { drawerTabsData, effects, overlays } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { OverlayNavigation } from "./OverlayNavigation"

vi.mock("../../shared/utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: () => ({ global: "full" }) }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../drawer/pages/Overlays", () => ({ Overlays: () => <div data-comp="overlays" /> }))
vi.mock("../show/left/LeftPanel", () => ({
    LeftPanel: ({ children, title }: { children?: ReactNode; title?: string }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    )
}))
vi.mock("../../shared/ui/kit/button/Button", () => ({ Button: () => <button type="button">add</button> }))
vi.mock("./CategoryPicker", () => ({ CategoryPicker: () => <div data-comp="picker" /> }))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
})

describe("OverlayNavigation", () => {
    it("renderiza el panel de overlays", () => {
        restore = setStoresForTest([looseEntry(drawerTabsData, { overlays: { activeSubTab: "all" } }), looseEntry(effects, {}), looseEntry(overlays, {})])
        render(<OverlayNavigation />)
        expect(screen.getByText("tabs.overlays")).toBeTruthy()
    })
})
