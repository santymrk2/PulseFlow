// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { outputs, previewOutputId, styles } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Zoomed } from "./Zoomed"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/helpers/output", () => ({
    DEFAULT_BOUNDS: { width: 1920, height: 1080 },
    getActiveOutputs: vi.fn(() => ["out1"]),
    getResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    getOutputResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))

interface Observed {
    node: Element
    cb: (rect: DOMRectReadOnly) => void
}
let observed: Observed[] = []

let restore: () => void = () => {}
beforeEach(() => {
    observed = []
    vi.stubGlobal(
        "ResizeObserver",
        class {
            constructor(private callback: ResizeObserverCallback) {}
            observe(node: Element) {
                observed.push({
                    node,
                    cb: (rect) => this.callback([{ target: node, contentRect: rect } as ResizeObserverEntry], this as never)
                })
            }
            unobserve(node: Element) {
                observed = observed.filter((entry) => entry.node !== node)
            }
            disconnect() {
                observed = []
            }
        }
    )
    restore = setStoresForTest([looseEntry(outputs, { out1: { style: "st1" } }), looseEntry(styles, { st1: {} }), looseEntry(previewOutputId, null)])
})
afterEach(() => {
    cleanup()
    restore()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const rect = (width: number, height: number) => ({ width, height }) as DOMRectReadOnly

describe("Zoomed", () => {
    it("usa_la_salida_activa_y_muestra_el_contenido_dentro_del_zoom", () => {
        const { container } = render(
            <Zoomed>
                <span data-testid="content">hola</span>
            </Zoomed>
        )
        expect(container.querySelector("#out1")).toBeTruthy()
        expect(container.querySelector(".zoom [data-testid='content']")).toBeTruthy()
    })

    it("sin_zoom_muestra_el_contenido_directamente", () => {
        const { container } = render(
            <Zoomed zoom={false}>
                <span data-testid="content">hola</span>
            </Zoomed>
        )
        expect(container.querySelector(".zoom")).toBeNull()
        expect(container.querySelector(".slide [data-testid='content']")).toBeTruthy()
    })

    it("aplica_el_background_la_transicion_y_la_relacion_de_aspecto", () => {
        const { container } = render(<Zoomed background="#123456" backgroundDuration={0} />)
        const inner = container.querySelector(".slide") as HTMLElement
        expect(inner.style.backgroundColor).toBe("#123456")
        expect(inner.style.transition).toContain("0ms")
        expect(inner.style.aspectRatio).toBe("1920 / 1080")
    })

    it("usa_background-image_para_los_gradientes", () => {
        const { container } = render(<Zoomed background="linear-gradient(red, blue)" />)
        expect((container.querySelector(".slide") as HTMLElement).style.backgroundImage).toContain("linear-gradient")
    })

    it("aplica_el_outline_y_el_align_en_el_contenedor", () => {
        const { container } = render(<Zoomed outline="red" align="end" />)
        const outer = container.firstElementChild as HTMLElement
        expect(outer.style.border).toContain("red")
        expect(outer.style.justifyContent).toBe("end")
    })

    it("con_center_la_alineacion_segura_gana_al_align", () => {
        const { container } = render(<Zoomed align="end" center />)
        const outer = container.firstElementChild as HTMLElement
        expect(outer.style.justifyContent).toBe("safe center")
        expect(outer.style.display).toBe("flex")
    })

    it("aplica_las_clases_de_estado", () => {
        const { container } = render(<Zoomed disabled border checkered relative hideOverflow={false} />)
        const outer = container.firstElementChild as HTMLElement
        const inner = container.querySelector(".slide") as HTMLElement
        expect(outer.className).toContain("disabled")
        expect(inner.className).toContain("border")
        expect(inner.className).toContain("checkered")
        expect(inner.className).toContain("relative")
        expect(inner.className).not.toContain("hideOverflow")
    })

    it("notifica_el_ratio_calculado_a_partir_del_tamano_del_slide", () => {
        const onRatioChange = vi.fn()
        render(<Zoomed onRatioChange={onRatioChange} />)
        act(() => {
            observed.find((entry) => entry.node.classList.contains("slide"))?.cb(rect(960, 540))
        })
        expect(onRatioChange).toHaveBeenCalledWith(0.5)
        expect((document.querySelector(".zoom") as HTMLElement).style.zoom).toBe("0.5")
    })

    it("aplica_customZoom_al_ratio_calculado", () => {
        const onRatioChange = vi.fn()
        render(<Zoomed onRatioChange={onRatioChange} customZoom={2} />)
        act(() => {
            observed.find((entry) => entry.node.classList.contains("slide"))?.cb(rect(960, 540))
        })
        expect(onRatioChange).toHaveBeenCalledWith(0.25)
    })

    it("reubica_el_slot_host_dentro_del_slide_y_lo_limpia_al_desmontar", () => {
        const host = document.createElement("div")
        host.innerHTML = "<span>slot</span>"
        const { container, unmount } = render(<Zoomed slotHost={host} />)
        expect(container.querySelector(".slide")?.contains(host)).toBe(true)
        unmount()
        expect(host.parentNode).toBeNull()
    })

    it("aplica_el_recorte_por_pantalla", () => {
        const { container } = render(<Zoomed cropping={{ top: 10, right: 20, bottom: 30, left: 40 }} />)
        const inner = container.querySelector(".slide") as HTMLElement
        expect(inner.style.marginTop).toBe("10px")
        expect(inner.style.marginBottom).toBe("30px")
        expect(parseFloat(inner.style.marginInlineStart)).toBeCloseTo(45.56, 1)
        expect(parseFloat(inner.style.marginInlineEnd)).toBeCloseTo(25.56, 1)
    })

    it("ignora_el_recorte_cuando_esta_espejado", () => {
        const { container } = render(<Zoomed mirror cropping={{ top: 10, right: 20, bottom: 30, left: 40 }} />)
        expect((container.querySelector(".slide") as HTMLElement).style.marginTop).toBe("")
    })
})
