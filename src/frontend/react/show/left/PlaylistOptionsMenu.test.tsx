// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import { exportProject } from "../../../components/export/project"
import { shareProjectLink } from "../../../components/export/projectLink"
import { contentProviderData, dictionary, projects, providerConnections, special } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, type StoreEntry, setStoresForTest } from "../../test/storeTestKit"
import { PlaylistOptionsMenu } from "./PlaylistOptionsMenu"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../../components/export/project", () => ({ exportProject: vi.fn() }))
vi.mock("../../../components/export/projectLink", () => ({ shareProjectLink: vi.fn() }))

const dict = {
    create_show: { more_options: "Más opciones" },
    cloud: { sync: "Sincronizar" },
    actions: { save_to_file: "Guardar en archivo", collapsed: "Contraer secciones", lock_sections: "Bloquear secciones" },
    export: { data_link: "Copiar enlace" },
    timeline: { toggle_timeline: "Línea de tiempo" }
}

const project = (extra: Record<string, unknown> = {}) => ({ id: "p1", name: "Proyecto", parent: "/", shows: [], created: 0, ...extra })
const baseProject = project()

let restaurar: () => void = () => {}
function montar(projectId = "p1", extra: StoreEntry[] = []) {
    restaurar = setStoresForTest([looseEntry(projects, { p1: baseProject }), looseEntry(providerConnections, {}), looseEntry(contentProviderData, {}), looseEntry(special, { projectTimelineActive: false }), looseEntry(dictionary, dict), ...extra] as never)
    return render(<PlaylistOptionsMenu projectId={projectId} />)
}

const boton = () => document.querySelector('[data-title="Más opciones"]') as HTMLButtonElement
const abrir = () => fireEvent.click(boton())
const item = (name: string) => screen.getAllByRole("menuitem").find((n) => n.textContent?.includes(name)) as HTMLElement
const tieneItem = (name: string) => screen.queryAllByRole("menuitem").some((n) => n.textContent?.includes(name))
const cerrado = () => expect(screen.queryByRole("menu")).toBeNull()

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PlaylistOptionsMenu", () => {
    it("no_muestra_nada_si_la_playlist_no_existe", () => {
        montar("inexistente")
        expect(screen.queryByRole("button")).toBeNull()
    })

    it("sincroniza_con_OnStage_y_cierra_el_menu", () => {
        const onstage = project({ id: "onstage_abc", name: "OnStage", origin: "onstage" })
        montar("onstage_abc", [looseEntry(projects, { onstage_abc: onstage }), looseEntry(providerConnections, { onstage: true }), looseEntry(contentProviderData, { onstage: { serviceId: "svc" } })])
        abrir()
        fireEvent.click(item("Sincronizar"))
        expect(sendMain).toHaveBeenCalledWith(Main.ONSTAGE_LOAD_SERVICE, { serviceId: "abc", data: { serviceId: "svc" } })
        cerrado()
    })

    it("no_ofrece_sincronizar_si_OnStage_no_esta_conectado", () => {
        montar("p1", [looseEntry(projects, { p1: project({ origin: "onstage" }) })])
        abrir()
        expect(tieneItem("Sincronizar")).toBe(false)
    })

    it("guardar_en_archivo_llama_a_exportProject_con_la_ruta_de_origen", () => {
        const conRuta = project({ sourcePath: "/tmp/proyecto" })
        montar("p1", [looseEntry(projects, { p1: conRuta })])
        abrir()
        fireEvent.click(item("Guardar en archivo"))
        expect(exportProject).toHaveBeenCalledWith(conRuta, "p1", "/tmp/proyecto")
        cerrado()
    })

    it("copiar_enlace_llama_a_shareProjectLink", () => {
        montar()
        abrir()
        fireEvent.click(item("Copiar enlace"))
        expect(shareProjectLink).toHaveBeenCalledWith(baseProject, "p1")
        cerrado()
    })

    it("alterna_la_linea_de_tiempo_en_special_y_muestra_la_marca", () => {
        montar()
        abrir()
        fireEvent.click(item("Línea de tiempo"))
        expect(get(special).projectTimelineActive).toBe(true)
        abrir()
        expect(item("Línea de tiempo").textContent).toContain("✓")
        fireEvent.click(item("Línea de tiempo"))
        expect(get(special).projectTimelineActive).toBe(false)
    })

    it("con_secciones_alterna_contraer_y_bloquear_en_projects", () => {
        const conSecciones = project({ shows: [{ id: "s1", type: "section" }] })
        montar("p1", [looseEntry(projects, { p1: conSecciones })])
        abrir()
        expect(item("Contraer secciones")).toBeTruthy()
        expect(item("Bloquear secciones")).toBeTruthy()
        fireEvent.click(item("Contraer secciones"))
        expect(get(projects).p1.sectionsCollapsed).toBe(true)
        abrir()
        fireEvent.click(item("Bloquear secciones"))
        expect(get(projects).p1.sectionsLocked).toBe(true)
    })

    it("sin_secciones_no_muestra_las_opciones_de_secciones", () => {
        montar()
        abrir()
        expect(tieneItem("Contraer secciones")).toBe(false)
        expect(tieneItem("Bloquear secciones")).toBe(false)
    })
})
