// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SettingsModal } from "./SettingsModal"

vi.mock("./SettingsTabs", () => ({ SettingsTabs: () => <nav>stub-tabs</nav> }))
vi.mock("./SettingsTools", () => ({ SettingsTools: () => <div>stub-tools</div> }))
vi.mock("./Settings", () => ({ Settings: () => <main>stub-settings</main> }))

afterEach(cleanup)

describe("SettingsModal", () => {
    it("renderiza_lo_principal_aside_con_pestanas_y_herramientas_y_section_con_Settings", () => {
        render(<SettingsModal />)
        const aside = document.querySelector("aside") as HTMLElement
        expect([...aside.children].map((c) => c.textContent)).toEqual(["stub-tabs", "stub-tools"])
        expect(document.querySelector("section")?.textContent).toBe("stub-settings")
    })
})
