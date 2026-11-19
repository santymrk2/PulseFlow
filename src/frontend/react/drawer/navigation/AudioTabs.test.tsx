// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeRename, audioFolders, audioPlaylists, dictionary, drawerTabsData, effectsLibrary, labelsDisabled, media } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { AudioTabs } from "./AudioTabs"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../../audio/audioPlaylist", () => ({ AudioPlaylist: { start: vi.fn() } }))
vi.mock("../../../shared/utils/helpers/dropActions", () => ({ addDrawerFolder: vi.fn() }))
vi.mock("../../../shared/utils/helpers/media", () => ({ countFolderMediaItems: () => ({ folder: 0, audio: 0, video: 0, image: 0 }) }))
vi.mock("../../../shared/core/ipc/main", () => ({
    sendMain: vi.fn(),
    receiveToMain: vi.fn(() => "listener-1"),
    destroyMain: vi.fn(),
    // Nunca resuelve: evita updates de state asíncronos fuera de act() en estos tests
    requestMain: vi.fn(() => new Promise(() => {}))
}))

interface SectionsProps {
    sections: unknown
    active?: string
    onRename?: (detail: { id: string; value: string }) => void
    section0?: ReactNode
    section1?: ReactNode
    section2?: ReactNode
    section3?: ReactNode
    section4?: ReactNode
}

vi.mock("./NavigationSections", () => ({
    NavigationSections: ({ sections, onRename, section0, section1, section2, section3, section4 }: SectionsProps) => (
        <div data-testid="sections" data-sections={JSON.stringify(sections)}>
            {section0}
            {section1}
            {section2}
            {section3}
            {section4}
            <button type="button" data-testid="rename" onClick={() => onRename?.({ id: "folder-1", value: "Renombrado" })}>
                renombrar
            </button>
        </div>
    )
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sections = (): Array<Array<Record<string, unknown>>> => JSON.parse(screen.getByTestId("sections").getAttribute("data-sections") || "[]") as Array<Array<Record<string, unknown>>>

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.clearAllMocks()
})

describe("AudioTabs", () => {
    beforeEach(() => {
        restaurar = setStoresForTest([
            looseEntry(dictionary, { new: { playlist: "Nueva playlist" }, category: { all: "Todos", favourites: "Favoritos", sound_effects: "Efectos" }, audio: { playlists: "Listas" }, media: { folders: "Carpetas" } }),
            looseEntry(drawerTabsData, { audio: { activeSubTab: "all", enabled: true } }),
            looseEntry(audioFolders, { "folder-1": { name: "Vieja", path: "/audio", default: true } }),
            looseEntry(audioPlaylists, {}),
            looseEntry(effectsLibrary, []),
            looseEntry(media, {}),
            looseEntry(labelsDisabled, false),
            looseEntry(activeRename, "")
        ])
    })

    it("arma las secciones de audio con los contadores y la carpeta", () => {
        render(<AudioTabs />)

        expect(sections()[0][0]).toMatchObject({ id: "all", label: "category.all", count: 0 })
        expect(sections()[1][1]).toBe("SEPARATOR")
        expect(sections()[3][0]).toMatchObject({ id: "TITLE", label: "audio.playlists" })
        expect(sections()[4][1]).toMatchObject({ id: "folder-1", label: "Vieja", icon: "folder" })
    })

    it("crea una playlist, la activa y pide renombrarla", () => {
        render(<AudioTabs />)
        fireEvent.click(screen.getByText("Nueva playlist").closest("button") as HTMLButtonElement)

        expect(Object.keys(get(audioPlaylists))).toHaveLength(1)
        expect(get(drawerTabsData).audio?.activeSubTab).toBe(Object.keys(get(audioPlaylists))[0])
        expect(get(activeRename)).toBe(`category_audio_${Object.keys(get(audioPlaylists))[0]}`)
    })

    it("renombrar una carpeta saca el flag default", () => {
        render(<AudioTabs />)
        fireEvent.click(screen.getByTestId("rename"))

        expect(get(audioFolders)["folder-1"].name).toBe("Renombrado")
        expect(get(audioFolders)["folder-1"].default).toBeUndefined()
    })
})
