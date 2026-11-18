// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { activePopup, alertMessage, dictionary } from "../../stores"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Alert } from "./Alert"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn() }))
// Loader sigue siendo Svelte: acá sólo importa que se monte
vi.mock("../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Loader") }))

let restaurar: () => void = () => {}
function montar(mensaje: string) {
    restaurar = setStoresForTest([storeEntry(alertMessage, mensaje), storeEntry(activePopup, "alert"), storeEntry(dictionary, { actions: { closing: "Cerrando" }, captions: { info: "Abrí este link" }, error: { uno: "Algo falló" } })] as never)
    return render(<Alert />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("Alert", () => {
    it("un_mensaje_con_un_solo_punto_se_traduce_y_el_check_cierra", () => {
        const { container } = montar("error.uno")
        expect(screen.getByText("Algo falló")).toBeTruthy()
        fireEvent.click(container.querySelector("button") as HTMLElement)
        expect(get(activePopup)).toBeNull()
    })

    it("un_mensaje_con_html_se_inyecta_tal_cual", () => {
        const { container } = montar("hola <b>mundo</b>")
        expect(container.querySelector("p b")?.textContent).toBe("mundo")
    })

    it("closing_muestra_el_texto_y_el_Loader_sin_boton", () => {
        const { container } = montar("actions.closing")
        expect(screen.getByText("Cerrando")).toBeTruthy()
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
        expect(container.querySelector("button")).toBeNull()
    })

    it("captions_muestra_la_info_y_un_link_a_la_url", () => {
        montar("captions#https://caption.ninja/x")
        expect(screen.getByText("Abrí este link")).toBeTruthy()
        fireEvent.click(screen.getByText("https://caption.ninja/x"))
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://caption.ninja/x")
    })

    it("link_bible_converter_abre_el_repo_al_hacer_clic", () => {
        const { container } = montar("Usá link#bible-converter ya")
        fireEvent.click(container.querySelector("a#bible-converter") as HTMLElement)
        expect(sendMain).toHaveBeenCalledWith(Main.URL, "https://github.com/vassbo/bible-converter")
    })

    it("Enter_(popupSubmit)_cierra_salvo_en_closing_y_se_desregistra_al_desmontar", () => {
        const { unmount } = montar("error.uno")
        expect(triggerPopupSubmit()).toBe(true)
        expect(get(activePopup)).toBeNull()
        unmount()
        expect(triggerPopupSubmit()).toBe(false)

        restaurar()
        montar("actions.closing")
        triggerPopupSubmit()
        expect(get(activePopup)).toBe("alert")
    })
})
