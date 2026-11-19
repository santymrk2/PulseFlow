// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OUTPUT } from "../../../types/Channels"
import type { Item } from "../../../types/Show"
import { groups, outputs, overlays, scriptureSettings, showsCache, styles, templates, variables } from "../../shared/core/stores"
import autosize from "../../components/edit/scripts/autosize"
import { clearAutoSizeCache } from "./logic/autosizeCache"
import { send } from "../../shared/utils/request"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Textbox } from "./Textbox"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, wait: vi.fn(() => Promise.resolve("ended")) }))
vi.mock("../../shared/utils/request", () => ({ send: vi.fn() }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../components/edit/scripts/autosize", () => ({ default: vi.fn(() => 42) }))
vi.mock("../../shared/utils/helpers/showActions", () => ({ createCSSVariables: vi.fn(() => "--variable-test: 1;") }))
vi.mock("../../shared/utils/helpers/output", () => ({
    getActiveOutputs: vi.fn(() => ["out1"]),
    getAllActiveOutputs: vi.fn(() => [{ id: "out1", out: { slide: { id: "sh1", index: 0, layout: "l1" } }, style: "st1", color: "red" }]),
    getFirstActiveOutput: vi.fn(() => ({ id: "out1", out: { slide: { id: "sh1", index: 0, layout: "l1" } } })),
    getOutputLines: vi.fn(() => ({ start: 1, end: 3 })),
    getOutputResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    percentageStylePos: vi.fn((style: string) => style)
}))

function viewMock(name: string) {
    return (props: Record<string, unknown>) => <span data-view={name} data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}

vi.mock("./TextboxLines", () => ({
    TextboxLines: (props: Record<string, unknown>) => (
        <span data-view="TextboxLines" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))}>
            <span className="align">
                <span className="lines">
                    <span className="break">
                        <span>Hola</span>
                    </span>
                </span>
            </span>
        </span>
    )
}))
vi.mock("./SlideItems", () => ({ SlideItems: viewMock("SlideItems") }))

const ref = { type: "show" as const, showId: "sh1", slideId: "s1", id: "s1", layoutId: "l1" }
const makeShow = () => ({
    slides: { s1: { id: "s1", items: [{ id: "i1" }] } },
    settings: { activeLayout: "l1" },
    layouts: { l1: { slides: [{ id: "s1" }] } }
})
const textItem = (extra: Record<string, unknown> = {}) =>
    ({
        id: "i1",
        type: "text",
        textFit: "shrinkToFit",
        lines: [{ align: "", text: [{ value: "Hola", style: "font-size: 60px;" }] }],
        autoFontSize: 10,
        ...extra
    }) as unknown as Item

