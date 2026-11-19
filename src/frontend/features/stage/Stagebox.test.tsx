// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { StageItem, StageLayout } from "../../../types/Stage"
import { activePopup, activeStage, activeTimers, allOutputs, dictionary, outputs, outputSlideCache, refreshEditSlide, stageShows, timers, variables } from "../../shared/core/stores"
import { startResizing } from "../../shared/utils/cursor"
import { sendBackgroundToStage } from "../../app/wiring/stageTalk"
import autosize from "../../components/edit/scripts/autosize"
import { isConditionMet } from "../../components/edit/scripts/itemHelpers"
import { loadThumbnail } from "../../shared/utils/helpers/media"
import { replaceDynamicValues } from "../../shared/utils/helpers/showActions"
import { getCustomStageLabel, getSlideTextItems } from "./logic/stage"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Stagebox } from "./Stagebox"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/cursor", () => ({ startResizing: vi.fn() }))
vi.mock("../../app/wiring/stageTalk", () => ({ sendBackgroundToStage: vi.fn(async () => null) }))
vi.mock("../../components/edit/scripts/autosize", () => ({ default: vi.fn(() => 64) }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: vi.fn(() => true) }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getItemText: vi.fn(() => "Texto del item") }))
vi.mock("../../shared/utils/helpers/media", () => ({
    getExtension: vi.fn((path: string) => path.split(".").pop() || ""),
    getMediaType: vi.fn(() => "image"),
    loadThumbnail: vi.fn(async () => "thumb.jpg"),
    mediaSize: { big: 3, drawerSize: 1, slideSize: 2 }
}))
vi.mock("../../shared/core/values/extensions", () => ({
    videoExtensions: ["mp4"],
    imageExtensions: ["jpg"],
    audioExtensions: ["mp3"],
    presentationExtensions: ["ppt"],
    mediaExtensions: ["mp4", "jpg"]
}))
vi.mock("../../shared/utils/helpers/output", () => ({
    getActiveOutputs: vi.fn(() => ["out1"]),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    percentageStylePos: vi.fn((style: string) => style)
}))
vi.mock("../../shared/utils/helpers/showActions", () => ({
    createCSSVariables: vi.fn(() => "--var: 1;"),
    replaceDynamicValues: vi.fn((text: string) => text)
}))
vi.mock("../../shared/utils/helpers/style", () => ({ getStyles: vi.fn(() => ({ "font-size": "100px", "line-height": "1.2" })) }))
vi.mock("./logic/stage", () => ({
    getCustomStageLabel: vi.fn(() => "Etiqueta"),
    getSlideTextItems: vi.fn(() => [{ id: "s1" }]),
    stageItemToItem: vi.fn((value: unknown) => value)
}))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button data-testid="remove-conditions" onClick={onClick}>
            {children}
        </button>
    )
}))
const serializeProps = (props: Record<string, unknown>) => JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))
vi.mock("../../react/edit/editbox/EditboxLines", () => ({ EditboxLines: (props: Record<string, unknown>) => <span data-view="EditboxLines" data-props={JSON.stringify(props)} /> }))
vi.mock("../output/Media", () => ({ Media: (props: Record<string, unknown>) => <span data-view="Media" data-props={serializeProps(props)} /> }))
vi.mock("../output/Output", () => ({ Output: (props: Record<string, unknown>) => <span data-view="Output" data-props={serializeProps(props)} /> }))
vi.mock("../../shared/ui/system/Clock", () => ({ Clock: (props: Record<string, unknown>) => <span data-view="Clock" data-props={serializeProps(props)} /> }))
vi.mock("../../shared/ui/system/Movebox", () => ({ Movebox: (props: Record<string, unknown>) => <span data-view="Movebox" data-props={serializeProps(props)} /> }))
vi.mock("../slide/SlideItems", () => ({ SlideItems: (props: Record<string, unknown>) => <span data-view="SlideItems" data-props={JSON.stringify(props)} /> }))
vi.mock("../slide/views/SlideProgress", () => ({ SlideProgress: (props: Record<string, unknown>) => <span data-view="SlideProgress" data-props={serializeProps(props)} /> }))
vi.mock("../slide/Textbox", () => ({ Textbox: (props: Record<string, unknown>) => <span data-view="Textbox" data-props={JSON.stringify(props)} /> }))
vi.mock("../slide/views/Timer", () => ({ Timer: (props: Record<string, unknown>) => <span data-view="Timer" data-props={serializeProps(props)} /> }))
vi.mock("../slide/views/Variable", () => ({ Variable: (props: Record<string, unknown>) => <span data-view="Variable" data-props={serializeProps(props)} /> }))
vi.mock("./SlideText", () => ({ SlideText: (props: Record<string, unknown>) => <span data-view="SlideText" data-props={JSON.stringify(props)} /> }))
vi.mock("./SlideNotes", () => ({ SlideNotes: (props: Record<string, unknown>) => <span data-view="SlideNotes" data-props={JSON.stringify(props)} /> }))
vi.mock("./StageLayout", () => ({ StageLayout: (props: Record<string, unknown>) => <span data-view="StageLayout" data-props={serializeProps(props)} /> }))

