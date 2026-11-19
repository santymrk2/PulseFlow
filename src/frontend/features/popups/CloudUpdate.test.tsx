// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, popupData } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { clearIslands } from "../../shared/test/islandMock"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { CloudUpdate } from "./CloudUpdate"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../app/main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Loader") }))

let restaurar: () => void = () => {}
function montar(data: unknown) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(activePopup, "cloud_update")] as never)
    return render(<CloudUpdate />)
}
beforeEach(() => clearIslands())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CloudUpdate", () => {
    it("sin_cambios_muestra_el_loader", () => {
        const { container } = montar({})
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
        expect(container.querySelectorAll("p").length).toBe(0)
    })

    it("con_cambios_lista_nombre_y_cantidad_y_el_boton_cierra", () => {
        const { container } = montar([
            { name: "Show A", action: "upload", type: "show", count: 3 },
            { name: "Config", action: "download_failed", type: "config" }
        ])
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
        expect(screen.getByText("Show A")).toBeTruthy()
        expect(screen.getByText("3")).toBeTruthy()
        expect(container.querySelectorAll("p").length).toBe(2)
        fireEvent.click(container.querySelector("button") as HTMLElement)
        expect(get(activePopup)).toBeNull()
    })

    it("pasa_del_loader_a_la_lista_cuando_popupData_cambia", () => {
        const { container } = montar({})
        act(() => popupData.set([{ name: "Nuevo", action: "upload" }] as never))
        expect(screen.getByText("Nuevo")).toBeTruthy()
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })
})
