// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, cloudSyncData, dictionary } from "../../shared/core/stores"
import { syncWithCloud } from "../../utils/cloudSync"
import { commonMock } from "../test/mockCommon"
import { clearIslands, islands } from "../test/islandMock"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { CloudMethod } from "./CloudMethod"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../utils/cloudSync", () => ({ syncWithCloud: vi.fn() }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([storeEntry(cloudSyncData, { enabled: true, id: "churchApps" }), storeEntry(activePopup, "cloud_method"), storeEntry(dictionary, { actions: { merge: "Combinar" }, cloud: { read_only: "Solo lectura", upload: "Subir", replace: "Reemplazar", merge_tip: "m", readonly_tip: "r", upload_tip: "u", replace_tip: "p" }, popup: { cancel: "Cancelar" } })] as never)
    return render(<CloudMethod />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CloudMethod", () => {
    it("renderiza_el_tip_las_cuatro_opciones_y_cancelar", () => {
        montar()
        expect(islands.Tip.props).toEqual({ type: "info", value: "cloud.choose_method_tip", bottom: 20 })
        for (const t of ["Combinar", "Solo lectura", "Subir", "Reemplazar", "Cancelar"]) expect(screen.getByText(t)).toBeTruthy()
    })

    it.each([
        ["Combinar", "merge"],
        ["Solo lectura", "read_only"],
        ["Subir", "upload"],
        ["Reemplazar", "replace"]
    ])("elegir_%s_guarda_el_metodo_sincroniza_y_cierra", (texto, metodo) => {
        montar()
        fireEvent.click(screen.getByText(texto))
        expect(get(cloudSyncData)).toEqual({ enabled: true, id: "churchApps", cloudMethod: metodo })
        expect(syncWithCloud).toHaveBeenCalledWith(true)
        expect(get(activePopup)).toBeNull()
    })

    it("cancelar_vacia_cloudSyncData_y_cierra_sin_sincronizar", () => {
        montar()
        fireEvent.click(screen.getByText("Cancelar"))
        expect(get(cloudSyncData)).toEqual({})
        expect(syncWithCloud).not.toHaveBeenCalled()
        expect(get(activePopup)).toBeNull()
    })
})
