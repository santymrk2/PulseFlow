// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, dictionary, popupData, special } from "../../shared/core/stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../shared/utils/popup"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { NewUpdate } from "./NewUpdate"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))

const dict = { about: { download_auto: "Descarga automática", download_latest: "Descargar última versión", changes: "Cambios" }, setup: { or: "O" } }
let restaurar: () => void = () => {}
function montar(opts: { auto?: boolean; changelog?: string } = {}) {
    restaurar = setStoresForTest([storeEntry(special, { autoUpdates: opts.auto }), storeEntry(popupData, { changelog: opts.changelog ?? "- uno\r\n- dos" }), storeEntry(activePopup, "new_update"), storeEntry(dictionary, dict)] as never)
    return render(<NewUpdate />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("NewUpdate", () => {
    it("muestra_el_boton_y_el_changelog_con_los_guiones_convertidos", () => {
        const { container } = montar()
        expect(screen.getByText("Descargar última versión")).toBeTruthy()
        expect(screen.getByText("Cambios")).toBeTruthy()
        expect(container.innerHTML).toContain("• uno<br>")
        expect(screen.queryByText("Descarga automática")).toBeNull()
    })

    it("el_boton_de_descarga_abre_la_url_y_cierra_el_popup", () => {
        montar()
        fireEvent.click(screen.getByText("Descargar última versión"))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")
        expect(get(activePopup)).toBeNull()
        expect(get(popupData)).toEqual({})
    })

    it("Enter_descarga_igual_que_el_boton", () => {
        montar()
        act(() => {
            triggerPopupSubmit()
        })
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")
        expect(get(activePopup)).toBeNull()
    })

    it("con_auto_updates_muestra_el_aviso_y_el_separador", () => {
        montar({ auto: true })
        expect(screen.getByText("Descarga automática")).toBeTruthy()
        expect(screen.getByText("O")).toBeTruthy()
    })
})
