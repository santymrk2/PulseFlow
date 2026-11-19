// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAudio } from "../../../shared/audio/audioFading"
import { AudioPlayer } from "../../../shared/audio/audioPlayer"
import { setOutput } from "../../../shared/utils/helpers/output"
import { requestMain } from "../../../shared/core/ipc/main"
import { activePopup, activeProject, focusMode, media, outLocked, outputs, playingAudio, popupData, projects, styles } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { FolderShow } from "./FolderShow"

vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(async () => ({})), sendMain: vi.fn() }))
vi.mock("../../../shared/audio/audioFading", () => ({ clearAudio: vi.fn() }))
vi.mock("../../../shared/audio/audioPlayer", () => ({
    AudioPlayer: { start: vi.fn(), getPlaying: vi.fn(() => false) }
}))
vi.mock("../../../shared/utils/helpers/array", () => ({
    keysToID: (value: unknown) => Object.values((value || {}) as object),
    sortByName: (value: unknown) => value
}))
vi.mock("../../../shared/utils/helpers/media", () => ({
    getExtension: (name: string) => name.split(".").pop() || "",
    getMediaType: (extension: string) => (extension === "mp3" ? "audio" : extension === "mp4" ? "video" : "image"),
    getMediaStyle: vi.fn(() => ({})),
    getMediaLayerType: vi.fn(() => "background"),
    getVideoDuration: vi.fn(async () => 5)
}))
vi.mock("../../../shared/utils/helpers/output", () => ({
    getFirstActiveOutput: vi.fn(() => undefined),
    findMatchingOut: vi.fn(() => null),
    setOutput: vi.fn(),
    startFolderTimer: vi.fn()
}))
vi.mock("../../output/logic/clear", () => ({ clearBackground: vi.fn(), clearSlide: vi.fn() }))
vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../react/drawer/Card", () => ({
    Card: ({ label, onClick, children }: { label: string; onClick?: () => void; children?: ReactNode }) => (
        <div data-testid="card" data-label={label} onClick={onClick}>
            {children}
        </div>
    )
}))
vi.mock("../../../react/drawer/media/MediaLoader", () => ({ MediaLoader: ({ path }: { path: string }) => <div data-testid="media-loader" data-path={path} /> }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({
    Button: ({ title, disabled, onClick, children }: { title?: string; disabled?: boolean; onClick?: () => void; children?: ReactNode }) => (
        <button type="button" title={title} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("../../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ side, children }: { side?: string; children?: ReactNode }) => <div data-side={side}>{children}</div> }))
vi.mock("../../../shared/ui/system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const files = {
    a: { path: "/tmp/a.png", name: "a.png", thumbnailPath: "/tmp/a-thumb.png" },
    b: { path: "/tmp/b.mp4", name: "b.mp4" },
    c: { path: "/tmp/c.mp3", name: "c.mp3" }
}

function setStores(options: { locked?: boolean; focus?: boolean; timer?: number } = {}) {
    restore = setStoresForTest([looseEntry(projects, { project1: { shows: [{ id: "folder", data: { timer: options.timer ?? 3 } }] } }), looseEntry(activeProject, "project1"), looseEntry(focusMode, options.focus ?? false), looseEntry(media, {}), looseEntry(outLocked, options.locked ?? false), looseEntry(outputs, {}), looseEntry(playingAudio, {}), looseEntry(styles, {}), looseEntry(popupData, {}), looseEntry(activePopup, "")])
}

describe("FolderShow", () => {
    it("carga los archivos multimedia y calcula el tiempo total", async () => {
        vi.mocked(requestMain).mockResolvedValueOnce(files)
        setStores()
        render(<FolderShow path="/tmp" index={0} />)

        await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(3))
        expect(screen.getAllByTestId("media-loader")).toHaveLength(2)
        expect(screen.getByTitle("popup.next_timer: 8s")).toBeTruthy()
    })

    it("inicia el audio cuando no está sonando y lo detiene cuando sí lo está", async () => {
        vi.mocked(requestMain).mockResolvedValueOnce(files)
        setStores()
        render(<FolderShow path="/tmp" index={0} />)
        await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(3))

        const audioCard = screen.getAllByTestId("card").find((card) => card.getAttribute("data-label") === "c.mp3")
        expect(audioCard).toBeTruthy()
        if (!audioCard) return

        vi.mocked(AudioPlayer.getPlaying).mockReturnValueOnce(null)
        fireEvent.click(audioCard)
        expect(AudioPlayer.start).toHaveBeenCalledWith("/tmp/c.mp3", { name: "c.mp3" })

        vi.mocked(AudioPlayer.getPlaying).mockReturnValueOnce({ audio: null } as never)
        fireEvent.click(audioCard)
        expect(clearAudio).toHaveBeenCalledWith("/tmp/c.mp3")
    })

    it("no reproduce nada cuando las salidas están bloqueadas", async () => {
        vi.mocked(requestMain).mockResolvedValueOnce(files)
        setStores({ locked: true })
        render(<FolderShow path="/tmp" index={0} />)
        await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(3))

        const imageCard = screen.getAllByTestId("card").find((card) => card.getAttribute("data-label") === "a.png")
        if (imageCard) fireEvent.click(imageCard)
        expect(vi.mocked(setOutput)).not.toHaveBeenCalled()
    })

    it("oculta las barras flotantes en modo foco", async () => {
        vi.mocked(requestMain).mockResolvedValueOnce(files)
        setStores({ focus: true })
        const { container } = render(<FolderShow path="/tmp" index={0} />)
        await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(3))
        expect(container.querySelector("[data-side]")).toBeNull()
    })
})
