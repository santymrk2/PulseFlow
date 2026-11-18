// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioPlayer } from "../../../audio/audioPlayer"
import { AudioPlaylist } from "../../../audio/audioPlaylist"
import { addProjectItem } from "../../../converters/project"
import { activePlaylist, activeShow, media, outLocked, playingAudio } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { AudioFile } from "./AudioFile"

interface ClickDetail {
    ctrl: boolean
    shift: boolean
    alt: boolean
    doubleClick: boolean
    target: EventTarget
}

vi.mock("../../../audio/audioPlayer", () => ({
    AudioPlayer: {
        getDuration: vi.fn(() => Promise.resolve(30)),
        getKey: vi.fn((path: string, index?: number) => (index === undefined ? path : `${path}:${index}`)),
        getAudioType: vi.fn(() => "music"),
        start: vi.fn()
    }
}))
vi.mock("../../../audio/audioPlaylist", () => ({ AudioPlaylist: { start: vi.fn() } }))
vi.mock("../../../converters/project", () => ({ addProjectItem: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ title, children, showOutline, onClick, onDblClick }: { title?: string; children?: ReactNode; showOutline?: boolean; onClick?: (detail: ClickDetail) => void; onDblClick?: (detail: ClickDetail) => void }) => (
        <button title={title} data-outline={showOutline} onClick={(e) => onClick?.({ ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, doubleClick: false, target: e.target })} onDoubleClick={(e) => onDblClick?.({ ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, doubleClick: true, target: e.target })}>
            {children}
        </button>
    )
}))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(playingAudio, {}), looseEntry(activePlaylist, null), looseEntry(activeShow, null), looseEntry(media, {}), looseEntry(outLocked, false)])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioFile", () => {
    it("muestra el nombre sin extensión y la duración", async () => {
        render(<AudioFile path="/tmp/theme.mp3" name="theme.mp3" />)
        expect(screen.getByText("theme")).toBeTruthy()
        await waitFor(() => expect(screen.getByText("00:30")).toBeTruthy())
    })

    it("arranca el audio al hacer click", () => {
        render(<AudioFile path="/tmp/theme.mp3" name="theme.mp3" />)
        fireEvent.click(screen.getByTitle("/tmp/theme.mp3"))
        expect(AudioPlayer.start).toHaveBeenCalledWith("/tmp/theme.mp3", { name: "theme.mp3" }, { playMultiple: false })
    })

    it("agrega el audio al proyecto con doble click", () => {
        render(<AudioFile path="/tmp/theme.mp3" name="theme.mp3" />)
        fireEvent.doubleClick(screen.getByTitle("/tmp/theme.mp3"))
        expect(addProjectItem).toHaveBeenCalledWith({ id: "/tmp/theme.mp3", name: "theme.mp3", type: "audio" })
    })

    it("marca el outline cuando el audio está sonando", () => {
        playingAudio.set({ "/tmp/theme.mp3": { paused: false } } as never)
        render(<AudioFile path="/tmp/theme.mp3" name="theme.mp3" />)
        expect(screen.getByTitle("/tmp/theme.mp3").getAttribute("data-outline")).toBe("true")
    })

    it("arranca la playlist cuando está en modo playlist", () => {
        render(<AudioFile path="/tmp/theme.mp3" name="theme.mp3" active="pl-1" playlist index={2} />)
        fireEvent.click(screen.getByTitle("/tmp/theme.mp3"))
        expect(AudioPlaylist.start).toHaveBeenCalledWith("pl-1", "/tmp/theme.mp3", 2, { pauseIfPlaying: true })
    })
})
