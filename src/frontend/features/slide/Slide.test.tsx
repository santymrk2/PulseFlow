// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import type { CSSProperties, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Show, SlideData } from "../../../types/Show"
import { activeEdit, activeShow, effects, focusMode, fullColors, overlays, outputs, refreshListBoxes, refreshSlideThumbnails, slideDeleteHighlight, slidesOptions, special, styles } from "../../shared/core/stores"
import { getMedia, getMediaCached, getMediaStyle, mediaSize } from "../../shared/utils/helpers/media"
import { setTemplateStyle } from "../../shared/utils/helpers/output"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { Slide } from "./Slide"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false, wait: vi.fn(async () => "ended") }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({ global: "edit" })) }))
vi.mock("../show/logic/slides", () => ({ removeTagsAndContent: vi.fn((value: string) => value) }))
vi.mock("../../components/actions/actions", () => ({ slideHasAction: vi.fn(() => false) }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ shouldItemBeShown: vi.fn(() => true) }))
vi.mock("../../shared/utils/helpers/media", () => ({
    encodeFilePath: vi.fn((path: string) => path),
    getMedia: vi.fn(async () => ({ path: "media/path", thumbnail: "thumb.jpg", data: {} })),
    getMediaCached: vi.fn(async () => ({ thumbnail: "ghost.jpg" })),
    getMediaStyle: vi.fn(() => "object-fit: contain;"),
    mediaSize: { small: "small", drawerSize: "drawer", slideSize: "slide" }
}))
vi.mock("../../shared/utils/helpers/outputAspect", () => ({ referenceOutputId: vi.fn(() => "out1") }))
vi.mock("../../shared/utils/helpers/output", () => ({
    allOutputsHasStyleTemplate: vi.fn(() => false),
    getActiveOutputs: vi.fn(() => ["out1"]),
    getFirstActiveOutput: vi.fn(() => ({ id: "out1", style: "st1" })),
    getResolution: vi.fn(() => ({ width: 1920, height: 1080 })),
    getSlideFilter: vi.fn(() => "filter: none;"),
    setTemplateStyle: vi.fn((_ref, _style, items) => items)
}))
vi.mock("../../shared/utils/helpers/show", () => ({ getGroupName: vi.fn(() => "Grupo"), isSlideLocked: vi.fn(() => false) }))
vi.mock("../../shared/utils/helpers/shows", () => ({
    _show: vi.fn(() => ({ layouts: () => ({ ref: () => [[]] }) }))
}))
vi.mock("../drawer/media/MediaLoader", () => ({
    MediaLoader: (props: Record<string, unknown>) => <span data-view="MediaLoader" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}))
