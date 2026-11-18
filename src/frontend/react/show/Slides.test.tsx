// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activeFocus, activePage, activePopup, cachedShowsData, categories, focusMode, groups, lessonsLoaded, notFound, outLocked, outputs, outputSlideCache, showsCache, slidesOptions, special, templates } from "../../stores"
import { hasNewerUpdate } from "../../utils/common"
import { getActiveOutputs } from "../../components/helpers/output"
import { getCachedShow } from "../../components/helpers/show"
import { _show } from "../../components/helpers/shows"
import { clearIslands } from "../test/islandMock"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { Slides } from "./Slides"

vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/common", () => ({ hasNewerUpdate: vi.fn(async () => false), wait: vi.fn(async () => {}) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../components/helpers/fonts", () => ({ loadCustomFonts: vi.fn() }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/media", () => ({ encodeFilePath: vi.fn((path: string) => path), getExtension: vi.fn(() => "") }))
vi.mock("../../components/helpers/output", () => ({ getActiveOutputs: vi.fn(() => []), refreshOut: vi.fn(), setOutput: vi.fn() }))
vi.mock("../../components/helpers/show", () => ({ getCachedShow: vi.fn(() => null) }))
vi.mock("../../components/helpers/showActions", () => ({ checkActionTrigger: vi.fn(), getFewestOutputLines: vi.fn(() => 0), getFewestOutputLinesReveal: vi.fn(() => 0), getItemWithMostLines: vi.fn(() => null), updateOut: vi.fn() }))
vi.mock("../../components/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../slide/SkeletonSlide", () => ({ SkeletonSlide: () => <div data-testid="skeleton" /> }))
vi.mock("../slide/Slide", () => ({ Slide: ({ index }: { index: number }) => <div data-testid="slide" data-index={index} /> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../system/DropArea", () => ({ DropArea: ({ children }: { children?: ReactNode | ((over: boolean) => ReactNode) }) => <div data-testid="drop">{typeof children === "function" ? children(false) : children}</div> }))
vi.mock("../system/Autoscroll", () => ({ Autoscroll: ({ children }: { children?: ReactNode }) => <div data-testid="autoscroll">{children}</div> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("./ShowHeader", () => ({ ShowHeader: () => <div data-testid="show-header" /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    clearIslands()
    vi.clearAllMocks()
})

function setStores(cache: unknown = null, loaded = true) {
    restore = setStoresForTest([
        looseEntry(activeEdit, {}),
        looseEntry(activeFocus, { id: "" }),
        looseEntry(activePage, "show"),
        looseEntry(activePopup, null),
        looseEntry(cachedShowsData, {}),
        looseEntry(categories, {}),
        looseEntry(focusMode, false),
        looseEntry(groups, {}),
        looseEntry(lessonsLoaded, loaded),
        looseEntry(notFound, { show: ["s1"] }),
        looseEntry(outLocked, false),
        looseEntry(outputs, {}),
        looseEntry(outputSlideCache, {}),
        looseEntry(showsCache, cache === null ? {} : { s1: cache }),
        looseEntry(slidesOptions, { columns: 2 }),
        looseEntry(special, {}),
        looseEntry(templates, {})
    ])
    vi.mocked(getActiveOutputs).mockReturnValue([])
    vi.mocked(hasNewerUpdate).mockResolvedValue(false)
    vi.mocked(getCachedShow).mockReturnValue(null)
    vi.mocked(_show).mockImplementation(
        () =>
            ({
                layouts: () => ({ ref: () => [] }),
                get: () => ({})
            }) as never
    )
}

describe("Slides", () => {
    it("muestra el error cuando no existe el show", async () => {
        setStores(null)
        render(<Slides showId="s1" />)
        await screen.findByText("error.no_show")
        expect(screen.getByTestId("center")).toBeTruthy()
    })

    it("muestra el header del show cuando está cargado", async () => {
        setStores({ id: "s1", layouts: {}, slides: {}, settings: { activeLayout: "l1" } })
        render(<Slides showId="s1" />)
        await screen.findByTestId("show-header")
        expect(screen.getByTestId("autoscroll")).toBeTruthy()
    })
})
