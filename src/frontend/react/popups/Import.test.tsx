// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { importFromClipboard } from "../../converters/importHelpers"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, alertMessage, dictionary, os, popupData } from "../../shared/core/stores"
import { presentationExtensions } from "../../shared/core/values/extensions"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Import } from "./Import"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../converters/importHelpers", () => ({ importFromClipboard: vi.fn() }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Tip") }))

const dict = { formats: { show: "Show", project: "Proyecto", template: "Plantilla", overlay: "Overlay", action: "Acción", text: "Texto", clipboard: "Portapapeles" }, stage: { stage_layout: "Stage" }, create_show: { more_options: "Más" }, info: { slides: "Diapositivas" } }
let restaurar: () => void = () => {}
function montar(data: object = {}) {
    restaurar = setStoresForTest([looseEntry(popupData, data), storeEntry(activePopup, "import"), storeEntry(alertMessage, ""), looseEntry(os, { platform: "darwin" }), storeEntry(dictionary, dict)] as never)
    return render(<Import />)
}
const abrirPowerpoint = () => fireEvent.click(screen.getByText("PowerPoint").closest(".row")?.querySelectorAll("button")[1] as HTMLElement)
const click = (text: string) => fireEvent.click(screen.getByText(text))
const sentArgs = () => structuredClone(vi.mocked(sendMain).mock.calls)
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Import", () => {
    it("al_montar_vacía_popupData_y_no_manda_nada", () => {
        montar({ mode: "x" })
        expect(get(popupData)).toEqual({})
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("show_manda_Main_IMPORT_canal_freeshow_con_el_nombre_traducido_y_cierra", () => {
        montar()
        click("Show")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "freeshow", format: { name: "Show", title: "FreeShow Song/Presentation File", icon: "slide", extensions: ["show", "json"], id: "freeshow" } }]])
        expect(get(activePopup)).toBeNull()
    })

    it("proyecto_manda_el_canal_freeshow_project", () => {
        montar()
        click("Proyecto")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "freeshow_project", format: { name: "Proyecto", title: "FreeShow Project File", icon: "project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" } }]])
    })

    it("más_opciones_muestra_plantilla_overlay_acción_y_stage_y_volver_regresa", () => {
        const { container } = montar()
        click("Más")
        expect(["Plantilla", "Overlay", "Acción", "Stage"].every((t) => screen.getByText(t))).toBe(true)
        expect(screen.queryByText("Proyecto")).toBeNull()
        click("Plantilla")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "freeshow_template", format: { name: "Plantilla", title: "FreeShow Template File", icon: "templates", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" } }]])
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("Proyecto")).toBeTruthy()
    })

    it("formato_de_texto_manda_el_formato_completo_con_nombre_y_cierra", () => {
        montar()
        click("Texto")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "txt", format: { name: "Texto", extensions: ["txt"], id: "txt" } }]])
        expect(get(activePopup)).toBeNull()
    })

    it("formato_con_tutorial_lo_muestra_en_alert_en_vez_de_cerrar", () => {
        montar()
        click("VideoPsalm")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "videopsalm", format: { name: "VideoPsalm", extensions: ["json", "vpc"], id: "videopsalm", tutorial: "Find the .vpc or .json file(s) often located in Documents\\VideoPsalm\\Songbooks" } }]])
        expect(get(alertMessage)).toBe("Find the .vpc or .json file(s) often located in Documents\\VideoPsalm\\Songbooks")
        expect(get(activePopup)).toBe("alert")
    })

    it("pdf_y_lessons_mandan_el_formato_crudo", () => {
        montar()
        click("PDF")
        click("Lessons.church")
        expect(sentArgs()).toEqual([
            [Main.IMPORT, { channel: "pdf", format: { name: "PDF", title: "Added to your project", extensions: ["pdf"], id: "pdf" } }],
            [Main.IMPORT, { channel: "lessons", format: { name: "Lessons.church", title: "ChurchApps\nhttps://lessons.church", extensions: ["json", "olp", "olf"], id: "lessons" } }]
        ])
    })

    it("powerpoint_importa_ppt_y_pptx_y_cierra", () => {
        montar()
        click("PowerPoint")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "powerpoint", format: { name: "PowerPoint", extensions: ["ppt", "pptx"] } }]])
        expect(get(activePopup)).toBeNull()
    })

    it("la_flecha_de_powerpoint_abre_las_4_opciones_con_su_tip", () => {
        const { container } = montar()
        abrirPowerpoint()
        expect(["Diapositivas", "PDF (Online)", "Controller (Deprecated)"].every((t) => screen.getByText(t))).toBe(true)
        expect(screen.getByText("Requires LibreOffice or PowerPoint installed.")).toBeTruthy()
        expect(container.querySelector("[data-isla='Tip']")).toBeTruthy()

        click("Diapositivas")
        expect(sentArgs().at(-1)).toEqual([Main.IMPORT, { channel: "powerpoint", format: { name: "PowerPoint", extensions: ["ppt", "pptx"] } }])
        expect(get(activePopup)).toBeNull()
    })

    it("opciones_de_powerpoint_pdf_online_y_controlador", () => {
        montar()
        abrirPowerpoint()
        fireEvent.click(screen.getByText("Requires LibreOffice or PowerPoint installed.").closest("button") as HTMLElement)
        expect(sentArgs().at(-1)).toEqual([Main.PPT_TO_PDF])
        expect(get(activePopup)).toBe("import")

        click("Controller (Deprecated)")
        expect(sentArgs().at(-1)).toEqual([Main.IMPORT, { channel: "powerkey", format: { name: "PowerPoint/Keynote", extensions: structuredClone(presentationExtensions) } }])
        expect(get(activePopup)).toBe("import")

        click("PDF (Online)")
        expect(sentArgs().at(-1)).toEqual([Main.URL, "https://www.ilovepdf.com/powerpoint_to_pdf"])
        expect(get(activePopup)).toBeNull()
    })

    it("portapapeles_importa_y_cierra", () => {
        montar()
        click("Portapapeles")
        expect(importFromClipboard).toHaveBeenCalledTimes(1)
        expect(sendMain).not.toHaveBeenCalled()
        expect(get(activePopup)).toBeNull()
    })

    it("modo_project_sólo_ofrece_pdf_powerpoint_texto_y_chordpro", () => {
        montar({ mode: "project" })
        expect(["PDF", "PowerPoint", "Texto", "ChordPro", "Portapapeles"].every((t) => screen.getByText(t))).toBe(true)
        expect(screen.queryByText("Show")).toBeNull()
        expect(screen.queryByText("CSV")).toBeNull()
        click("ChordPro")
        expect(sentArgs()).toEqual([[Main.IMPORT, { channel: "chordpro", format: { name: "ChordPro", extensions: ["cho", "crd", "chopro", "chordpro", "chord", "pro", "txt", "onsong"], id: "chordpro" } }]])
    })

    it("cerrar_sin_elegir_no_manda_nada", () => {
        const { unmount } = montar()
        unmount()
        expect(sendMain).not.toHaveBeenCalled()
        expect(importFromClipboard).not.toHaveBeenCalled()
    })
})
