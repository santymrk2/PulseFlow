// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actions, activePage, activePopup, activeShow, activeTimers, contextActive, groups, guideActive, openToolsTab, outLocked, outputs, overlayTimers, playingAudio, playingMetronome, slideTimers, special, timelineRecordingAction } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import Preview from "./Preview"

vi.mock("./MultiOutputs", () => ({ MultiOutputs: () => <div data-testid="multi-outputs" /> }))
vi.mock("../../react/drawer/audio/AudioMeter", () => ({ AudioMeter: ({ preview }: { preview?: boolean }) => <div data-testid="audio-meter" data-preview={String(preview)} /> }))
vi.mock("./ShowActions", () => ({
    ShowActions: ({ linesIndex, maxLines }: { linesIndex: number | null; maxLines: number | null }) => <div data-testid="show-actions" data-lines={linesIndex} data-max={maxLines} />
}))
vi.mock("./MediaControls", () => ({ MediaControls: ({ transport }: { transport?: boolean }) => <div data-testid="media-controls" data-transport={String(transport)} /> }))
vi.mock("./ClearButtons", () => ({
    ClearButtons: ({ activeClear, onUpdate, onAutoChangeChange }: { activeClear: string | null; onUpdate?: (key: string) => void; onAutoChangeChange?: (value: boolean) => void }) => (
        <div data-testid="clear-buttons" data-clear={activeClear}>
            <button onClick={() => onUpdate?.("slide")}>slide</button>
            <button onClick={() => onUpdate?.("audio")}>audio</button>
            <button onClick={() => onAutoChangeChange?.(false)}>auto</button>
        </div>
    )
}))
vi.mock("./Show", () => ({ Show: () => <div data-testid="show" /> }))
vi.mock("./SpotifyController", () => ({ SpotifyController: () => <div data-testid="spotify" /> }))

// getSlideText importa itemHelpers -> boxes.ts, que inicializa estados de edición
// incompatibles con happy-dom. No se usa en estos tests (autoLetterShortcut desactivado).
vi.mock("../../components/edit/scripts/textStyle", () => ({ getSlideText: () => "" }))

// Rompe el ciclo language -> stores -> actions -> historyHelpers -> language en happy-dom
vi.mock("../../shared/utils/language", () => ({
    translateText: (id: string) => id,
    setLanguage: () => {},
    getLeftParenthesis: () => "(",
    getRightParenthesis: () => ")",
    getLanguageList: () => []
}))

// @soundtouchjs/audio-worklet requiere AudioWorkletNode, ausente en happy-dom
vi.mock("../../shared/audio/audioProcessor", () => ({}))

// AudioAnalyser crea un AudioContext a nivel de módulo, ausente en happy-dom
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const output = (background: { type: string; path: string } | null = null) => ({ id: "o1", enabled: true, active: true, name: "O1", out: { background } })

let restore = () => {}
beforeEach(() => {
    restore = setStoresForTest([
        looseEntry(outputs, { o1: output() }),
        looseEntry(activePage, "show"),
        looseEntry(activeShow, null),
        looseEntry(outLocked, false),
        looseEntry(contextActive, false),
        looseEntry(guideActive, false),
        looseEntry(activePopup, null),
        looseEntry(playingAudio, {}),
        looseEntry(playingMetronome, false),
        looseEntry(overlayTimers, {}),
        looseEntry(activeTimers, []),
        looseEntry(slideTimers, {}),
        looseEntry(special, {}),
        looseEntry(actions, {}),
        looseEntry(groups, {}),
        looseEntry(openToolsTab, ""),
        looseEntry(timelineRecordingAction, null)
    ] as never)
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("Preview", () => {
    it("compone los ports del panel de muestra", () => {
        render(<Preview />)
        expect(screen.getByTestId("multi-outputs")).toBeTruthy()
        expect(screen.getByTestId("audio-meter").getAttribute("data-preview")).toBe("true")
        expect(screen.getByTestId("show-actions")).toBeTruthy()
        expect(screen.getByTestId("clear-buttons")).toBeTruthy()
        expect(screen.getByTestId("spotify")).toBeTruthy()
        expect(screen.queryByTestId("media-controls")).toBeNull()
    })

    it("sólo muestra clear y spotify en la página show", () => {
        activePage.set("edit")
        render(<Preview />)
        expect(screen.getByTestId("show-actions")).toBeTruthy()
        expect(screen.queryByTestId("clear-buttons")).toBeNull()
        expect(screen.queryByTestId("spotify")).toBeNull()
    })

    it("muestra los controles de transporte cuando el fondo es un video", () => {
        outputs.set({ o1: output({ type: "video", path: "video.mp4" }) } as never)
        render(<Preview />)
        expect(screen.getByTestId("media-controls").getAttribute("data-transport")).toBe("true")
    })

    it("abre la pestaña de herramientas correspondiente al clear elegido", () => {
        render(<Preview />)
        fireEvent.click(screen.getByText("audio"))
        expect(get(openToolsTab)).toBe("audio")
    })

    it("muestra el port Show cuando el clear activo es slide", async () => {
        render(<Preview />)
        fireEvent.click(screen.getByText("slide"))
        await waitFor(() => expect(screen.getByTestId("show")).toBeTruthy())
    })

    it("el atajo F1 limpia el fondo desde el handler de window", () => {
        render(<Preview />)
        fireEvent.keyDown(window, { key: "F1" })
        expect(get(timelineRecordingAction)).toEqual({ id: "clear_background" })
    })
})
