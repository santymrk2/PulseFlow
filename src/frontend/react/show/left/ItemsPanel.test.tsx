// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, activeProfile, categories, dictionary, leftSource, projects, sortedShowsList } from "../../../stores"
import { getAccess } from "../../../utils/profile"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { ItemsPanel } from "./ItemsPanel"

const { libraryAddMenuProps } = vi.hoisted(() => ({ libraryAddMenuProps: { current: {} as Record<string, unknown> } }))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../LibraryAddMenu", () => ({
    LibraryAddMenu: (props: Record<string, unknown>) => {
        libraryAddMenuProps.current = props
        return <div data-isla="LibraryAddMenu" />
    }
}))
vi.mock("../ProjectContentList", () => ({ ProjectContentList: () => <div data-testid="project-content-list" /> }))
vi.mock("./LibraryShowList", () => ({
    LibraryShowList: ({ shows, searching }: { shows: { id: string }[]; searching: boolean }) => (
        <div data-testid="shows" data-searching={String(searching)}>
            {shows.map((show) => show.id).join(",")}
        </div>
    )
}))
vi.mock("./PlaylistOptionsMenu", () => ({ PlaylistOptionsMenu: ({ projectId }: { projectId: string }) => <div data-testid="options">{projectId}</div> }))

const catalogo = [
    { id: "s1", name: "Alpha", category: "general" },
    { id: "s2", name: "Otra", category: "general" },
    { id: "s3", name: "Song", category: "song" },
    { id: "privado", name: "Oculto", category: "general", private: true }
]

type Source = { type: "library" | "playlist"; id: string } | null
let restaurar: () => void = () => {}
function montar(opciones: { perfil?: boolean; acceso?: Record<string, string>; fuente?: Source } = {}) {
    vi.mocked(getAccess).mockImplementation((id: string) => (id === "shows" || id === "projects" ? opciones.acceso || {} : {}) as never)
    restaurar = setStoresForTest([
        storeEntry(activePopup, null),
        storeEntry(activeProfile, opciones.perfil ? "perfil" : null),
        storeEntry(leftSource, opciones.fuente === undefined ? { type: "library", id: "general" } : opciones.fuente),
        looseEntry(sortedShowsList, catalogo),
        looseEntry(categories, { general: { name: "General" }, song: { name: "Canciones" } }),
        looseEntry(projects, { p1: { name: "Mi lista", shows: [{ id: "s1" }, { id: "s2" }] } }),
        looseEntry(dictionary, { ui: { items_title: "Ítems", search_shows: "Buscar", add_shows: "Agregar shows" }, category: { unlabeled: "Sin etiqueta" }, main: { unnamed: "Sin nombre" } })
    ] as never)
    return render(<ItemsPanel />)
}

beforeEach(() => {
    vi.clearAllMocks()
    libraryAddMenuProps.current = {}
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ItemsPanel", () => {
    it("con_biblioteca_muestra_el_contexto_el_conteo_y_solo_los_shows_visibles", () => {
        montar()
        expect(screen.getByText("Ítems")).toBeTruthy()
        expect(screen.getByText("General")).toBeTruthy()
        expect(screen.getByText("2")).toBeTruthy()
        expect(screen.getByTestId("shows").textContent).toBe("s1,s2")
        expect(screen.getByTestId("shows").getAttribute("data-searching")).toBe("false")
        expect(libraryAddMenuProps.current).toEqual({ readOnly: false })
    })

    it("la_búsqueda_filtra_y_marca_searching_cuando_no_hay_resultados", () => {
        montar()
        const input = screen.getByPlaceholderText("Buscar")
        fireEvent.input(input, { target: { value: "otr" } })
        expect(screen.getByTestId("shows").textContent).toBe("s2")
        fireEvent.input(input, { target: { value: "zzz" } })
        expect(screen.getByTestId("shows").textContent).toBe("")
        expect(screen.getByTestId("shows").getAttribute("data-searching")).toBe("true")
    })

    it("la_búsqueda_se_reinicia_al_cambiar_de_fuente", async () => {
        montar()
        fireEvent.input(screen.getByPlaceholderText("Buscar"), { target: { value: "otr" } })
        expect(screen.getByTestId("shows").textContent).toBe("s2")
        await act(async () => {
            leftSource.set({ type: "library", id: "song" })
            await Promise.resolve()
        })
        expect((screen.getByPlaceholderText("Buscar") as HTMLInputElement).value).toBe("")
        expect(screen.getByTestId("shows").textContent).toBe("s3")
    })

    it("con_playlist_muestra_sus_ítems_las_opciones_y_abla_el_modal_agregar_shows", () => {
        montar({ fuente: { type: "playlist", id: "p1" } })
        expect(screen.getByText("Mi lista")).toBeTruthy()
        expect(screen.getByText("2")).toBeTruthy()
        expect(screen.getByTestId("options").textContent).toBe("p1")
        expect(screen.getByTestId("project-content-list")).toBeTruthy()
        fireEvent.click(document.querySelector('[data-title="Agregar shows"]') as HTMLElement)
        expect(get(activePopup)).toBe("add_shows")
    })

    it("el_perfil_de_solo_lectura_deshabilita_agregar_shows", () => {
        montar({ perfil: true, acceso: { global: "read" }, fuente: { type: "playlist", id: "p1" } })
        expect((document.querySelector('[data-title="Agregar shows"]') as HTMLButtonElement).disabled).toBe(true)
    })
})
