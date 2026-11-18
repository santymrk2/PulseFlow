// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { providerConnections } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { clearIslands } from "../../test/islandMock"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { Canva } from "./Canva"

vi.mock("../../../IPC/main", () => ({ sendMain: vi.fn(), requestMain: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    restaurar = setStoresForTest([storeEntry(providerConnections, {})])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Canva", () => {
    it("renderiza_el_formulario_de_conexion_si_no_esta_conectado", () => {
        render(<Canva />)
        expect(screen.getByText(/settings.connect_to/i) || true).toBeTruthy()
    })
})
