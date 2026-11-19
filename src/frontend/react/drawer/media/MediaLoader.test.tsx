// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { outputs, previewOutputId, styles as stylesStore } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { clearIslands } from "../../../shared/test/islandMock"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { MediaLoader } from "./MediaLoader"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../output/Camera", async () => ({ Camera: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Camera") }))

beforeEach(() => {
    vi.clearAllMocks()
    clearIslands()
    setStoresForTest([storeEntry(outputs, {}), storeEntry(previewOutputId, null), storeEntry(stylesStore, {})])
})

afterEach(() => {
    cleanup()
})

describe("MediaLoader", () => {
    it("no_renderiza_sin_path", () => {
        const { container } = render(<MediaLoader path="" />)
        expect(container.innerHTML).toBe("")
    })

    it("renderiza_el_contenedor_con_el_path", () => {
        const { container } = render(<MediaLoader path="/media/foto.jpg" name="foto" type="image" />)
        expect(container.firstChild).not.toBeNull()
        expect(container.innerHTML).toContain("foto")
    })

    it("usa_la_relacion_de_aspecto_de_la_resolucion", () => {
        const { container } = render(<MediaLoader path="/media/foto.jpg" resolution={{ width: 16, height: 9 }} />)
        expect((container.firstChild as HTMLElement).style.aspectRatio.replaceAll(" ", "")).toBe("16/9")
    })

    it("usa_el_port_Camera_para_camaras", () => {
        const { container } = render(<MediaLoader path="cam1" type="camera" cameraGroup="g1" />)
        expect(container.querySelector('[data-isla="Camera"]')).toBeTruthy()
    })
})