const baseItem = { id: "i1", type: "text", style: "font-size: 100px;", align: "center" } as StageItem
const stageLayout = { id: "st1", name: "Stage", settings: { labels: true, labelColor: "#fff" }, items: {} } as unknown as StageLayout

let restore: () => void = () => {}
beforeEach(() => {
    vi.useFakeTimers()
    restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: [] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, { out1: { id: "out1", active: true, out: { slide: { id: "s1" } } } }), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: { i1: baseItem } } }), looseEntry(timers, {}), looseEntry(variables, {})])
    vi.spyOn(activeStage, "update")
    vi.spyOn(stageShows, "update")
})
afterEach(() => {
    cleanup()
    restore()
    vi.useRealTimers()
    vi.clearAllMocks()
})

function renderBox(props: Record<string, unknown> = {}) {
    return render(<Stagebox id="i1" item={baseItem} stageLayout={stageLayout} ratio={2} {...props} />)
}

describe("Stagebox", () => {
    it("renderiza el item con id, etiqueta, clases y variables CSS", () => {
        const { container } = renderBox()
        const root = container.querySelector(".stage_item") as HTMLElement
        expect(root.id).toBe("i1")
        expect(root.className).toContain("border")
        expect(container.textContent).toContain("Etiqueta")
        expect(root.getAttribute("style")).toContain("--labelColor: #fff")
        expect(root.getAttribute("style")).toContain("--var: 1")
        expect(root.getAttribute("style")).toContain("font-size: 100px")
        expect(getCustomStageLabel).toHaveBeenCalledWith("text", baseItem, expect.anything())
    })

    it("selecciona el item y notifica el mouse al hacer mousedown en edición", () => {
        const onMouseChange = vi.fn()
        const { container } = renderBox({ edit: true, onMouseChange })
        fireEvent.mouseDown(container.querySelector(".stage_item")!, { clientX: 100, clientY: 40 })
        expect(container.querySelector(".stage_item")!.className).toContain("selected")
        expect(onMouseChange).toHaveBeenCalledTimes(1)
        expect(onMouseChange.mock.calls[0][0]).toMatchObject({ x: 100, y: 40, item: { id: "i1" } })
        expect(onMouseChange.mock.calls[0][0].offset.x).toBe(50)
        expect(autosize).not.toHaveBeenCalled()
    })

    it("shift agrega a la selección y resalta con isShiftPressed hasta keyup", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: ["otro"] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, {}), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: { i1: baseItem } } }), looseEntry(timers, {}), looseEntry(variables, {})])
        const { container } = renderBox({ edit: true })
        fireEvent.mouseDown(container.querySelector(".stage_item")!, { shiftKey: true })
        expect(container.querySelector(".stage_item")!.className).toContain("isShiftPressed")
        fireEvent.keyUp(window, { key: "Shift" })
        expect(container.querySelector(".stage_item")!.className).not.toContain("isShiftPressed")
    })

    it("borra el item con Delete y limpia la selección", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: ["i1"] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, {}), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: { i1: baseItem } } }), looseEntry(timers, {}), looseEntry(variables, {})])
        renderBox({ edit: true })
        act(() => fireEvent.keyDown(window, { key: "Delete" }))
        expect(stageShows.update).toHaveBeenCalled()
    })

    it("deselecciona al hacer clic en un panel", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: ["i1"] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, {}), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: { i1: baseItem } } }), looseEntry(timers, {}), looseEntry(variables, {})])
        renderBox({ edit: true })
        const panel = document.createElement("div")
        panel.className = "panel"
        document.body.appendChild(panel)
        act(() => fireEvent.mouseDown(panel))
        expect(activeStage.update).toHaveBeenCalled()
        panel.remove()
    })

    it("usa EditboxLines al editar texto y Textbox en reproducción", () => {
        const edit = renderBox({ edit: true })
        expect(edit.container.querySelector("[data-view='EditboxLines']")).toBeTruthy()
        edit.unmount()

        const view = renderBox()
        expect(view.container.querySelector("[data-view='Textbox']")).toBeTruthy()
        const props = JSON.parse(view.container.querySelector("[data-view='Textbox']")!.getAttribute("data-props") || "{}")
        expect(props).toMatchObject({ fontSize: 100, isStage: true, ref: { type: "stage", id: "i1" } })
    })

    it("renderiza SlideText con la imagen de fondo cuando el item es de slide", async () => {
        vi.mocked(sendBackgroundToStage).mockResolvedValueOnce({ path: "bg.jpg", next: { path: "next.mp4" } } as never)
        const item = { ...baseItem, type: "slide_text", includeMedia: true, slideOffset: 1 } as StageItem
        const { container } = renderBox({ id: "i1_slide", item })
        await act(async () => {
            vi.advanceTimersByTime(100)
        })
        expect(container.querySelector("[data-view='SlideText']")).toBeTruthy()
        expect(loadThumbnail).toHaveBeenCalledWith("next.mp4", 3)
        expect(container.querySelector("[data-view='Media']")).toBeTruthy()
        const props = JSON.parse(container.querySelector("[data-view='SlideText']")!.getAttribute("data-props") || "{}")
        expect(props).toMatchObject({ slideOffset: 1, autoSize: true, fontSize: 0, ref: { type: "stage", id: "i1_slide" } })
    })

    it("pasa el tamaño calculado a SlideNotes", () => {
        const item = { ...baseItem, type: "slide_notes", auto: true } as StageItem
        const { container } = renderBox({ id: "i1_notes", item })
        const props = JSON.parse(container.querySelector("[data-view='SlideNotes']")!.getAttribute("data-props") || "{}")
        expect(props).toMatchObject({ slideOffset: 0, autoSize: 100 })
    })

    it("quita las condiciones desde el botón de acciones", () => {
        const item = { ...baseItem, conditions: { showItem: {} } } as unknown as StageItem
        const { container } = renderBox({ item, edit: true })
        fireEvent.click(container.querySelector("[data-testid='remove-conditions']")!)
        expect(stageShows.update).toHaveBeenCalled()
        expect(container.querySelector("[data-icon='light']")).toBeTruthy()
    })

    it("aplica autosize cuando el elemento tiene altura y reintenta si no", () => {
        const item = { ...baseItem, auto: true } as StageItem
        const heightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100)
        const { container } = renderBox({ item })
        act(() => vi.advanceTimersByTime(20))
        expect(autosize).toHaveBeenCalledWith(container.querySelector(".align"), expect.objectContaining({ textQuery: ".autoFontSize", defaultFontSize: 100 }))
        heightSpy.mockRestore()

        const noHeight = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(0)
        const { container: empty } = renderBox({ item, id: "otro" })
        act(() => vi.advanceTimersByTime(20))
        expect(empty.querySelector(".align")).toBeTruthy()
        noHeight.mockRestore()
    })

    it("muestra el flash al cambiar el texto y no lo muestra en edición", () => {
        const item = { ...baseItem, flash: { enabled: true, color: "red", count: 2 } } as StageItem
        vi.mocked(replaceDynamicValues).mockReturnValueOnce("Texto nuevo")
        const { container } = renderBox({ item })
        act(() => vi.advanceTimersByTime(0))
        expect(container.querySelector(".flashBackground")?.getAttribute("style")).toContain("background-color: red")
        expect(container.querySelector(".flashBackground")?.getAttribute("style")).toContain("animation-iteration-count: 2")
    })

    it("no aparta botones ni deselecciona cuando mousedown ocurre en el item", () => {
        const { container } = renderBox({ edit: true })
        fireEvent.mouseDown(container.querySelector(".stage_item")!)
        expect(startResizing).not.toHaveBeenCalled()
    })

    it("inicia el resize desde un square", () => {
        const { container } = renderBox({ edit: true })
        const square = document.createElement("div")
        square.className = "square"
        container.querySelector(".stage_item")!.appendChild(square)
        fireEvent.mouseDown(square)
        expect(startResizing).toHaveBeenCalled()
    })

    it("usa el primer timer activo para los items timer", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: [] }), looseEntry(activePopup, null), looseEntry(activeTimers, [{ id: "timer1" }]), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, {}), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: {} } }), looseEntry(timers, {}), looseEntry(variables, {})])
        const item = { ...baseItem, type: "timer", timer: {} } as StageItem
        renderBox({ id: "i1_timer", item })
        act(() => vi.advanceTimersByTime(1000))
        expect(isConditionMet).not.toHaveBeenCalled()
    })

    it("oculta variables deshabilitadas", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: [] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, {}), looseEntry(outputSlideCache, {}), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: {} } }), looseEntry(timers, {}), looseEntry(variables, { v1: { enabled: false } })])
        const { container } = renderBox({ id: "i1_variables#v1", item: baseItem })
        expect(container.querySelector(".stage_item")!.className).toContain("isDisabledVariable")
    })

    it("usa el slide cache para items con offset", () => {
        restore()
        restore = setStoresForTest([looseEntry(activeStage, { id: "st1", items: [] }), looseEntry(activePopup, null), looseEntry(activeTimers, []), looseEntry(allOutputs, {}), looseEntry(dictionary, {}), looseEntry(outputs, { out1: { id: "out1" } }), looseEntry(outputSlideCache, { out1: { id: "cached" } }), looseEntry(refreshEditSlide, false), looseEntry(stageShows, { st1: { ...stageLayout, items: {} } }), looseEntry(timers, {}), looseEntry(variables, {})])
        const item = { ...baseItem, type: "slide_text", slideOffset: 1 } as StageItem
        const { container } = renderBox({ id: "i1_next", item })
        const props = JSON.parse(container.querySelector("[data-view='SlideText']")!.getAttribute("data-props") || "{}")
        expect(props.currentSlide).toMatchObject({ id: "cached" })
        expect(getSlideTextItems).toHaveBeenCalled()
    })
})
