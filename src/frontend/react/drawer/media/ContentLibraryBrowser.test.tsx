// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { requestMain } from "../../../shared/core/ipc/main"
import { mediaOptions, openedMediaFolders } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { clearIslands } from "../../test/islandMock"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { ContentLibraryBrowser } from "./ContentLibraryBrowser"

vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./MediaCard", async () => ({ MediaCard: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).makePortMock("MediaCard") }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    restaurar = setStoresForTest([storeEntry(mediaOptions, { columns: 4, mode: "grid" }), storeEntry(openedMediaFolders, {})])
    vi.mocked(requestMain).mockImplementation(((_id: unknown, _value: unknown, callback?: (data: unknown) => void) => {
        callback?.([{ key: "cat-1", name: "Categoría 1", children: [] }])
        return Promise.resolve(undefined)
    }) as never)
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("ContentLibraryBrowser", () => {
    it("renderiza_las_categorias_devueltas_por_el_provider", () => {
        render(<ContentLibraryBrowser providerId="canva" />)
        expect(screen.getByText("Categoría 1")).toBeTruthy()
    })

    it("pide_la_biblioteca_al_montar", () => {
        render(<ContentLibraryBrowser providerId="canva" />)
        expect(requestMain).toHaveBeenCalled()
    })
})
