// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    spotifyState: null as any,
    spotifyIsFading: null as any,
    initSpotifyManager: vi.fn(),
    destroySpotifyManager: vi.fn(),
    fadePause: vi.fn(),
    seekTo: vi.fn(),
    skipNext: vi.fn(),
    skipPrev: vi.fn(),
    togglePlay: vi.fn(),
    sendMain: vi.fn()
}))

// initialize stores inside hoisted scope isn't possible with outer helper, so assign after via module factory closure
vi.mock("../../components/output/preview/SpotifyManager", () => {
    const subsState = new Set<(v: any) => void>()
    const subsFade = new Set<(v: any) => void>()
    let stateValue: any = null
    let fadeValue = false
    const spotifyState = {
        subscribe(fn: (v: any) => void) {
            fn(stateValue)
            subsState.add(fn)
            return () => subsState.delete(fn)
        },
        set(v: any) {
            stateValue = v
            subsState.forEach((fn) => fn(stateValue))
        },
        update(fn: (v: any) => any) {
            stateValue = fn(stateValue)
            subsState.forEach((s) => s(stateValue))
        }
    }
    const spotifyIsFading = {
        subscribe(fn: (v: any) => void) {
            fn(fadeValue)
            subsFade.add(fn)
            return () => subsFade.delete(fn)
        },
        set(v: boolean) {
            fadeValue = v
            subsFade.forEach((fn) => fn(fadeValue))
        },
        update(fn: (v: boolean) => boolean) {
            fadeValue = fn(fadeValue)
            subsFade.forEach((s) => s(fadeValue))
        }
    }
    mocks.spotifyState = spotifyState
    mocks.spotifyIsFading = spotifyIsFading
    return {
        spotifyState,
        spotifyIsFading,
        initSpotifyManager: mocks.initSpotifyManager,
        destroySpotifyManager: mocks.destroySpotifyManager,
        fadePause: mocks.fadePause,
        seekTo: mocks.seekTo,
        skipNext: mocks.skipNext,
        skipPrev: mocks.skipPrev,
        togglePlay: mocks.togglePlay
    }
})
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: (...args: unknown[]) => mocks.sendMain(...args) }))
vi.mock("../../../types/IPC/Main", () => ({ Main: { URL: "URL" } }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span data-testid="icon" /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick, title, disabled }: any) => (
        <button title={title} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    )
}))

import { SpotifyController } from "./SpotifyController"

afterEach(() => {
    cleanup()
    mocks.spotifyState?.set(null)
    mocks.spotifyIsFading?.set(false)
    vi.clearAllMocks()
})

describe("SpotifyController", () => {
    it("no_renderiza_sin_estado", () => {
        const { container } = render(<SpotifyController />)
        expect(container.firstChild).toBeNull()
        expect(mocks.initSpotifyManager).toHaveBeenCalled()
    })

    it("renderiza_y_controla_reproduccion", () => {
        mocks.spotifyState.set({ isPlaying: true, title: "Song", artist: "Artist", albumArt: "", positionSec: 10, durationSec: 100, bgColor: "" })
        render(<SpotifyController />)

        expect(screen.getByText("Song")).toBeTruthy()
        expect(screen.getByText("Artist")).toBeTruthy()

        fireEvent.click(screen.getByTitle("media.previous"))
        fireEvent.click(screen.getByTitle("media.pause"))
        fireEvent.click(screen.getByTitle("media.next"))

        expect(mocks.skipPrev).toHaveBeenCalled()
        expect(mocks.togglePlay).toHaveBeenCalled()
        expect(mocks.skipNext).toHaveBeenCalled()
    })
})
