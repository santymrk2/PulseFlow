// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeProfile, categories, dictionary, folders, leftSource, projects, sorted } from "../../../shared/core/stores"
import { getAccess } from "../../../shared/utils/profile"
import { looseEntry, setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { PlaylistsPanel } from "./PlaylistsPanel"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, MENU_BAR_HEIGHT: 25 }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
let projectListProps: { tree?: unknown[]; readOnly?: boolean; selectedId?: string | null } = {}
vi.mock("../ProjectList", () => ({
    ProjectList: (props: { tree?: unknown[]; readOnly?: boolean; selectedId?: string | null }) => {
        projectListProps = props
        return <div data-testid="project-list" />
    }
}))
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
        expect(projectListProps.tree).toHaveLength(2)
        expect(projectListProps).toMatchObject({ readOnly: false, selectedId: "p1" })
        expect(document.querySelector(".context")?.className).toContain("#projects")
        expect(screen.getByTestId("add-menu").getAttribute("data-readonly")).toBe("false")
    })

    it("sin_fuente_de_playlist_no_marca_ninguna_como_activa", () => {
        montar({ fuente: { type: "library", id: "general" } })
        expect(projectListProps.selectedId).toBeNull()
    })

    it("con_perfil_de_solo_lectura_quita_el_contexto_y_deshabilita_el_menú", () => {
        montar({ perfil: true, acceso: { global: "read" } })
        expect(projectListProps.readOnly).toBe(true)
        expect(screen.getByTestId("add-menu").getAttribute("data-readonly")).toBe("true")
        expect(document.querySelector(".context")).toBeNull()
    })
})
