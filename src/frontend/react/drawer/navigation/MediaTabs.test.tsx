// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { dictionary, drawerTabsData, labelsDisabled, media, mediaFolders, providerConnections, special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { MediaTabs } from "./MediaTabs"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/profile", () => ({ getAccess: () => ({}) }))
vi.mock("../../../components/helpers/dropActions", () => ({ addDrawerFolder: vi.fn() }))
vi.mock("../../../components/helpers/media", () => ({ countFolderMediaItems: () => ({ folder: 0, audio: 0, video: 0, image: 0 }) }))
vi.mock("../../../shared/core/ipc/main", () => ({
    sendMain: vi.fn(),
    receiveToMain: vi.fn(() => "listener-2"),
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
    NavigationSections: ({ sections, onRename, section2, section3 }: SectionsProps) => (
        <div data-testid="sections" data-sections={JSON.stringify(sections)}>
            {section2}
            {section3}
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

describe("MediaTabs", () => {
    beforeEach(() => {
        restaurar = setStoresForTest([looseEntry(dictionary, { new: { system_folder: "Nueva carpeta" } }), looseEntry(drawerTabsData, { media: { activeSubTab: "all", enabled: true } }), looseEntry(labelsDisabled, false), looseEntry(media, {}), looseEntry(mediaFolders, { "folder-1": { name: "Vieja", path: "/videos", default: true } }), looseEntry(providerConnections, {}), looseEntry(special, {})])
    })

    it("arma las secciones sin curriculum cuando no hay providers conectados", () => {
        render(<MediaTabs />)

        expect(sections()[0][0]).toMatchObject({ id: "all", label: "category.all", count: 0 })
        expect(sections().some((section) => section.some((item) => item?.label === "Curriculum"))).toBe(false)
        expect(sections().at(-1)?.[1]).toMatchObject({ id: "folder-1", label: "Vieja" })
    })

    it("pide al main que abra el selector de carpeta", () => {
        render(<MediaTabs />)
        // El mismo botón se usa en los slots 2 y 3 (sin curriculum / con carpetas)
        fireEvent.click(screen.getAllByText("Nueva carpeta")[0].closest("button") as HTMLButtonElement)

        expect(sendMain).toHaveBeenCalledWith(Main.OPEN_FOLDER, expect.anything())
    })

    it("renombrar una carpeta saca el flag default", () => {
        render(<MediaTabs />)
        fireEvent.click(screen.getByTestId("rename"))

        expect(get(mediaFolders)["folder-1"].name).toBe("Renombrado")
        expect(get(mediaFolders)["folder-1"].default).toBeUndefined()
    })
})
