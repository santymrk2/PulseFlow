// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EXPORT } from "../../../types/Channels"
import { Main } from "../../../types/IPC/Main"
import { exportProject } from "../../components/export/project"
import { convertShowSlidesToImages } from "../../components/main/popups/export/exportHelper"
import { sendMain } from "../../IPC/main"
import { activePopup, activeProject, activeShow, dictionary, projects, selected, shows, showsCache, special } from "../../stores"
import { send } from "../../utils/request"
import { save } from "../../utils/save"
import { clearPopupSubmit, triggerPopupSubmit } from "../../utils/popup"
import { clearFields, fire } from "../test/kitMocks"
import { clearIslands, emit, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Export } from "./Export"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, wait: () => Promise.resolve(), newToast: vi.fn() }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../utils/request", () => ({ send: vi.fn() }))
vi.mock("../../utils/save", () => ({ save: vi.fn() }))
vi.mock("../../components/export/project", () => ({ exportProject: vi.fn() }))
vi.mock("../../components/helpers/setShow", () => ({ loadShows: vi.fn(async () => {}) }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../../components/helpers/media", () => ({ getSlideThumbnail: vi.fn() }))
vi.mock("../../components/main/popups/export/exportHelper", async () => ({ ...(await vi.importActual<typeof import("../../components/main/popups/export/exportHelper")>("../../components/main/popups/export/exportHelper")), convertShowSlidesToImages: vi.fn() }))
vi.mock("../../components/main/popups/export/PdfExport.svelte", () => ({ default: { isla: "PdfExport" } }))
vi.mock("../../components/main/Loader.svelte", () => ({ default: { isla: "Loader" } }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { export: { option_type: "Tipo", option_format: "Formato", export_as: "Exportar como {}", export: "Exportar", current_project: "Proyecto actual", selected_shows: "Shows elegidos", all_shows: "Todos", project: "Proyecto", include_media: "Incluir media" }, formats: { show: "Show" }, edit: { text: "Texto" }, items: { image: "Imagen" } }
let restaurar: () => void = () => {}
function montar(options: { project?: boolean; selectedIds?: string[] } = {}) {
    restaurar = setStoresForTest([
        looseEntry(shows, { a: { name: "Uno" }, b: { name: "Dos" } }),
        looseEntry(showsCache, { a: { name: "Uno", timestamps: { created: 5 } }, b: { name: "Dos" } }),
        looseEntry(projects, {
            p1: {
                name: "Mi proyecto",
                shows: [
                    { id: "a", type: "show" },
                    { id: "x", type: "section" },
                    { id: "m", type: "video" },
                    { id: "t", type: "timer" }
                ]
            }
        }),
        looseEntry(activeProject, options.project ? "p1" : null),
        looseEntry(activeShow, { id: "a", type: "show" }),
        looseEntry(selected, { id: options.selectedIds ? "show" : null, data: (options.selectedIds || []).map((id) => ({ id })) }),
        looseEntry(special, {}),
        storeEntry(activePopup, "export"),
        storeEntry(dictionary, dict)
    ] as never)
    return render(<Export />)
}
const elegir = (texto: string) => fireEvent.click(screen.getByText(texto))
// elegir el formato dispara la carga asíncrona de datos (loading): se espera a que termine
const formato = async (texto: string) => await act(async () => fireEvent.click(screen.getByText(texto)))
const exportar = async () => await act(async () => fireEvent.click(screen.getByText("Exportar")))
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
})

describe("Export", () => {
    it("el_primer_paso_ofrece_los_tipos_y_deshabilita_los_que_no_tienen_shows", () => {
        montar()
        const botones = [...document.querySelectorAll("button")].filter((b) => !b.classList.contains("popup-back"))
        expect(botones.map((b) => [b.textContent, b.disabled])).toEqual([
            ["Proyecto actual", true],
            ["Shows elegidos", false],
            ["Todos", false]
        ])
    })

    it("según_el_tipo_ofrece_sólo_los_formatos_que_aplican", () => {
        const { container } = montar({ project: true })
        elegir("Proyecto actual")
        expect([...container.querySelectorAll("button:not(.popup-back)")].map((b) => b.textContent)).toEqual(["Proyecto", "PDF"])
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        elegir("Todos")
        expect([...container.querySelectorAll("button:not(.popup-back)")].map((b) => b.textContent)).toEqual(["Show", "Texto"])
    })

    it("exportar_shows_elegidos_en_formato_show_guarda_primero_y_manda_GENERATE", async () => {
        montar({ selectedIds: ["a", "b"] })
        elegir("Shows elegidos")
        await formato("Show")
        await exportar()
        expect(save).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith(EXPORT, ["GENERATE"], { type: "show", showIds: ["a", "b"], showNames: ["Uno", "Dos"] })
        expect(get(activePopup)).toBeNull()
    })

    it("Enter_exporta_igual_que_el_botón", async () => {
        montar({ selectedIds: ["a"] })
        elegir("Shows elegidos")
        await formato("Texto")
        await act(async () => {
            triggerPopupSubmit()
        })
        expect(send).toHaveBeenCalledWith(EXPORT, ["GENERATE"], { type: "txt", showIds: ["a"], showNames: ["Uno"] })
    })

    it("todos_los_shows_manda_ALL_SHOWS_y_deja_el_popup_abierto_con_el_loader", async () => {
        const { container } = montar()
        elegir("Todos")
        await formato("Show")
        await exportar()
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith(EXPORT, ["ALL_SHOWS"], { type: "show" })
        expect(get(activePopup)).toBe("export")
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })

    it("proyecto_activo_en_formato_proyecto_llama_a_exportProject_con_el_proyecto_y_su_id", async () => {
        montar({ project: true })
        elegir("Proyecto actual")
        await formato("Proyecto")
        await exportar()
        expect(exportProject).toHaveBeenCalledTimes(1)
        expect(exportProject).toHaveBeenCalledWith(get(projects).p1, "p1")
        expect(get(activePopup)).toBeNull()
    })

    it("shows_elegidos_en_formato_proyecto_arman_un_proyecto_con_el_primero", async () => {
        vi.spyOn(Date, "now").mockReturnValue(99)
        montar({ selectedIds: ["a", "b"] })
        elegir("Shows elegidos")
        await formato("Proyecto")
        await exportar()
        expect(exportProject).toHaveBeenCalledWith(
            {
                name: "Uno",
                notes: "",
                created: 5,
                parent: "/",
                shows: [
                    { type: "show", id: "a" },
                    { type: "show", id: "b" }
                ]
            },
            ""
        )
        vi.restoreAllMocks()
    })

    it("incluir_media_se_guarda_en_special", async () => {
        montar({ project: true })
        elegir("Proyecto actual")
        await formato("Proyecto")
        fire("export.include_media", "onChange", false)
        expect(get(special).projectIncludeMedia).toBe(false)
    })

    it("imagen_manda_SAVE_IMAGE_por_diapositiva_con_contenido_y_abre_la_carpeta_con_la_primera", async () => {
        vi.mocked(convertShowSlidesToImages).mockResolvedValue(["b64-1", "", "b64-3"])
        montar({ selectedIds: ["a", "b"] })
        elegir("Shows elegidos")
        await formato("Imagen")
        await exportar()
        expect(convertShowSlidesToImages).toHaveBeenCalledWith("a")
        expect(vi.mocked(sendMain).mock.calls).toEqual([
            [Main.SAVE_IMAGE, { base64: "b64-1", filePath: ["Images", "Uno", "1.jpg"], format: "jpg", openFolder: true }],
            [Main.SAVE_IMAGE, { base64: "b64-3", filePath: ["Images", "Uno", "3.jpg"], format: "jpg", openFolder: false }]
        ])
        expect(get(activePopup)).toBeNull()
    })

    it("pdf_de_shows_elegidos_manda_las_opciones_que_informó_PdfExport", async () => {
        montar({ selectedIds: ["a", "b"] })
        elegir("Shows elegidos")
        await formato("PDF")
        const inicial = islands.PdfExport.props.pdfOptions as Record<string, unknown>
        expect(inicial).toMatchObject({ type: "default", oneFile: false, grid: [3, 6], textSize: 80 })
        emit("PdfExport", "change", { ...inicial, type: "slides" })
        expect(islands.PdfExport.props.pdfOptions).toMatchObject({ type: "slides" })
        await exportar()
        expect(send).toHaveBeenCalledWith(EXPORT, ["GENERATE"], { type: "pdf", showIds: ["a", "b"], showNames: ["Uno", "Dos"], options: { ...inicial, type: "slides" }, projectItems: undefined })
    })

    it("pdf_del_proyecto_activo_manda_los_items_válidos_con_oneFile_y_el_nombre_del_proyecto", async () => {
        montar({ project: true })
        elegir("Proyecto actual")
        await formato("PDF")
        const inicial = islands.PdfExport.props.pdfOptions as Record<string, unknown>
        expect(inicial.oneFile).toBe(true)
        await exportar()
        expect(send).toHaveBeenCalledWith(EXPORT, ["GENERATE"], { type: "pdf", showIds: ["a", "x", "m"], showNames: ["Uno", "", ""], options: { ...inicial, oneFile: true, name: "Mi proyecto" }, projectItems: get(projects).p1.shows })
    })

    it("sin_nada_para_exportar_no_hace_nada", async () => {
        montar({ project: true })
        projects.set({ p1: { name: "Vacío", shows: [] } } as never)
        elegir("Proyecto actual")
        await formato("Proyecto")
        await exportar()
        expect(save).not.toHaveBeenCalled()
        expect(exportProject).not.toHaveBeenCalled()
        expect(get(activePopup)).toBe("export")
    })

    it("volver_regresa_un_paso_y_cerrar_sin_exportar_no_manda_nada", async () => {
        const { container, unmount } = montar({ selectedIds: ["a"] })
        elegir("Shows elegidos")
        await formato("Show")
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("Imagen")).toBeTruthy()
        fireEvent.click(container.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("Todos")).toBeTruthy()
        unmount()
        expect(send).not.toHaveBeenCalled()
        expect(triggerPopupSubmit()).toBe(false)
    })
})
