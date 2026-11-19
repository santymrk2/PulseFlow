// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activePopup } from "../../shared/core/stores"
import { save } from "../../utils/save"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { FilesButtons } from "./FilesButtons"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../utils/save", () => ({ save: vi.fn() }))

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

describe("FilesButtons", () => {
    it("renderiza_lo_principal", () => {
        render(<FilesButtons />)
        expect(screen.getByText("[settings.backup_all]")).toBeTruthy()
        expect(screen.getByText("[settings.restore]")).toBeTruthy()
        expect(screen.getAllByRole("button")).toHaveLength(2)
        expect(screen.getAllByRole("button")[0].getAttribute("data-title")).toBe("settings.backup_info")
    })

    it("respaldar_llama_a_save_con_backup", () => {
        render(<FilesButtons />)
        fireEvent.click(screen.getByText("[settings.backup_all]"))
        expect(save).toHaveBeenCalledWith(false, { backup: true })
    })

    it("restaurar_abre_el_popup_restore", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, null)])
        render(<FilesButtons />)
        fireEvent.click(screen.getByText("[settings.restore]"))
        expect(get(activePopup)).toBe("restore")
    })
})
