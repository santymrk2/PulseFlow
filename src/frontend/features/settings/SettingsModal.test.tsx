// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup, settingsOpen } from "../../shared/core/stores"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { SettingsModal } from "./SettingsModal"

vi.mock("./SettingsTabs", () => ({ SettingsTabs: () => <nav>stub-tabs</nav> }))
vi.mock("./SettingsTools", () => ({ SettingsTools: () => <div>stub-tools</div> }))
vi.mock("./Settings", () => ({ Settings: () => <main>stub-settings</main> }))
vi.mock("../../react/main/Modal", () => ({
    Modal: (props: { title?: string; width?: number; height?: number; managesPopup?: boolean; blockEscape?: boolean; children?: ReactNode; onClose?: () => void }) => (
        <div data-testid="modal" data-title={props.title} data-width={props.width} data-height={props.height} data-manages-popup={String(props.managesPopup)} data-block-escape={String(props.blockEscape)}>
            {props.children}
            <button onClick={props.onClose}>close</button>
        </div>
    )
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setStores(popup: unknown = null) {
    restore = setStoresForTest([storeEntry(settingsOpen, true), looseEntry(activePopup, popup)])
}

describe("SettingsModal", () => {
    it("usa el Modal React con el marco del cascarón y monta el cuerpo", () => {
        setStores()
        render(<SettingsModal />)
        const modal = screen.getByTestId("modal")
        expect(modal.dataset.title).toBe("menu.settings")
        expect(modal.dataset.width).toBe("960")
        expect(modal.dataset.height).toBe("620")
        expect(modal.dataset.managesPopup).toBe("false")

        const aside = document.querySelector("aside") as HTMLElement
        expect([...aside.children].map((c) => c.textContent)).toEqual(["stub-tabs", "stub-tools"])
        expect(document.querySelector("section")?.textContent).toBe("stub-settings")
    })

    it("blockEscape refleja el popup activo y close cierra Configuración sin tocarlo", () => {
        setStores("select_show")
        render(<SettingsModal />)
        expect(screen.getByTestId("modal").dataset.blockEscape).toBe("true")
        fireEvent.click(screen.getByText("close"))
        expect(get(settingsOpen)).toBe(false)
        expect(get(activePopup)).toBe("select_show")
    })
})