let restore: () => void = () => {}
beforeEach(() => {
    clearAutoSizeCache()
    vi.mocked(autosize).mockReturnValue(42)
    restore = setStoresForTest([looseEntry(groups, {}), looseEntry(outputs, { out1: { active: true, style: "st1" } }), looseEntry(overlays, {}), looseEntry(scriptureSettings, {}), looseEntry(showsCache, { sh1: makeShow() }), looseEntry(styles, { st1: { lines: 2 } }), looseEntry(templates, {}), looseEntry(variables, {})])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function renderTextbox(item: Item = textItem(), props: Record<string, unknown> = {}) {
    return render(<Textbox item={item} ref={ref} itemIndex={0} {...props} />).container
}

function linesProps(container: HTMLElement) {
    return JSON.parse(container.querySelector("[data-view='TextboxLines']")!.getAttribute("data-props") || "{}")
}

describe("Textbox", () => {
    it("renderiza TextboxLines con el tamaño medido y las props del slide", async () => {
        const container = renderTextbox(textItem(), { preview: true, smallFontSize: true, slideIndex: 3 })
        await waitFor(() => expect(linesProps(container).fontSize).toBe(20))
        expect(linesProps(container)).toMatchObject({ slideIndex: 3, smallFontSize: true, ref, alphaKey: false })
    })

    it("usa el fontSize calculado por autosize cuando no hay smallFontSize", async () => {
        vi.mocked(autosize).mockReturnValue(77)
        const container = renderTextbox(textItem())
        await waitFor(() => expect(linesProps(container).fontSize).toBe(77))
    })

    it("escribe autoFontSize en showsCache y reutiliza la medición en cache", async () => {
        const item = textItem()
        const first = render(<Textbox item={item} ref={ref} itemIndex={0} autoSizeKey="cache" />)
        await waitFor(() => expect(get(showsCache).sh1.slides.s1.items[0].autoFontSize).toBe(42))
        expect(autosize).toHaveBeenCalledTimes(1)
        first.unmount()

        vi.mocked(autosize).mockReturnValue(99)
        const second = render(<Textbox item={item} ref={ref} itemIndex={0} autoSizeKey="cache" />)
        await waitFor(() => expect(linesProps(second.container).fontSize).toBe(42))
        expect(autosize).toHaveBeenCalledTimes(1)
    })

    it("emite autosizeReady con la clave y el tamaño calculado", async () => {
        const onAutosizeReady = vi.fn()
        renderTextbox(textItem(), { autoSizeKey: "k2", onAutosizeReady })
        await waitFor(() => expect(onAutosizeReady).toHaveBeenCalledWith({ key: "k2", fontSize: 42 }))
    })

    it("resuelve la plantilla de la slide y pasa sus styleOverrides a TextboxLines", async () => {
        const overrides = [{ pattern: "Hola" }]
        const show = makeShow() as ReturnType<typeof makeShow> & { slides: { s1: { settings: { template: string } } } }
        show.slides.s1.settings = { template: "tpl1" }
        restore()
        restore = setStoresForTest([looseEntry(groups, {}), looseEntry(outputs, { out1: { active: true } }), looseEntry(overlays, {}), looseEntry(scriptureSettings, {}), looseEntry(showsCache, { sh1: show }), looseEntry(styles, {}), looseEntry(templates, { tpl1: { settings: { styleOverrides: overrides } } }), looseEntry(variables, {})])
        const container = renderTextbox(textItem(), { preview: true })
        await waitFor(() => expect(linesProps(container).styleOverrides).toEqual(overrides))
    })

    it("oculta el contenido hasta que termina el autosize", () => {
        const container = renderTextbox(textItem(), { autoSizeKey: "hide" })
        expect(linesProps(container).hideContent).toBe(true)
        expect((container.querySelector(".item") as HTMLElement).className).toContain("item")
    })

    it("renderiza SlideItems para los items que no son texto", () => {
        const container = renderTextbox({ id: "i2", type: "media", lines: undefined } as unknown as Item)
        expect(container.querySelector("[data-view='SlideItems']")).toBeTruthy()
        expect(container.querySelector("[data-view='TextboxLines']")).toBeNull()
    })

    it("envía ACTION_MAIN al presionar y soltar el botón del item", () => {
        const container = renderTextbox(textItem({ button: { press: "a1", release: "a2" } }), { preview: true })
        const item = container.querySelector(".item") as HTMLElement
        fireEvent.mouseDown(item)
        fireEvent.mouseUp(item)
        expect(send).toHaveBeenCalledWith(OUTPUT, ["ACTION_MAIN"], { id: "a1" })
        expect(send).toHaveBeenCalledWith(OUTPUT, ["ACTION_MAIN"], { id: "a2" })
    })

    it("aplica las clases de alpha key cuando no hay líneas", () => {
        const container = renderTextbox({ id: "i3", type: "text" } as unknown as Item, { alphaKey: true, preview: true })
        const item = container.querySelector(".item") as HTMLElement
        expect(item.className).toContain("white")
        expect(item.className).toContain("key")
    })

    it("deriva customTypeRatio de los segmentos disableTemplate", async () => {
        const item = textItem({
            lines: [
                { align: "", text: [{ value: "1", style: "font-size: 50px;", customType: "disableTemplate" }] },
                { align: "", text: [{ value: "Hola", style: "font-size: 100px;" }] }
            ]
        })
        const container = renderTextbox(item, { preview: true })
        await waitFor(() => expect(linesProps(container).customTypeRatio).toBe(0.5))
    })

    it("pasa las líneas resaltadas de las salidas activas", async () => {
        const container = renderTextbox(textItem(), { preview: true, centerPreview: true, isOutputted: true })
        await waitFor(() => expect(linesProps(container).highlighedLines).toEqual([{ from: 1, to: 3, color: "red", styleLines: 2 }]))
    })
})
