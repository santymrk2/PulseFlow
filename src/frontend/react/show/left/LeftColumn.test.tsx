// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeProject, drawerTabsData, leftSource, loaded, projectView, projects, resized, categories } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { LeftColumn } from "./LeftColumn"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("./LibrariesPanel", () => ({ LibrariesPanel: () => <div>librerías</div> }))
vi.mock("./PlaylistsPanel", () => ({ PlaylistsPanel: () => <div>playlists</div> }))
vi.mock("./ItemsPanel", () => ({
    ItemsPanel: () => (
        <div className="library-search">
            <input placeholder="Buscar" />
        </div>
    )
}))

type Source = { type: "library" | "playlist"; id: string } | null
let restaurar: () => void = () => {}
function montar(opciones: { cargado?: boolean; fuente?: Source; listaProyectos?: Record<string, unknown>; proyecto?: string | null; tamaños?: Record<string, number> } = {}) {
    restaurar = setStoresForTest([
        looseEntry(projects, opciones.listaProyectos ?? { p2: { name: "Zeta", parent: "/" }, p1: { name: "Alfa", parent: "/" }, vieja: { name: "Vieja", parent: "/", deleted: true } }),
        looseEntry(categories, { general: { name: "General" } }),
        storeEntry(loaded, opciones.cargado ?? false),
        storeEntry(leftSource, opciones.fuente ?? null),
        storeEntry(activeProject, opciones.proyecto ?? null),
        storeEntry(projectView, true),
        looseEntry(drawerTabsData, {}),
        looseEntry(resized, opciones.tamaños ?? {})
    ] as never)
    return render(<LeftColumn />)
}

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.restoreAllMocks()
})

describe("LeftColumn", () => {
    it("renderiza_los_tres_paneles_y_dos_divisores_con_los_tamaños_iniciales", () => {
        montar()
        expect(screen.getByText("librerías")).toBeTruthy()
        expect(screen.getByText("playlists")).toBeTruthy()
        expect(screen.getByPlaceholderText("Buscar")).toBeTruthy()
        const separadores = screen.getAllByRole("separator")
        expect(separadores).toHaveLength(2)
        expect(separadores[0].getAttribute("aria-orientation")).toBe("horizontal")
        expect(screen.getByText("librerías").parentElement?.style.flex).toBe("0 0 18%")
        expect(screen.getByText("playlists").parentElement?.style.flex).toBe("0 0 22%")
    })

    it("usa_los_tamaños_guardados_cuando_hay", () => {
        montar({ tamaños: { leftLibraries: 25, leftPlaylists: 15 } })
        expect(screen.getByText("librerías").parentElement?.style.flex).toBe("0 0 25%")
        expect(screen.getByText("playlists").parentElement?.style.flex).toBe("0 0 15%")
    })

    it("al_cargar_resuelve_la_primera_playlist_válida_y_actualiza_la_vista", () => {
        montar({ cargado: true })
        expect(get(leftSource)).toEqual({ type: "playlist", id: "p1" })
        expect(get(activeProject)).toBe("p1")
        expect(get(projectView)).toBe(false)
    })

    it("sin_playlists_resuelve_la_biblioteca_por_defecto_y_su_subpestaña", () => {
        montar({ cargado: true, listaProyectos: {} })
        expect(get(leftSource)).toEqual({ type: "library", id: "general" })
        expect(get(drawerTabsData).shows.activeSubTab).toBe("general")
    })

    it("arrastrar_un_divisor_guarda_el_nuevo_reparto", () => {
        montar()
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 100 } as DOMRect)
        const separador = screen.getAllByRole("separator")[0]
        fireEvent.pointerDown(separador, { clientY: 0 })
        window.dispatchEvent(new MouseEvent("pointermove", { clientY: 10 }))
        window.dispatchEvent(new MouseEvent("pointerup"))
        expect(get(resized)).toMatchObject({ leftLibraries: 28, leftPlaylists: 12 })
    })

    it("focus-library-search_cambia_a_biblioteca_y_foca_el_buscador_de_ítems", async () => {
        montar({ fuente: { type: "playlist", id: "p1" } })
        await act(async () => {
            window.dispatchEvent(new Event("focus-library-search"))
            await Promise.resolve()
        })
        expect(get(leftSource)).toEqual({ type: "library", id: "general" })
        expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar"))
    })
})
