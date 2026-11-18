// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mediaOptions } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { clearIslands } from "../../test/islandMock"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Folder } from "./Folder"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).makePortMock("Loader") }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    restaurar = setStoresForTest([storeEntry(mediaOptions, { columns: 4, mode: "grid" })])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Folder", () => {
    it("renderiza_el_nombre", () => {
        render(<Folder name="Mi carpeta" path="/p" mode="grid" />)
        expect(screen.getByText("Mi carpeta")).toBeTruthy()
    })

    it("dispara_onOpen_al_click", () => {
        const onOpen = vi.fn()
        const { container } = render(<Folder name="C" path="/p" mode="grid" onOpen={onOpen} />)
        const over = container.querySelector("[role='button']") as HTMLElement
        fireEvent.click(over)
        expect(onOpen).toHaveBeenCalledWith("/p")
    })
})