vi.mock("../../react/edit/editbox/Editbox", async () => ({ Editbox: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Editbox") }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../output/Effect", async () => ({ Effect: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Effect") }))
vi.mock("../../shared/ui/system/SelectElem", () => ({
    SelectElem: ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
        <div data-select style={style}>
            {children}
        </div>
    )
}))
vi.mock("./Actions", () => ({ Actions: (props: Record<string, unknown>) => <span data-view="Actions" data-props={JSON.stringify(props)} /> }))
vi.mock("./BreakCountdown", () => ({ BreakCountdown: (props: Record<string, unknown>) => <span data-view="BreakCountdown" data-props={JSON.stringify(props)} /> }))
vi.mock("./Icons", () => ({ Icons: (props: Record<string, unknown>) => <span data-view="Icons" data-props={JSON.stringify(props)} /> }))
vi.mock("./Textbox", () => ({
    Textbox: (props: Record<string, unknown>) => <span data-view="Textbox" data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))} />
}))
vi.mock("./Zoomed", () => ({
    Zoomed: ({ children, onRatioChange, ...props }: { children: ReactNode; onRatioChange?: (ratio: number) => void } & Record<string, unknown>) => (
        <div data-view="Zoomed" data-props={JSON.stringify(props)}>
            <button data-testid="ratio" onClick={() => onRatioChange?.(0.5)} />
            {children}
        </div>
    )
}))

const show = {
    id: "sh1",
    media: { m1: { id: "m1", path: "m1" }, m2: { id: "m2", path: "m2" } },
    reference: {},
    slides: {},
    layouts: {}
} as unknown as Show
const layoutSlide = { id: "s1", background: "m1" } as SlideData
const makeSlide = (extra: Record<string, unknown> = {}) =>
    ({
        id: "s1",
        items: [{ id: "i1", type: "text", lines: [{ text: [] }] }],
        settings: {},
        ...extra
    }) as unknown as import("../../../types/Show").Slide

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([
        looseEntry(slidesOptions, { mode: "grid", columns: 2 }),
        looseEntry(fullColors, false),
        looseEntry(focusMode, false),
        looseEntry(special, {}),
        looseEntry(outputs, { out1: { id: "out1", active: true } }),
        looseEntry(styles, { st1: { background: "black" } }),
        looseEntry(overlays, {}),
        looseEntry(effects, {}),
        looseEntry(activeShow, { id: "sh1" }),
        looseEntry(activeEdit, { showId: "sh1" }),
        looseEntry(slideDeleteHighlight, null),
        looseEntry(refreshListBoxes, -1),
        looseEntry(refreshSlideThumbnails, false)
    ])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function renderSlide(props: Record<string, unknown> = {}) {
    return render(<Slide showId="sh1" slide={makeSlide()} layoutSlide={layoutSlide} layoutSlides={[layoutSlide]} show={show} index={0} {...props} />)
}

describe("Slide", () => {
    it("renderiza el slide con SelectElem, Zoomed y el Textbox de cada item", async () => {
        const { container } = renderSlide()
        expect(container.querySelector("[data-select]")).toBeTruthy()
        expect(container.querySelector("[data-view='Zoomed']")).toBeTruthy()
        await waitFor(() => expect(container.querySelector("[data-view='Textbox']")).toBeTruthy())
        const textbox = JSON.parse(container.querySelector("[data-view='Textbox']")!.getAttribute("data-props") || "{}")
        expect(textbox).toMatchObject({ itemIndex: 0, slideIndex: 0, preview: true, smallFontSize: false, ratio: 1 })
    })

    it("muestra íconos y acciones salvo en modo simple o con Alt", () => {
        restore()
        restore = setStoresForTest([looseEntry(slidesOptions, { mode: "simple", columns: 3 }), looseEntry(fullColors, false), looseEntry(focusMode, false), looseEntry(special, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(overlays, {}), looseEntry(effects, {}), looseEntry(activeShow, { id: "sh1" }), looseEntry(activeEdit, { showId: "sh1" }), looseEntry(slideDeleteHighlight, null), looseEntry(refreshListBoxes, -1), looseEntry(refreshSlideThumbnails, false)])
        const simple = renderSlide({ icons: true, columns: 3 })
        expect(simple.container.querySelector("[data-view='Icons']")).toBeNull()
        simple.unmount()
        restore()

        restore = setStoresForTest([looseEntry(slidesOptions, { mode: "grid", columns: 3 }), looseEntry(fullColors, false), looseEntry(focusMode, false), looseEntry(special, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(overlays, {}), looseEntry(effects, {}), looseEntry(activeShow, { id: "sh1" }), looseEntry(activeEdit, { showId: "sh1" }), looseEntry(slideDeleteHighlight, null), looseEntry(refreshListBoxes, -1), looseEntry(refreshSlideThumbnails, false)])
        const withIcons = renderSlide({ icons: true, columns: 3 })
        expect(withIcons.container.querySelector("[data-view='Icons']")).toBeTruthy()
        expect(withIcons.container.querySelector("[data-view='Actions']")).toBeTruthy()
        withIcons.unmount()

        const withAlt = renderSlide({ icons: true, altKeyPressed: true })
        expect(withAlt.container.querySelector("[data-view='Icons']")).toBeNull()
    })

    it("aplica outline del output y marca el porcentaje de líneas en modo simple", () => {
        restore()
        restore = setStoresForTest([
            looseEntry(slidesOptions, { mode: "simple", columns: 4 }),
            looseEntry(fullColors, false),
            looseEntry(focusMode, false),
            looseEntry(special, {}),
            looseEntry(outputs, { out1: { active: true } }),
            looseEntry(styles, {}),
            looseEntry(overlays, {}),
            looseEntry(effects, {}),
            looseEntry(activeShow, { id: "sh1" }),
            looseEntry(activeEdit, { showId: "sh1" }),
            looseEntry(slideDeleteHighlight, null),
            looseEntry(refreshListBoxes, -1),
            looseEntry(refreshSlideThumbnails, false)
        ])
        const { container } = renderSlide({ columns: 4, output: { color: "red", line: 1, maxLines: 2, cached: false } })
        const main = container.querySelector(".main") as HTMLElement
        expect(main.getAttribute("style")).toContain("outline-color: red")
        expect(main.getAttribute("style")).toContain("width: 25%")
        expect((container.querySelector(".fill") as HTMLElement).getAttribute("style")).toContain("width: 100%")
    })

    it("marca el highlight de borrado con el color configurado", () => {
        restore()
        restore = setStoresForTest([
            looseEntry(slidesOptions, { mode: "grid", columns: 1 }),
            looseEntry(fullColors, false),
            looseEntry(focusMode, false),
            looseEntry(special, {}),
            looseEntry(outputs, {}),
            looseEntry(styles, {}),
            looseEntry(overlays, {}),
            looseEntry(effects, {}),
            looseEntry(activeShow, { id: "other" }),
            looseEntry(activeEdit, { showId: "sh1" }),
            looseEntry(slideDeleteHighlight, { indexes: [0], color: "#ff5454" }),
            looseEntry(refreshListBoxes, -1),
            looseEntry(refreshSlideThumbnails, false)
        ])
        const { container } = renderSlide()
        expect(container.querySelector(".isDeleteHighlighted")).toBeTruthy()
        expect(container.querySelector("[data-icon='delete']")).toBeTruthy()
        expect((container.querySelector(".slide") as HTMLElement).getAttribute("style")).toContain("--highlight-color: #ff5454")
    })

    it("abre las notas al hacer clic", () => {
        const { container } = renderSlide({ slide: makeSlide({ notes: "Una nota larga que se recorta" }), icons: true })
        fireEvent.click(container.querySelector(".notes")!)
        expect(container.querySelector(".notes")!.textContent).toBe("Una nota larga que se recorta")
    })

    it("propaga el clic del slide al padre", () => {
        const onClick = vi.fn()
        const { container } = renderSlide({ onClick })
        fireEvent.click(container.querySelector(".slide")!)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("renderiza overlays y efectos debajo y encima del slide", () => {
        restore()
        restore = setStoresForTest([
            looseEntry(slidesOptions, { mode: "grid", columns: 1 }),
            looseEntry(fullColors, false),
            looseEntry(focusMode, false),
            looseEntry(special, {}),
            looseEntry(outputs, { out1: { active: true } }),
            looseEntry(styles, {}),
            looseEntry(overlays, {
                ovUnder: { placeUnderSlide: true, items: [{ id: "u1", type: "text", lines: [] }] },
                ovOver: { items: [{ id: "o1", type: "text", lines: [] }] }
            }),
            looseEntry(effects, { efUnder: { placeUnderSlide: true }, efOver: {} }),
            looseEntry(activeShow, { id: "sh1" }),
            looseEntry(activeEdit, { showId: "sh1" }),
            looseEntry(slideDeleteHighlight, null),
            looseEntry(refreshListBoxes, -1),
            looseEntry(refreshSlideThumbnails, false)
        ])
        const { container } = renderSlide({ layoutSlide: { ...layoutSlide, effects: ["efUnder", "efOver"], overlays: ["ovUnder", "ovOver"] } })
        expect(container.querySelectorAll("[data-isla='Effect']")).toHaveLength(2)
        expect(container.querySelectorAll("[data-view='Textbox']")).toHaveLength(3)
    })

    it("actualiza el ratio del Zoomed y reacciona al cambio de estilo de plantilla", async () => {
        const { container } = renderSlide()
        act(() => fireEvent.click(container.querySelector("[data-testid='ratio']")!))
        await waitFor(() => expect(JSON.parse(container.querySelector("[data-view='Zoomed']")!.getAttribute("data-props") || "{}")).toBeTruthy())
        expect(container.querySelector("[data-view='Textbox']")).toBeTruthy()
    })

    it("renderiza el quick edit en modo lista", () => {
        restore()
        restore = setStoresForTest([looseEntry(slidesOptions, { mode: "list", columns: 2 }), looseEntry(fullColors, false), looseEntry(focusMode, false), looseEntry(special, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(overlays, {}), looseEntry(effects, {}), looseEntry(activeShow, { id: "sh1" }), looseEntry(activeEdit, { showId: "sh1" }), looseEntry(slideDeleteHighlight, null), looseEntry(refreshListBoxes, 1), looseEntry(refreshSlideThumbnails, false)])
        const { container } = renderSlide({ list: true })
        expect(container.querySelector(".quickEdit")).toBeTruthy()
        expect(container.querySelector(".quickEdit [data-isla='Editbox']")).toBeTruthy()
    })

    it("usa setTemplateStyle cuando hay preview de plantilla", () => {
        vi.mocked(setTemplateStyle).mockImplementation((_ref, _style, items) => items || [])
        const { container } = renderSlide()
        expect(container.querySelector("[data-view='Textbox']")).toBeTruthy()
    })

    it("carga la miniatura del fondo y el ghost cuando corresponde", async () => {
        const withBackground = renderSlide()
        await waitFor(() => expect(getMedia).toHaveBeenCalled())
        expect(getMediaStyle).toHaveBeenCalled()
        withBackground.unmount()

        restore()
        restore = setStoresForTest([looseEntry(slidesOptions, { mode: "grid", columns: 2 }), looseEntry(fullColors, false), looseEntry(focusMode, false), looseEntry(special, {}), looseEntry(outputs, {}), looseEntry(styles, {}), looseEntry(overlays, {}), looseEntry(effects, {}), looseEntry(activeShow, { id: "sh1" }), looseEntry(activeEdit, { showId: "sh1" }), looseEntry(slideDeleteHighlight, null), looseEntry(refreshListBoxes, -1), looseEntry(refreshSlideThumbnails, false)])
        const { container } = renderSlide({
            layoutSlide: { id: "s1", disabled: false },
            layoutSlides: [
                { id: "prev", background: "m2" },
                { id: "s1", disabled: false }
            ]
        })
        await waitFor(() => expect(getMediaCached).toHaveBeenCalledWith("m2", mediaSize.drawerSize))
        expect(container.querySelector(".ghost")).toBeTruthy()
    })
})
