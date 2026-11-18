// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeProject, activeShow, outLocked, outputs, projects, shows, showsCache, special, styles as stylesStore } from "../../stores"
import { getAccess } from "../../utils/profile"
import { getMedia } from "../../components/helpers/media"
import { findMatchingOut, getActiveOutputs } from "../../components/helpers/output"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowButton } from "./ShowButton"

vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: { getPlaying: vi.fn(() => null) } }))
vi.mock("../../components/helpers/media", () => ({
    encodeFilePath: vi.fn((path: string) => path),
    getExtension: vi.fn(() => ""),
    getFileName: vi.fn(() => ""),
    getMedia: vi.fn(async () => null),
    getMediaLayerType: vi.fn(() => null),
    getMediaStyle: vi.fn(() => ({})),
    getMediaType: vi.fn(() => "image"),
    getVideoDuration: vi.fn(() => 0),
    mediaSize: vi.fn(() => ""),
    removeExtension: vi.fn((name: string) => name)
}))
vi.mock("../../components/helpers/output", () => ({ findMatchingOut: vi.fn(() => null), getActiveOutputs: vi.fn(() => []), setOutput: vi.fn() }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn(), historyAwait: vi.fn() }))
vi.mock("../../components/helpers/setShow", () => ({ loadShows: vi.fn() }))
vi.mock("../../components/helpers/show", () => ({ checkName: vi.fn((name: string) => name), getLayoutRef: vi.fn(() => []) }))
vi.mock("../../components/helpers/showActions", () => ({ playPdf: vi.fn(), swichProjectItem: vi.fn(), updateOut: vi.fn() }))
vi.mock("../../components/helpers/time", () => ({ joinTime: vi.fn((value: string) => value), secondsToTime: vi.fn((value: number) => String(value)) }))
vi.mock("../../components/output/clear", () => ({ clearSlide: vi.fn() }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, className, style }: { children?: ReactNode; className?: string; style?: unknown }) => (
        <button type="button" className={className} style={style as never}>
            {children}
        </button>
    )
}))
vi.mock("../ui/hidden-input/HiddenInput", () => ({ HiddenInput: ({ value }: { value: string }) => <span data-name={value} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeProject, null), looseEntry(activeShow, null), looseEntry(outLocked, false), looseEntry(outputs, {}), looseEntry(projects, {}), looseEntry(shows, { s1: { name: "Intro" } }), looseEntry(showsCache, {}), looseEntry(special, {}), looseEntry(stylesStore, {})])
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.mocked(getMedia).mockResolvedValue(null)
    vi.mocked(findMatchingOut).mockReturnValue(null)
    vi.mocked(getActiveOutputs).mockReturnValue([])
}

describe("ShowButton", () => {
    it("muestra el nombre del show", () => {
        setStores()
        const { container } = render(<ShowButton id="s1" show={{ id: "s1", name: "Intro" }} />)
        expect(container.querySelector("[data-name='Intro']")).toBeTruthy()
        expect(container.querySelector("#show_s1")).toBeTruthy()
    })

    it("marca el botón como de solo lectura según el perfil", () => {
        setStores()
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = render(<ShowButton id="s1" show={{ id: "s1", name: "Intro", category: "cat" }} />)
        expect(container.querySelector("._readonly")).toBeTruthy()
    })
})
