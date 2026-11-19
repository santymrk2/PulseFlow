// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { requestMain } from "../../../shared/core/ipc/main"
import { activeShow, media, outLocked, outputs, overlays, playingAudio, showsCache, styles as stylesStore, previewOutputId } from "../../../shared/core/stores"
import { getAccess } from "../../../shared/utils/profile"
import { getActiveOutputs, getCurrentStyle, getResolution } from "../../../shared/utils/helpers/output"
import { _show } from "../../../shared/utils/helpers/shows"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { Media } from "./Media"

vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(async () => ({})) }))
vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../../audio/audioMicrophone", () => ({ AudioMicrophone: { start: vi.fn() } }))
vi.mock("../../../audio/audioPlayer", () => ({ AudioPlayer: { start: vi.fn(), getPlaying: vi.fn(() => null) } }))
vi.mock("../../../components/actions/actionData", () => ({ actionData: {} }))
vi.mock("../../../components/actions/actions", () => ({ getActionName: vi.fn(() => ""), getActionTriggerId: vi.fn(() => ""), runAction: vi.fn() }))
vi.mock("../../../shared/utils/helpers/array", () => ({ clone: vi.fn((value: unknown) => value), sortByName: vi.fn((value: unknown) => value) }))
vi.mock("../../../shared/utils/helpers/media", () => ({
    encodeFilePath: vi.fn((path: string) => path),
    getExtension: vi.fn(() => ""),
    getMedia: vi.fn(async () => null),
    getMediaStyle: vi.fn(() => ({})),
    getMediaType: vi.fn(() => "image"),
    isMediaExtension: vi.fn(() => false),
    mediaSize: vi.fn(() => "")
}))
vi.mock("../../../shared/utils/helpers/output", () => ({ findMatchingOut: vi.fn(() => null), getActiveOutputs: vi.fn(() => []), getCurrentStyle: vi.fn(() => ({})), getResolution: vi.fn(() => [1920, 1080]), setOutput: vi.fn() }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../../../react/drawer/media/MediaLoader", () => ({ MediaLoader: () => <div data-testid="media-loader" /> }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../../../react/slide/Textbox", () => ({ Textbox: () => <div /> }))
vi.mock("../../../react/slide/Zoomed", () => ({ Zoomed: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../../../shared/ui/system/HoverPlay", () => ({ HoverPlay: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeShow, null), looseEntry(media, {}), looseEntry(outLocked, false), looseEntry(outputs, {}), looseEntry(overlays, {}), looseEntry(playingAudio, {}), looseEntry(showsCache, {}), looseEntry(stylesStore, {}), looseEntry(previewOutputId, null)])
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.mocked(getActiveOutputs).mockReturnValue([])
    vi.mocked(getCurrentStyle).mockReturnValue({} as never)
    vi.mocked(getResolution).mockReturnValue([1920, 1080] as never)
    vi.mocked(_show).mockImplementation(() => ({ layouts: () => ({ ref: () => [] }) }) as never)
}

describe("Media (tools)", () => {
    it("muestra el estado vacío cuando no hay recursos", () => {
        setStores()
        render(<Media />)
        expect(screen.getByText("empty.media")).toBeTruthy()
        expect(screen.getByTestId("center")).toBeTruthy()
    })

    it("no pide archivos al iniciar sin show activo", () => {
        setStores()
        render(<Media />)
        expect(requestMain).not.toHaveBeenCalled()
    })
})
