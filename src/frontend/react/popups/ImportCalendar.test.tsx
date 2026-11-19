// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { fetchAndImportIcs } from "../../components/drawer/calendar/calendars"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage, dictionary } from "../../shared/core/stores"
import { newToast } from "../../utils/common"
import { clearFields, fields, fire } from "../test/kitMocks"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ImportCalendar } from "./ImportCalendar"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../components/drawer/calendar/calendars", () => ({ fetchAndImportIcs: vi.fn() }))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([storeEntry(activePopup, "import_calendar"), storeEntry(alertMessage, ""), storeEntry(dictionary, { inputs: { url: "URL" }, cloud: { local: "Local" }, actions: { import: "Importar" }, scripture: { supported_formats: "Formatos" } })] as never)
    return render(<ImportCalendar />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ImportCalendar", () => {
    it("empieza_eligiendo_entre_url_y_local_sin_botón_de_volver", () => {
        const { container } = montar()
        expect(screen.getByText("URL")).toBeTruthy()
        expect(screen.getByText("Local")).toBeTruthy()
        expect(container.querySelector("button.popup-back")).toBeNull()
    })

    it("local_importa_un_ics_por_Main_IMPORT_y_cierra", () => {
        montar()
        fireEvent.click(screen.getByText("Local"))
        expect(screen.getByText("iCalendar")).toBeTruthy()
        fireEvent.click(screen.getByText("Importar"))
        expect(sendMain).toHaveBeenCalledTimes(1)
        expect(sendMain).toHaveBeenCalledWith(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } })
        expect(get(activePopup)).toBeNull()
    })

    it("volver_regresa_a_la_elección", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Local"))
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("URL")).toBeTruthy()
    })

    it("url_vacía_deshabilita_el_botón_y_con_texto_lo_habilita", () => {
        montar()
        fireEvent.click(screen.getByText("URL"))
        const boton = () => screen.getByText("Importar").closest("button") as HTMLButtonElement
        expect(boton().disabled).toBe(true)
        fire("inputs.url (.ics)", "onInput", "   ")
        expect(boton().disabled).toBe(true)
        fire("inputs.url (.ics)", "onInput", "https://x/cal.ics")
        expect(boton().disabled).toBe(false)
    })

    it("url_exitosa_importa_con_la_url_tal_cual_y_muestra_el_alert", async () => {
        vi.mocked(fetchAndImportIcs).mockResolvedValue(true)
        montar()
        fireEvent.click(screen.getByText("URL"))
        fire("inputs.url (.ics)", "onInput", " https://x/cal.ics ")
        await act(async () => fireEvent.click(screen.getByText("Importar")))
        expect(fetchAndImportIcs).toHaveBeenCalledWith(" https://x/cal.ics ")
        expect(get(alertMessage)).toBe("actions.imported")
        expect(get(activePopup)).toBe("alert")
        expect(newToast).not.toHaveBeenCalled()
    })

    it("url_con_error_avisa_con_toast_y_deja_el_popup_abierto", async () => {
        vi.mocked(fetchAndImportIcs).mockResolvedValueOnce("404").mockResolvedValueOnce(false)
        montar()
        fireEvent.click(screen.getByText("URL"))
        fire("inputs.url (.ics)", "onInput", "u")
        await act(async () => fireEvent.click(screen.getByText("Importar")))
        expect(newToast).toHaveBeenLastCalledWith("error.import: 404")
        await act(async () => fireEvent.click(screen.getByText("Importar")))
        expect(newToast).toHaveBeenLastCalledWith("error.import")
        expect(get(activePopup)).toBe("import_calendar")
        expect(fields["inputs.url (.ics)"]).toBeTruthy()
    })
})
