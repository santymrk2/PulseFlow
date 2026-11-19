// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { OUTPUT } from "../../../../types/Channels"
import { AudioAnalyser } from "../../../audio/audioAnalyser"
import { currentWindow, visualizerData } from "../../../shared/core/stores"
import { send } from "../../../shared/utils/request"
import { drawKaleidoscope } from "../logic/views/visualizerKaleidoscope"
import { drawParticles } from "../logic/views/visualizerParticles"
import { looseEntry, setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Visualizer } from "./Visualizer"

vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: { getAnalysers: vi.fn(() => []) } }))
vi.mock("../../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../logic/views/visualizerKaleidoscope", () => ({ drawKaleidoscope: vi.fn() }))
vi.mock("../logic/views/visualizerParticles", () => ({ drawParticles: vi.fn() }))

const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: ""
}

let restore: () => void = () => {}
let frames: FrameRequestCallback[] = []

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    frames = []
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((callback: FrameRequestCallback) => {
            frames.push(callback)
            return frames.length
        })
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    restore = setStoresForTest([storeEntry(currentWindow, null), looseEntry(visualizerData, null)])
    vi.mocked(AudioAnalyser.getAnalysers).mockReturnValue([] as never)
})

afterEach(() => {
    cleanup()
    restore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
})

const item = { visualizer: { type: "bars", padding: 0, color: null } } as Item

describe("Visualizer", () => {
    it("renderiza_un_canvas", () => {
        const { container } = render(<Visualizer item={item} />)
        expect(container.querySelector("canvas")).toBeTruthy()
    })

    it("en_modo_edicion_dibuja_barras_simuladas_sin_iniciar_el_loop", () => {
        const { container } = render(<Visualizer item={item} edit />)
        expect(container.querySelector("canvas")).toBeTruthy()
        expect(ctx.clearRect).toHaveBeenCalled()
        expect(ctx.fillRect).toHaveBeenCalledTimes(128)
        expect(requestAnimationFrame).not.toHaveBeenCalled()
    })

    it("en_modo_edicion_con_kaleidoscope_llama_al_dibujador", () => {
        render(<Visualizer item={{ visualizer: { type: "kaleidoscope", padding: 0 } } as Item} edit />)
        expect(drawKaleidoscope).toHaveBeenCalledTimes(1)
        expect(ctx.fillRect).not.toHaveBeenCalled()
    })

    it("en_ventana_de_salida_dibuja_las_barras_recibidas_por_ipc", () => {
        restore = setStoresForTest([
            storeEntry(currentWindow, "output"),
            looseEntry(visualizerData, {
                bars: [
                    { height: 10, percentage: 0.5 },
                    { height: 20, percentage: 1 }
                ],
                buffers: 2
            })
        ])
        render(<Visualizer item={item} />)
        expect(ctx.clearRect).toHaveBeenCalled()
        expect(ctx.fillRect).toHaveBeenCalledTimes(2)
    })

    it("en_ventana_de_salida_con_particles_llama_al_dibujador", () => {
        restore = setStoresForTest([storeEntry(currentWindow, "output"), looseEntry(visualizerData, { bars: [{ height: 10, percentage: 0.5 }], buffers: 1 })])
        render(<Visualizer item={{ visualizer: { type: "particles" } } as Item} />)
        expect(drawParticles).toHaveBeenCalledTimes(1)
    })

    it("en_preview_con_analizadores_inicia_el_loop_y_envia_datos", () => {
        vi.mocked(AudioAnalyser.getAnalysers).mockReturnValue([{ frequencyBinCount: 2, fftSize: 256, getByteFrequencyData: vi.fn() }] as never)
        render(<Visualizer item={item} preview />)
        expect(requestAnimationFrame).toHaveBeenCalled()
        act(() => frames[0](100))
        expect(send).toHaveBeenCalledWith(OUTPUT, ["VISUALIZER_DATA"], expect.objectContaining({ buffers: 2 }))
    })

    it("al_desmontar_limpia_el_canvas_y_envia_null_en_preview", () => {
        const { unmount } = render(<Visualizer item={item} preview edit />)
        ctx.clearRect.mockClear()
        unmount()
        expect(ctx.clearRect).toHaveBeenCalled()
        expect(get(visualizerData)).toBeNull()
        expect(send).toHaveBeenCalledWith(OUTPUT, ["VISUALIZER_DATA"], null)
    })

    it("sin_preview_no_envia_null_al_desmontar", () => {
        const { unmount } = render(<Visualizer item={item} />)
        unmount()
        expect(send).not.toHaveBeenCalled()
    })
})
