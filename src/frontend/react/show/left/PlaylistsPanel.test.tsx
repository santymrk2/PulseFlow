// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeProfile, categories, dictionary, folders, leftSource, projects, sorted } from "../../../stores"
import { getAccess } from "../../../utils/profile"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { PlaylistsPanel } from "./PlaylistsPanel"

vi.mock("../../../utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../../components/show/ProjectList.svelte", () => ({ default: { isla: "ProjectList" } }))
vi.mock("./PlaylistAddMenu", () => ({ PlaylistAddMenu: ({ readOnly }: { readOnly: boolean }) => <div data-testid="add-menu" data-readonly={String(readOnly)} /> }))

let restaurar: () => void = () => {}
function montar(opciones: { perfil?: boolean; acceso?: Record<string, string>; fuente?: { type: "library" | "playlist"; id: string } | null } = {}) {
    vi.mocked(getAccess).mockReturnValue((opciones.acceso || {}) as never)
    restaurar = setStoresForTest([
        storeEntry(activeProfile, opciones.perfil ? "perfil" : null),
        looseEntry(folders, {}),
        looseEntry(projects, {
            p1: { name: "Alfa", parent: "/" },
            p2: { name: "Zeta", parent: "/" }
        }),
        looseEntry(categories, {}),
        looseEntry(sorted, { projects: { type: "name" } }),
        storeEntry(leftSource, opciones.fuente === undefined ? { type: "playlist", id: "p1" } : opciones.fuente),
        looseEntry(dictionary, { ui: { playlists: "Playlists" } })
    ] as never)
    return render(<PlaylistsPanel />)
}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("PlaylistsPanel", () => {
    it("muestra_el_título_y_el_conteo_y_pasa_el_árbol_y_la_playlist_activa_a_ProjectList", () => {
        montar()
        expect(screen.getByText("Playlists")).toBeTruthy()
        expect(screen.getByText("2")).toBeTruthy()
        expect(islands.ProjectList.props.tree).toHaveLength(2)
        expect(islands.ProjectList.props).toMatchObject({ readOnly: false, selectedId: "p1" })
        expect(document.querySelector(".context")?.className).toContain("#projects")
        expect(screen.getByTestId("add-menu").getAttribute("data-readonly")).toBe("false")
    })

    it("sin_fuente_de_playlist_no_marca_ninguna_como_activa", () => {
        montar({ fuente: { type: "library", id: "general" } })
        expect(islands.ProjectList.props.selectedId).toBeNull()
    })

    it("con_perfil_de_solo_lectura_quita_el_contexto_y_deshabilita_el_menú", () => {
        montar({ perfil: true, acceso: { global: "read" } })
        expect(islands.ProjectList.props.readOnly).toBe(true)
        expect(screen.getByTestId("add-menu").getAttribute("data-readonly")).toBe("true")
        expect(document.querySelector(".context")).toBeNull()
    })
})
