// @vitest-environment happy-dom
// El mock inline de utils/common debe cargarse antes que utils/language, que lo importa.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { uid } from "uid"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { history } from "../../../shared/utils/helpers/history"
import { getProjectName } from "../../../shared/utils/helpers/historyHelpers"
import { activePopup, activeProject, activeRename, dictionary, folders, projects, projectTemplates } from "../../../shared/core/stores"
import { looseEntry, type StoreEntry, setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { PlaylistAddMenu } from "./PlaylistAddMenu"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("uid", () => ({ uid: vi.fn(() => "uid-1") }))
vi.mock("../../../shared/utils/helpers/historyHelpers", async () => {
    const actual = await vi.importActual<typeof import("../../../shared/utils/helpers/historyHelpers")>("../../../shared/utils/helpers/historyHelpers")
    return { ...actual, getProjectName: vi.fn(() => "Nombre calculado") }
})

const dict = {
    ui: { new_playlist: "Nueva playlist" },
    new: { project: "Crear playlist", folder: "Nueva carpeta" },
    actions: { project_template: "Nueva plantilla", import: "Importar" },
    edit: { options: "Opciones" },
    formats: { project: "Proyecto" }
}

let restaurar: () => void = () => {}
function montar(extra: StoreEntry[] = [], readOnly = false) {
    restaurar = setStoresForTest([storeEntry(activeProject, "p1"), looseEntry(projects, { p1: { parent: "f1" } }), looseEntry(folders, { f1: { name: "Carpeta" } }), looseEntry(projectTemplates, {}), storeEntry(activePopup, null), storeEntry(activeRename, null), storeEntry(dictionary, dict), ...extra] as never)
    return render(<PlaylistAddMenu readOnly={readOnly} />)
}

const boton = () => document.querySelector('[data-title="Nueva playlist"]') as HTMLButtonElement
const abrir = () => fireEvent.click(boton())
const item = (name: string) => screen.getByRole("menuitem", { name })
const cerrado = () => expect(screen.queryByRole("menu")).toBeNull()

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(uid).mockReturnValue("uid-1")
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PlaylistAddMenu", () => {
    it("readOnly_deshabilita_el_boton_y_no_abre_el_menu", () => {
        montar([], true)
        expect(boton().disabled).toBe(true)
        abrir()
        cerrado()
    })

    it("muestra_playlist_carpeta_plantillas_importar_y_opciones_y_oculta_plantillas_borradas", () => {
        montar([looseEntry(projectTemplates, { t1: { id: "t1", name: "Plantilla A", shows: [], created: 0 }, t2: { id: "t2", name: "Borrada", deleted: true } })])
        abrir()
        expect(item("Crear playlist")).toBeTruthy()
        expect(item("Nueva carpeta")).toBeTruthy()
        expect(item("Plantilla A")).toBeTruthy()
        expect(screen.queryByRole("menuitem", { name: "Borrada" })).toBeNull()
        expect(item("Nueva plantilla")).toBeTruthy()
        expect(item("Importar")).toBeTruthy()
        expect(item("Opciones")).toBeTruthy()
    })

    it("nueva_playlist_usa_la_carpeta_de_la_playlist_activa_y_cierra", () => {
        montar()
        abrir()
        fireEvent.click(item("Crear playlist"))
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { replace: { parent: "f1" } }, location: { page: "show", id: "project" } })
        cerrado()
    })

    it("sin_playlist_activa_crea_en_la_raiz", () => {
        montar([storeEntry(activeProject, null)])
        abrir()
        fireEvent.click(item("Crear playlist"))
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { replace: { parent: "/" } }, location: { page: "show", id: "project" } })
    })

    it("nueva_carpeta_usa_el_id_de_proyecto_folder", () => {
        montar()
        abrir()
        fireEvent.click(item("Nueva carpeta"))
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { replace: { parent: "f1" } }, location: { page: "show", id: "project_folder" } })
        cerrado()
    })

    it("desde_plantilla_calcula_el_nombre_guarda_el_id_y_pide_renombrar", async () => {
        const template = { id: "t1", name: "Plantilla {D0}", parent: "otra", shows: [{ id: "s1" }], created: 5 }
        montar([looseEntry(projectTemplates, { t1: template })])
        abrir()
        fireEvent.click(item("Plantilla {D0}"))
        expect(getProjectName).toHaveBeenCalledWith("f1", { default_project_name: "Plantilla {D0}" })
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { data: { id: "t1", name: "Nombre calculado", parent: "f1", shows: [{ id: "s1" }], created: 5 } },
            oldData: { id: "uid-1" },
            location: { page: "show", id: "project" }
        })
        await waitFor(() => expect(get(activeRename)).toBe("project_uid-1"))
    })

    it("nueva_plantilla_crea_un_template_vacio_y_pide_renombrar", () => {
        montar()
        abrir()
        fireEvent.click(item("Nueva plantilla"))
        expect(get(activeRename)).toBe("project_uid-1")
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { data: { name: "", parent: "/", shows: [], created: 0 } },
            oldData: { id: "uid-1" },
            location: { page: "show", id: "project_template" }
        })
    })

    it("importar_manda_Main_IMPORT_con_el_formato_de_proyecto", () => {
        montar()
        abrir()
        fireEvent.click(item("Importar"))
        expect(sendMain).toHaveBeenCalledWith(Main.IMPORT, { channel: "freeshow_project", format: { extensions: ["project", "shows", "json", "zip"], name: "Proyecto" } })
        cerrado()
    })

    it("opciones_abre_el_popup_playlist_options_y_cierra", () => {
        montar()
        abrir()
        fireEvent.click(item("Opciones"))
        expect(get(activePopup)).toBe("playlist_options")
        cerrado()
    })
})
