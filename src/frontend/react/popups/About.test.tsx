// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { activePopup, dictionary, version } from "../../stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { About } from "./About"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn() }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(version, "1.2.3"), storeEntry(activePopup, null), storeEntry(dictionary, { about: { check_updates: "Buscar actualizaciones", report: "Reportá un error en", assets: "Recursos", made: "Hecho por" } })] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

describe("About", () => {
    it("renderiza_lo_principal", () => {
        render(<About />)
        expect(screen.getByText("PulseFlow")).toBeTruthy()
        expect(screen.getByText("v1.2.3")).toBeTruthy()
        expect(screen.getByText("Buscar actualizaciones")).toBeTruthy()
        expect(screen.getByText("Recursos")).toBeTruthy()
        expect(screen.getByText("GitHub Issues")).toBeTruthy()
        expect(screen.getByText(/Kristoffer Vassbø \(2021\)/)).toBeTruthy()
    })

    it("buscar_actualizaciones_abre_update_manager", () => {
        render(<About />)
        fireEvent.click(screen.getByText("Buscar actualizaciones"))
        expect(get(activePopup)).toBe("update_manager")
    })

    it("hay_15_links_(14_recursos_y_GitHub)_y_NDI_conserva_su_titulo", () => {
        const { container } = render(<About />)
        expect(container.querySelectorAll("a[href='#void']").length).toBe(15)
        const ndi = screen.getByText("NDI® SDK (IP-streaming)").closest("span")
        expect(ndi?.getAttribute("data-title")).toBe("NDI® is a registered trademark of Vizrt NDI AB.")
    })

    it("un_link_abre_la_url_con_Main_URL", () => {
        render(<About />)
        fireEvent.click(screen.getByText("Unsplash (Web Images)"))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://unsplash.com/")
    })
})
