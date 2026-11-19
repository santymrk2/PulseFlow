// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addShowsToProject } from "../../../components/show/project"
import { activePopup, activeProfile, categories, dictionary, leftSource, projects, sortedShowsList } from "../../../shared/core/stores"
import { getAccess } from "../../../utils/profile"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { AddShowsModal } from "./AddShowsModal"

vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../../components/show/project", () => ({ addShowsToProject: vi.fn() }))

const catalogo = [
    { id: "s1", name: "Alpha", category: "general" },
    { id: "s2", name: "Beta", category: "song" },
    { id: "s3", name: "Sin categoria", category: null },
    { id: "s4", name: "Delta", category: "arch" }
]

let restaurar: () => void = () => {}
function montar(profile: Record<string, string> = {}) {
    vi.mocked(getAccess).mockReturnValue(profile as never)
    restaurar = setStoresForTest([
        storeEntry(activePopup, "add_shows"),
        storeEntry(activeProfile, "perfil"),
        storeEntry(leftSource, { type: "playlist", id: "p1" }),
        looseEntry(projects, { p1: { name: "Lista" } }),
        looseEntry(sortedShowsList, catalogo),
        looseEntry(categories, {
            general: { name: "General" },
            song: { name: "Songs" },
            scripture: { name: "Scripture" },
            arch: { name: "Archivo", isArchive: true }
        }),
        looseEntry(dictionary, {
            ui: { add_shows: "Agregar shows", libraries: "Bibliotecas", search_shows: "Buscar", no_results: "Sin resultados", add_count: "Agregar $1 shows" },
            empty: { shows: "No hay shows" },
            popup: { cancel: "Cancelar" },
            category: { unlabeled: "Sin etiqueta" },
            actions: { close: "Cerrar" }
        })
    ] as never)
    return render(<AddShowsModal />)
}

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => {
    cleanup()
    restaurar()
})

const elegidos = () => document.querySelector<HTMLElement>('[class*="chosen"]')?.textContent || ""

describe("AddShowsModal", () => {
    it("muestra_el_marco_y_las_bibliotecas_ordenadas_ocultando_las_heredadas_vacias", () => {
        montar()
        expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Agregar shows")
        const nav = screen.getByRole("navigation", { name: "Bibliotecas" })
        expect([...nav.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["General", "Songs", "Archivo", "Sin etiqueta"])
        expect(screen.getByText("Alpha")).toBeTruthy()
    })

    it("oculta_una_biblioteca_sin_acceso", () => {
        montar({ general: "none" })
        const nav = screen.getByRole("navigation", { name: "Bibliotecas" })
        expect([...nav.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("General")
    })

    it("conserva_la_selección_al_cambiar_de_biblioteca_y_filtra_por_busqueda", () => {
        montar()
        fireEvent.click(screen.getByRole("button", { name: "Songs" }))
        expect(screen.getByText("Beta")).toBeTruthy()
        expect(screen.queryByText("Alpha")).toBeNull()
        fireEvent.click(screen.getByRole("checkbox"))
        expect(elegidos()).toBe("Beta")

        fireEvent.click(screen.getByRole("button", { name: "General" }))
        expect(screen.getByText("Alpha")).toBeTruthy()
        expect(elegidos()).toBe("Beta")

        fireEvent.input(screen.getByPlaceholderText("Buscar"), { target: { value: "zzz" } })
        expect(screen.getByText("Sin resultados")).toBeTruthy()
    })

    it("confirmar_agrega_los_shows_elegidos_y_cierra", () => {
        montar()
        const agregar = screen.getByText("Agregar 0 shows").closest("button") as HTMLButtonElement
        expect(agregar.disabled).toBe(true)
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByText("Agregar 1 shows"))
        expect(addShowsToProject).toHaveBeenCalledWith("p1", ["s1"])
        expect(get(activePopup)).toBeNull()
    })

    it("cancelar_cierra_sin_agregar", () => {
        montar()
        fireEvent.click(screen.getByText("Cancelar"))
        expect(get(activePopup)).toBeNull()
        expect(addShowsToProject).not.toHaveBeenCalled()
    })

    it("clic_en_el_backdrop_cierra_porque_lockOutsideClick_es_false", () => {
        montar()
        const backdrop = screen.getByRole("dialog").parentElement as HTMLElement
        fireEvent.mouseDown(backdrop)
        expect(get(activePopup)).toBeNull()
        expect(addShowsToProject).not.toHaveBeenCalled()
    })

    it("escape_cierra_sin_agregar", () => {
        montar()
        fireEvent.keyDown(window, { key: "Escape" })
        expect(get(activePopup)).toBeNull()
        expect(addShowsToProject).not.toHaveBeenCalled()
    })
})
