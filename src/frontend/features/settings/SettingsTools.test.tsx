// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, dataPath, popupData, settingsTab } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { SettingsTools } from "./SettingsTools"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})
const preparar = (tab: "general" | "other" | "files") => (restaurar = setStoresForTest([storeEntry(settingsTab, tab), storeEntry(activePopup, null), storeEntry(popupData, { x: 1 }), storeEntry(dataPath, "/datos")]))

describe("SettingsTools", () => {
    it("renderiza_lo_principal_en_general", () => {
        preparar("general")
        render(<SettingsTools />)
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["[popup.manage_metadata]", "[popup.manage_dynamic_values]", "[popup.manage_emitters]", "[popup.manage_fonts]", "[popup.manage_icons]", "[popup.manage_colors]"])
    })

    it.each([
        ["[popup.manage_metadata]", "manage_metadata"],
        ["[popup.manage_dynamic_values]", "manage_dynamic_values"],
        ["[popup.manage_emitters]", "manage_emitters"],
        ["[popup.manage_fonts]", "manage_fonts"],
        ["[popup.manage_icons]", "manage_icons"],
        ["[popup.manage_colors]", "manage_colors"]
    ])("en_general_%s_vacia_popupData_y_abre_%s", (texto, popup) => {
        preparar("general")
        render(<SettingsTools />)
        fireEvent.click(screen.getByText(texto))
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBe(popup)
    })

    it("en_other_renderiza_los_tres_botones_de_carpetas", () => {
        preparar("other")
        render(<SettingsTools />)
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["[actions.open_error_log]", "[actions.open_app_data_folder]", "[actions.open_user_data_folder]"])
    })

    it("en_other_cada_boton_manda_el_mismo_mensaje_IPC", () => {
        preparar("other")
        render(<SettingsTools />)
        fireEvent.click(screen.getByText("[actions.open_error_log]"))
        expect(sendMain).toHaveBeenLastCalledWith(Main.OPEN_LOG)
        fireEvent.click(screen.getByText("[actions.open_app_data_folder]"))
        expect(sendMain).toHaveBeenLastCalledWith(Main.OPEN_APPDATA)
        fireEvent.click(screen.getByText("[actions.open_user_data_folder]"))
        expect(sendMain).toHaveBeenLastCalledWith(Main.OPEN_FOLDER_PATH, "/datos")
        expect(sendMain).toHaveBeenCalledTimes(3)
    })

    it("en_otra_pestana_no_renderiza_nada", () => {
        preparar("files")
        const { container } = render(<SettingsTools />)
        expect(container.innerHTML).toBe("")
    })
})
