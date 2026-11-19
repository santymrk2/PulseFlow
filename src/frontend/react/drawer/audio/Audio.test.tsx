// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePlaylist, activePopup, activeRename, audioFolders, audioPlaylists, drawerTabsData, effectsLibrary, labelsDisabled, media, outLocked, selectAllAudio, selected } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Audio } from "./Audio"

interface ClickDetail {
    ctrl: boolean
    shift: boolean
    alt: boolean
    doubleClick: boolean
    target: EventTarget
}

vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(() => Promise.resolve({})) }))
vi.mock("../../../audio/audioPlayer", () => ({
    AudioPlayer: { getDurationSync: vi.fn(() => 30), getKey: vi.fn((p: string) => p), getAudioType: vi.fn(() => "music"), start: vi.fn(), updateVolume: vi.fn(), getDuration: vi.fn(() => Promise.resolve(30)) }
}))
vi.mock("../../../audio/audioPlaylist", () => ({ AudioPlaylist: { update: vi.fn(), start: vi.fn(), stop: vi.fn() } }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../live/Microphones", () => ({ Microphones: () => <div data-testid="microphones" /> }))
vi.mock("../live/AudioStreams", () => ({ AudioStreams: () => <div data-testid="audio-streams" /> }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ title, children, onClick }: { title?: string; children?: ReactNode; onClick?: (detail: ClickDetail) => void }) => (
        <button title={title} onClick={(e) => onClick?.({ ctrl: false, shift: false, alt: false, doubleClick: false, target: e.target })}>
            {children}
        </button>
    )
}))
vi.mock("../../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("../../ui/number-field/NumberField", () => ({ NumberField: ({ label }: { label: string }) => <div>{label}</div> }))
vi.mock("../../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../system/DropArea", () => ({ DropArea: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../media/Folder", () => ({ Folder: ({ name }: { name: string }) => <div data-testid="folder">{name}</div> }))
vi.mock("./AudioFile", () => ({ AudioFile: ({ name }: { name: string }) => <div data-testid="audio-file">{name}</div> }))
vi.mock("./effects/AudioEffect", () => ({ AudioEffect: ({ name }: { name: string }) => <div data-testid="effect-card">{name}</div> }))
vi.mock("./Metronome", () => ({ Metronome: () => <div data-testid="metronome" /> }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(audioPlaylists, {}), looseEntry(audioFolders, {}), looseEntry(drawerTabsData, {}), looseEntry(effectsLibrary, []), looseEntry(media, {}), looseEntry(outLocked, false), looseEntry(labelsDisabled, false), looseEntry(activePlaylist, null), looseEntry(selectAllAudio, false), looseEntry(selected, null), looseEntry(activePopup, null), looseEntry(activeRename, "")])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("Audio", () => {
    it("muestra las pestañas de inputs y el port de microphones", () => {
        render(<Audio active="inputs" />)
        expect(screen.getByText("live.microphones")).toBeTruthy()
        expect(screen.getByText("live.audio_streams")).toBeTruthy()
        expect(screen.getByTestId("microphones")).toBeTruthy()
    })

    it("cambia a audio streams al elegir la pestaña", () => {
        render(<Audio active="inputs" />)
        const tab = screen.getAllByRole("button").find((button) => button.textContent === "live.audio_streams")
        fireEvent.click(tab as Element)
        expect(screen.getByTestId("audio-streams")).toBeTruthy()
    })

    it("monta el metrónomo React cuando está activo", () => {
        render(<Audio active="metronome" />)
        expect(screen.getByTestId("metronome")).toBeTruthy()
    })

    it("lista los audios de una playlist", () => {
        audioPlaylists.set({ "pl-1": { name: "LISTA", songs: ["/a.mp3", "/b.mp3"] } } as never)
        render(<Audio active="pl-1" />)
        expect(screen.getAllByTestId("audio-file")).toHaveLength(2)
    })

    it("monta los efectos de la librería como componentes React", () => {
        effectsLibrary.set([{ path: "/fx/a.wav", name: "a.wav" }] as never)
        render(<Audio active="effects_library" />)
        expect(screen.getByTestId("effect-card").textContent).toBe("a.wav")
    })

    it("muestra el icono vacío cuando no hay archivos", () => {
        render(<Audio active="all" />)
        expect(document.querySelector("[data-icon='noAudio']")).not.toBeNull()
    })
})
