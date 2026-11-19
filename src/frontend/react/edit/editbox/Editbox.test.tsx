// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../../../../types/Show"
import { Editbox } from "./Editbox"

vi.mock("../../../shared/core/stores", () => {
    const makeStore = (value: unknown) => ({
        subscribe: (run: (v: unknown) => void) => {
            run(value)
            return () => {}
        },
        set: vi.fn(),
        update: vi.fn()
    })

    const overrides: Record<string, unknown> = {
        activeEdit: {
            subscribe: (run: (v: unknown) => void) => {
                run({ items: [0], slide: 0, type: "show" })
                return () => {}
            },
            set: vi.fn(),
            update: (fn: (a: { items: number[] }) => { items: number[] }) => fn({ items: [0] })
        },
        activeShow: makeStore({ id: "show1" }),
        openToolsTab: {
            set: vi.fn(),
            subscribe: (run: (v: unknown) => void) => {
                run("")
                return () => {}
            },
            update: vi.fn()
        },
        os: makeStore({ platform: "darwin" }),
        outputs: makeStore({}),
        showsCache: makeStore({ show1: { settings: { activeLayout: "l1" }, layouts: {}, slides: {}, locked: false } }),
        special: makeStore({}),
        dictionary: makeStore({}),
        activePage: makeStore("edit"),
        activePopup: makeStore(null),
        editColumns: makeStore(2),
        resized: makeStore({}),
        styles: makeStore({}),
        media: makeStore({}),
        playerVideos: makeStore({}),
        templates: makeStore({}),
        variables: makeStore({}),
        activeStage: makeStore({ id: "st1", items: [] }),
        overlays: { ...makeStore({}), update: vi.fn() },
        redoHistory: makeStore([]),
        refreshListBoxes: {
            set: vi.fn(),
            subscribe: (run: (v: unknown) => void) => {
                run(-1)
                return () => {}
            },
            update: vi.fn()
        },
        stageShows: { ...makeStore({}), update: vi.fn() },
        playingVideos: makeStore([]),
        currentWindow: makeStore("main"),
        gain: makeStore(1),
        volume: makeStore(1),
        audioChannels: makeStore({}),
        playingAudio: makeStore({}),
        playingMetronome: makeStore(false),
        previewOutputId: makeStore(""),
        cachedShowsData: makeStore({}),
        editMode: { ...makeStore("default"), set: vi.fn() },
        activeDrawerTab: makeStore(""),
        storedEditMenuState: makeStore({})
    }

    return new Proxy(overrides, {
        get(target, prop: string) {
            if (prop in target) return target[prop]
            const store = makeStore(undefined)
            target[prop] = store
            return store
        }
    })
})
vi.mock("../../../shared/utils/cursor", () => ({ startResizing: vi.fn(), stopResizing: vi.fn() }))
vi.mock("../../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../../shared/utils/profile", () => ({ getAccess: () => ({ global: "write" }) }))
vi.mock("../../../app/wiring/shortcuts", () => ({ isComposing: () => false, getNormalizedKey: () => "v", isFormattingKey: () => false }))
vi.mock("../../../shared/utils/common", () => ({ newToast: vi.fn() }))

vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioSender", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ getAnalyser: () => null }))
vi.mock("../../../shared/utils/helpers/clipboard", () => ({ deleteAction: vi.fn() }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/media", () => ({ getExtension: () => "", getFileName: () => "", getMediaType: () => "image" }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getFirstActiveOutput: () => null, getOutputResolution: () => ({ width: 1920, height: 1080 }), percentageStylePos: (s: string) => s }))
vi.mock("../../../shared/utils/helpers/show", () => ({ isSlideLocked: () => false, getLayoutRef: () => [{ id: "s1" }] }))
vi.mock("../../../shared/utils/helpers/showActions", () => ({ createCSSVariables: () => "" }))
vi.mock("../../../shared/utils/helpers/style", () => ({ getItemStyle: () => "", getStyles: () => ({}) }))
vi.mock("../../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v))) }))
vi.mock("../../../shared/utils/helpers/mover", () => ({ addToPos: (a: unknown[]) => a }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ get: () => ({}), slides: () => ({ get: () => [{}], set: vi.fn(), add: vi.fn() }) }) }))
vi.mock("../../../components/edit/scripts/shapeOutside", () => ({ getShapeGuideStyle: () => "", calculateShapeVerticalOffset: () => 0, getShapeFloatSide: () => "left" }))
vi.mock("../../../components/edit/scripts/itemHelpers", () => ({ isConditionMet: () => false }))
vi.mock("../../../components/edit/scripts/textStyle", () => ({ getItemText: () => "", getLineText: () => "", getSelectionRange: () => [], setCaret: vi.fn() }))
vi.mock("../../../components/edit/scripts/chords", () => ({ addChords: vi.fn() }))
vi.mock("../../../components/edit/scripts/autosize", () => ({ default: () => 100 }))
vi.mock("../../../components/edit/editbox/EditboxHelper", () => ({
    EditboxHelper: {
        getStyleHtml: () => ({ html: '<div class="break"><span data-freeshow-text="true"></span></div>', currentStyle: "" }),
        getTextStyle: () => "",
        determineCaretLine: () => -1,
        splitAllCrlf: (x: unknown) => x,
        cutLinesInTwo: () => ({ firstLines: [], secondLines: [] })
    }
}))
vi.mock("../../../components/edit/editbox/EditboxPaste", () => ({ EditboxPaste: { handlePaste: vi.fn(), handleCopy: vi.fn(), handleCut: vi.fn(), paste: vi.fn() } }))
vi.mock("../../../components/media/video/videoPlayer", () => ({}))
vi.mock("../../../features/timeline/logic/TimelinePlayback", () => ({}))
vi.mock("../../../features/slide/SlideItems", () => ({
    SlideItems: ({ edit }: { edit?: boolean }) => <div data-testid="slide-items" data-edit={String(edit ?? false)} />
}))

afterEach(cleanup)

describe("Editbox", () => {
    it("renderiza el contenedor del ítem con la clase item", () => {
        const item: Item = { type: "text", style: "", lines: [{ align: "", text: [{ value: "hola", style: "" }] }] }
        const { container } = render(<Editbox item={item} ref={{ id: "s1" }} index={0} ratio={1} />)
        expect(container.querySelector(".editItem")).toBeTruthy()
    })

    it("incluye slide items para ítems de media", () => {
        const item: Item = { type: "media", style: "", src: "a.png" } as Item
        const { getByTestId } = render(<Editbox item={item} ref={{ id: "s1" }} index={0} ratio={1} />)
        expect(getByTestId("slide-items")).toBeTruthy()
    })
})
