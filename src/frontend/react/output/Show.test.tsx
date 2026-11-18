// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeShow, focusMode, outLocked, outputs, playingVideoState, presentationData, showsCache } from "../../stores"
import { formatUrl, getOutputtedWebsites, sendWebsiteKey, toggleWebsiteMute, triggerWebsiteAction } from "../../components/helpers/websiteControls"
import { VideoPlayer } from "../../components/media/video/videoPlayer"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import Show from "./Show"

vi.mock("../../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../../components/helpers/media", () => ({ getFileName: (path: string) => path, removeExtension: (path: string) => path }))
vi.mock("../../components/helpers/websiteControls", () => ({
    formatUrl: (url: string) => url,
    getOutputtedWebsites: vi.fn(() => [] as { src: string }[]),
    sendWebsiteKey: vi.fn(),
    toggleWebsiteMute: vi.fn(),
    triggerWebsiteAction: vi.fn()
}))
vi.mock("../../components/media/video/videoPlayer", () => ({ VideoPlayer: { play: vi.fn(), pause: vi.fn(), toggleLoop: vi.fn(), toggleMute: vi.fn() } }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <svg data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id} /> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ title, onClick, children }: { title?: string; onClick?: () => void; children?: ReactNode }) => (
        <button title={title} onClick={onClick}>
            {children}
        </button>
    )
}))
vi.mock("./VideoSlider", () => ({ VideoSlider: ({ videoTime }: { videoTime: number }) => <div data-testid="video-slider" data-time={videoTime} /> }))

const slide = (extra: Record<string, unknown> = {}) => ({ id: "s1", name: "Intro", index: 1, pages: 5, ...extra })

let restore = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(outputs, {}), looseEntry(showsCache, {}), looseEntry(activeShow, null), looseEntry(focusMode, false), looseEntry(outLocked, false), looseEntry(playingVideoState, {}), looseEntry(presentationData, {})] as never)
    vi.mocked(getOutputtedWebsites).mockReturnValue([])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Show", () => {
    it("muestra el nombre y el contador de slides", () => {
        render(<Show currentOutput={{ out: { slide: slide() } } as never} ref={[]} linesIndex={null} maxLines={null} />)
        expect(screen.getByText("Intro")).toBeTruthy()
        expect(screen.getByText(/2\/5/)).toBeTruthy()
    })

    it("usa el nombre del show cache cuando el slide no tiene nombre", () => {
        showsCache.set({ s2: { name: "Nombre cacheado" } } as never)
        render(<Show currentOutput={{ out: { slide: slide({ id: "s2", name: "" }) } } as never} ref={[]} linesIndex={null} maxLines={null} />)
        expect(screen.getByText("Nombre cacheado")).toBeTruthy()
    })

    it("muestra el rango de líneas cuando hay maxLines", () => {
        render(<Show currentOutput={{ out: { slide: slide() } } as never} ref={[]} linesIndex={2} maxLines={4} />)
        expect(screen.getByText("(3/4)")).toBeTruthy()
    })

    it("abre el show activo al hacer click en el nombre", () => {
        render(<Show currentOutput={{ out: { slide: slide({ layout: "l1" }) } } as never} ref={[]} linesIndex={null} maxLines={null} />)
        fireEvent.click(screen.getByText("Intro"))
        expect(get(activeShow)).toEqual({ id: "s1", type: "show" })
    })

    it("renderiza los videos de item con su slider", () => {
        playingVideoState.set({ "video.mp4_o1": { currentTime: 12, duration: 100, paused: false, loop: true, muted: false, type: "item" } } as never)
        render(<Show currentOutput={{ out: { slide: slide() } } as never} ref={[]} linesIndex={null} maxLines={null} />)
        expect(screen.getByTestId("video-slider").getAttribute("data-time")).toBe("12")
        expect(screen.getByText("video.mp4")).toBeTruthy()
    })

    it("los controles de website envían las teclas y alternan el mute", () => {
        vi.mocked(getOutputtedWebsites).mockReturnValue([{ src: "https://ejemplo.com" }])
        render(<Show currentOutput={{ out: {} } as never} ref={[]} linesIndex={null} maxLines={null} />)
        fireEvent.click(screen.getByTitle("media.previous"))
        expect(sendWebsiteKey).toHaveBeenCalledWith("https://ejemplo.com", "Left")
        fireEvent.click(screen.getByTitle("actions.mute"))
        expect(toggleWebsiteMute).toHaveBeenCalledWith("https://ejemplo.com", true)
        fireEvent.keyDown(screen.getByText(formatUrl("https://ejemplo.com")).closest("[role='button']") as Element, { key: "ArrowRight" })
        expect(sendWebsiteKey).toHaveBeenCalledWith("https://ejemplo.com", "Right")
        fireEvent.click(screen.getByTitle("preview.reload"))
        expect(triggerWebsiteAction).toHaveBeenCalledWith({ src: "https://ejemplo.com", type: "reload" })
        expect(VideoPlayer.toggleMute).not.toHaveBeenCalled()
    })
})
