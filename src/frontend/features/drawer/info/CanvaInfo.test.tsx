// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addCanvaPresentationAsShow } from "../../import/canvaPresentation"
import { activeCanvaPresentation } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { CanvaInfo } from "./CanvaInfo"

vi.mock("../../import/canvaPresentation", () => ({ addCanvaPresentationAsShow: vi.fn() }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {} }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

const PRESENTATION = { designId: "abc123", presentationName: "Charlas", slideCount: 4, thumbnail: "thumb.jpg" }
let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(activeCanvaPresentation, PRESENTATION)])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CanvaInfo", () => {
    it("muestra la miniatura, el título y los metadatos de la presentación", () => {
        const { container } = render(<CanvaInfo />)
        expect((container.querySelector("img") as HTMLImageElement).src).toContain("thumb.jpg")
        expect(screen.getByText("Charlas")).toBeTruthy()
        expect(screen.getByText("4")).toBeTruthy()
        expect(screen.getByText("canva.com/design/abc123/view")).toBeTruthy()
    })

    it("convierte la presentación activa al pulsar el botón", () => {
        const { container } = render(<CanvaInfo />)
        fireEvent.click(container.querySelector("button") as HTMLButtonElement)
        expect(addCanvaPresentationAsShow).toHaveBeenCalledWith(PRESENTATION)
    })

    it("no muestra nada sin presentación activa", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeCanvaPresentation, null)])
        const { container } = render(<CanvaInfo />)
        expect(screen.queryByText("Charlas")).toBeNull()
        expect(container.firstElementChild).toBeTruthy()
    })
})
