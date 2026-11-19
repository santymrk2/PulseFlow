// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { getApiBiblesList } from "../drawer/logic/bible/scripture"
import { requestMain, sendMain } from "../../shared/core/ipc/main"
import { dictionary, scriptures } from "../../shared/core/stores"
import { clearFields, fire } from "../../shared/test/kitMocks"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { ImportScripture } from "./ImportScripture"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), requestMain: vi.fn() }))
vi.mock("../drawer/logic/bible/scripture", () => ({ getApiBiblesList: vi.fn(), customBibleData: (a: object) => ({ ...a }) }))
vi.mock("../../react/main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Loader") }))
vi.mock("uid", () => ({ uid: () => "nuevo" }))
vi.mock("../../shared/ui/kit/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

const bible = (name: string, language: string, extra: object = {}) => ({ name, language, sourceKey: `k-${name}`, source: "api.bible", description: "", copyright: `c-${name}`, ...extra })
let restaurar: () => void = () => {}
function montar(existing: object = {}) {
    restaurar = setStoresForTest([looseEntry(scriptures, existing), storeEntry(dictionary, { error: { bible_api: "Error de API" }, empty: { search: "Sin resultados" }, cloud: { local: "Local" }, scripture: { local: "Archivo local", supported_formats: "Formatos" } })] as never)
    return render(<ImportScripture />)
}
async function abrirApi(list: object[]) {
    vi.mocked(getApiBiblesList).mockResolvedValue(list as never)
    const view = montar()
    await act(async () => fireEvent.click(screen.getByText("API")))
    return view
}
const back = (c: HTMLElement) => fireEvent.click(c.querySelector("button.popup-back") as HTMLElement)
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-ES")
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.restoreAllMocks()
})

describe("ImportScripture", () => {
    it("empieza_eligiendo_api_o_local", () => {
        montar()
        expect(screen.getByText("API")).toBeTruthy()
        expect(screen.getByText("Local")).toBeTruthy()
        expect(getApiBiblesList).not.toHaveBeenCalled()
    })

    it("api_muestra_primero_las_del_idioma_y_el_resto_después_con_separador", async () => {
        const { container } = await abrirApi([bible("Otra", "eng"), bible("Reina Valera", "es")])
        const nombres = [...container.querySelectorAll("[role=checkbox]")].map((c) => c.getAttribute("data-title"))
        expect(nombres).toEqual(["Reina Valera", "Otra"])
        expect(container.querySelector("hr")).toBeTruthy()
    })

    it("api_con_locale_regional_recomienda_por_subtag_no_por_region", async () => {
        vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US")
        const { container } = await abrirApi([bible("Otra", "fra"), bible("KJV", "eng")])
        const nombres = [...container.querySelectorAll("[role=checkbox]")].map((c) => c.getAttribute("data-title"))
        expect(nombres).toEqual(["KJV", "Otra"])
    })

    it("marcar_una_biblia_la_agrega_a_scriptures_con_sus_datos_y_desmarcar_la_borra", async () => {
        vi.mocked(getApiBiblesList).mockResolvedValue([bible("RV", "es", { attributionRequired: true, attributionString: "(c) RV" })] as never)
        montar()
        await act(async () => fireEvent.click(screen.getByText("API")))
        fireEvent.click(document.querySelector("[role=checkbox]") as HTMLElement)
        expect(get(scriptures)).toEqual({ nuevo: { name: "RV", api: true, id: "k-RV", metadata: { copyright: "c-RV" }, attributionRequired: true, attributionString: "(c) RV" } })
        fireEvent.click(document.querySelector("[role=checkbox]") as HTMLElement)
        expect(get(scriptures)).toEqual({})
    })

    it("una_biblia_ya_agregada_aparece_marcada", async () => {
        vi.mocked(getApiBiblesList).mockResolvedValue([bible("RV", "es")] as never)
        montar({ x: { id: "k-RV", name: "RV" } })
        await act(async () => fireEvent.click(screen.getByText("API")))
        expect(document.querySelector("[role=checkbox]")?.getAttribute("aria-checked")).toBe("true")
    })

    it("buscar_filtra_por_palabras_desde_2_letras_y_sin_resultados_avisa", async () => {
        const { container } = await abrirApi([bible("Reina Valera", "es"), bible("Otra Version", "eng")])
        fire("main.search", "onInput", "vers")
        expect([...container.querySelectorAll("[role=checkbox]")].map((c) => c.getAttribute("data-title"))).toEqual(["Otra Version"])
        expect(container.querySelector("hr")).toBeNull()
        fire("main.search", "onInput", "zzz")
        expect(container.querySelectorAll("[role=checkbox]").length).toBe(0)
        expect(screen.getByText("Sin resultados")).toBeTruthy()
        fire("main.search", "onInput", "v")
        expect(container.querySelectorAll("[role=checkbox]").length).toBe(2)
    })

    it("mientras_carga_muestra_el_loader", async () => {
        vi.mocked(getApiBiblesList).mockReturnValue(new Promise(() => {}))
        const { container } = montar()
        await act(async () => fireEvent.click(screen.getByText("API")))
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
    })

    it("si_falla_la_API_muestra_el_mensaje_de_error", async () => {
        vi.mocked(getApiBiblesList).mockRejectedValue(new Error("x"))
        montar()
        await act(async () => fireEvent.click(screen.getByText("API")))
        expect(screen.getByText("Error de API")).toBeTruthy()
    })

    it("volver_a_entrar_en_api_repite_las_recomendadas_como_el_svelte", async () => {
        const { container } = await abrirApi([bible("RV", "es")])
        back(container)
        await act(async () => fireEvent.click(screen.getByText("API")))
        expect(container.querySelectorAll("[role=checkbox]").length).toBe(2)
    })

    it("local_lista_las_de_la_carpeta_sin_las_ya_agregadas_y_las_importa_por_Main_IMPORT_FILES", async () => {
        vi.mocked(requestMain).mockResolvedValue([
            { path: "/b/uno.fsb", name: "uno" },
            { path: "/b/dos.fsb", name: "dos" }
        ] as never)
        montar({ x: { id: "i", name: "uno.fsb" } })
        await act(async () => fireEvent.click(screen.getByText("Local")))
        expect(requestMain).toHaveBeenCalledWith(Main.READ_BIBLES_FOLDER)
        expect(screen.queryByText("uno")).toBeNull()
        fireEvent.click(screen.getByText("dos"))
        expect(sendMain).toHaveBeenCalledTimes(1)
        expect(sendMain).toHaveBeenCalledWith(Main.IMPORT_FILES, { id: "BIBLE", paths: ["/b/dos.fsb"] })
    })

    it("local_elegir_archivo_manda_Main_IMPORT_con_las_extensiones_de_biblia", async () => {
        vi.mocked(requestMain).mockResolvedValue(undefined as never)
        montar()
        await act(async () => fireEvent.click(screen.getByText("Local")))
        fireEvent.click(screen.getByText("Archivo local"))
        expect(sendMain).toHaveBeenCalledWith(Main.IMPORT, { channel: "BIBLE", format: { name: "Bible", extensions: ["xml", "xmm", "json", "fsb"] } })
    })

    it("cerrar_no_manda_nada", async () => {
        const { unmount } = montar()
        unmount()
        expect(sendMain).not.toHaveBeenCalled()
    })
})
