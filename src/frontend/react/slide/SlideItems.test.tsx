// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../types/Show"
import { slidesOptions } from "../../stores"
import autosize from "../../components/edit/scripts/autosize"
import { clearIslands, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { SlideItems } from "./SlideItems"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/edit/scripts/autosize", () => ({ default: vi.fn(() => 42) }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: ({ component }: { component: { name?: string } }) => <span data-island={component?.name || "svelte"} />
}))

function viewMock(name: string) {
    return ({ ...props }: Record<string, unknown>) => <span data-view={name} data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}

vi.mock("./views/MediaItem", () => ({ MediaItem: viewMock("MediaItem") }))
vi.mock("./views/Website", () => ({ Website: viewMock("Website") }))
vi.mock("./views/Timer", () => ({ Timer: viewMock("Timer") }))
vi.mock("../system/Clock", () => ({ Clock: viewMock("Clock") }))
vi.mock("../output/Window", () => ({ Window: () => <span data-isla="Window" /> }))
vi.mock("./views/SlideProgress", () => ({ SlideProgress: viewMock("SlideProgress") }))
vi.mock("./views/DynamicEvents", () => ({ DynamicEvents: viewMock("DynamicEvents") }))
vi.mock("./views/Weather", () => ({ Weather: viewMock("Weather") }))
vi.mock("./views/Visualizer", () => ({ Visualizer: viewMock("Visualizer") }))
vi.mock("./views/Captions", () => ({ Captions: viewMock("Captions") }))
vi.mock("./views/IconItem", () => ({ IconItem: viewMock("IconItem") }))
vi.mock("../drawer/audio/MetronomeVisualizer", () => ({ MetronomeVisualizer: () => <span data-island="MetronomeVisualizer" /> }))
vi.mock("./views/Variable", () => ({ Variable: viewMock("Variable") }))
vi.mock("./views/Chart", () => ({ Chart: viewMock("Chart") }))
vi.mock("./views/Table", () => ({ Table: viewMock("Table") }))
vi.mock("./views/QrCode", () => ({ QrCode: viewMock("QrCode") }))
vi.mock("../drawer/live/BMDStream", async () => ({ BMDStream: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("BMDStream") }))
vi.mock("../drawer/live/Cam", async () => ({ Cam: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Cam") }))
vi.mock("../drawer/live/NDIStream", async () => ({ NDIStream: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("NDIStream") }))
vi.mock("../drawer/live/OMTStream", async () => ({ OMTStream: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("OMTStream") }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(slidesOptions, { columns: 4, mode: "grid" })])
})
afterEach(() => {
    cleanup()
    clearIslands()
    restore()
    vi.clearAllMocks()
})

const ref = { type: "show" as const, id: "l1", showId: "s1" }
const renderItem = (item: Record<string, unknown>, props: Record<string, unknown> = {}) => render(<SlideItems item={item as unknown as Item} ref={ref} {...props} />).container

describe("SlideItems", () => {
    it("renderiza_media_con_el_slide_ref_y_el_preview_de_stage", () => {
        const container = renderItem({ type: "media", src: "/v.mp4" }, { isStage: true, outputId: "out1", slideIndex: 2 })
        const view = container.querySelector("[data-view='MediaItem']")!
        expect(view).toBeTruthy()
        expect(JSON.parse(view.getAttribute("data-props") || "{}")).toMatchObject({ outputId: "out1", preview: true, slideRef: { slideIndex: 2 } })
    })

    it("renderiza_web_con_disablePreview_cuando_es_plantilla", () => {
        const container = renderItem({ type: "web", web: { src: "https://x" } }, { isTemplatePreview: true })
        expect(JSON.parse(container.querySelector("[data-view='Website']")!.getAttribute("data-props") || "{}").disablePreview).toBe(true)
    })

    it("renderiza_timer_y_actualiza_la_fecha_cada_500ms", () => {
        vi.useFakeTimers()
        const container = renderItem({ type: "timer", timer: { id: "t1" } })
        const first = JSON.parse(container.querySelector("[data-view='Timer']")!.getAttribute("data-props") || "{}").today
        act(() => vi.advanceTimersByTime(500))
        const second = JSON.parse(container.querySelector("[data-view='Timer']")!.getAttribute("data-props") || "{}").today
        expect(second).not.toBe(first)
        vi.useRealTimers()
    })

    it("no_inicia_el_intervalo_si_no_es_timer", () => {
        vi.useFakeTimers()
        renderItem({ type: "weather" })
        expect(vi.getTimerCount()).toBe(0)
        vi.useRealTimers()
    })

    it("renderiza_clock_con_el_estilo_de_fuente_y_no_con_el_general", () => {
        const container = renderItem({ type: "clock", clock: { type: "analog" }, auto: false }, { fontSize: 30 })
        const props = JSON.parse(container.querySelector("[data-view='Clock']")!.getAttribute("data-props") || "{}")
        expect(props.fontStyle).toBe("font-size: 30px;")
        expect(props.style).toBe(false)
        expect(props.type).toBe("analog")
    })

    it("renderiza_las_camaras_por_tipo", () => {
        for (const [type, name] of [
            ["screen", "Window"],
            ["ndi", "NDIStream"],
            ["omt", "OMTStream"],
            ["blackmagic", "BMDStream"],
            ["camera", "Cam"]
        ]) {
            const container = renderItem({ type: "camera", device: { id: "d1", name: "Cámara", type } })
            expect(container.querySelector(`[data-isla='${name}']`)).toBeTruthy()
            cleanup()
        }
    })

    it("pasa_outputId_y_background_a_los_ports_de_streams", () => {
        for (const type of ["ndi", "omt"]) {
            renderItem({ type: "camera", device: { id: "d2", name: "Stream", type } }, { outputId: "out7" })
            const name = type === "ndi" ? "NDIStream" : "OMTStream"
            expect(islands[name]?.props).toMatchObject({ background: true, outputId: "out7" })
            cleanup()
        }
    })

    it("no_renderiza_camara_sin_device", () => {
        const container = renderItem({ type: "camera" })
        expect(container.firstElementChild).toBeNull()
    })

    it("renderiza_el_slide_tracker_con_el_fontSize_cuando_no_es_edicion", () => {
        const container = renderItem({ type: "slide_tracker" }, { fontSize: 20 })
        expect(JSON.parse(container.querySelector("[data-view='SlideProgress']")!.getAttribute("data-props") || "{}").autoSize).toBe(20)
    })

    it("calcula_el_tamano_de_eventos_segun_las_columnas_y_smallFontSize", () => {
        const container = renderItem({ type: "events", events: {} }, { smallFontSize: true })
        expect(JSON.parse(container.querySelector("[data-view='DynamicEvents']")!.getAttribute("data-props") || "{}").textSize).toBe(28)
    })

    it("renderiza_el_resto_de_vistas_simples", () => {
        for (const [type, view] of [
            ["weather", "Weather"],
            ["visualizer", "Visualizer"],
            ["captions", "Captions"],
            ["icon", "IconItem"],
            ["variable", "Variable"],
            ["chart", "Chart"],
            ["table", "Table"],
            ["qr_code", "QrCode"]
        ]) {
            const container = renderItem({ type })
            expect(container.querySelector(`[data-view='${view}']`)).toBeTruthy()
            cleanup()
        }
    })

    it("renderiza_el_metronomo", () => {
        const container = renderItem({ type: "metronome" })
        expect(container.querySelector("[data-island]")).toBeTruthy()
    })

    it("calcula_el_autosize_en_edicion_cuando_cambia_el_item", () => {
        vi.useFakeTimers()
        const itemElem = document.createElement("div")
        const { rerender } = render(<SlideItems item={{ type: "weather", a: 1 } as unknown as Item} ref={ref} edit itemElem={itemElem} />)
        act(() => vi.advanceTimersByTime(50))
        expect(autosize).toHaveBeenCalledWith(itemElem, { type: "growToFit", textQuery: "" })
        rerender(<SlideItems item={{ type: "slide_tracker", a: 2 } as unknown as Item} ref={ref} edit itemElem={itemElem} />)
        act(() => vi.advanceTimersByTime(50))
        expect(autosize).toHaveBeenLastCalledWith(itemElem, { type: "growToFit", textQuery: ".progress div" })
        vi.useRealTimers()
    })

    it("no_calcula_el_autosize_si_no_auto_y_textFit_none", () => {
        vi.useFakeTimers()
        const itemElem = document.createElement("div")
        render(<SlideItems item={{ type: "weather", auto: false, textFit: "none" } as unknown as Item} ref={ref} edit itemElem={itemElem} />)
        act(() => vi.advanceTimersByTime(50))
        expect(autosize).not.toHaveBeenCalled()
        vi.useRealTimers()
    })

    it("no_renderiza_nada_para_tipos_desconocidos", () => {
        const container = renderItem({ type: "unknown" })
        expect(container.firstElementChild).toBeNull()
    })
})
