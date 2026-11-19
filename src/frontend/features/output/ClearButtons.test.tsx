// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeTimers, dictionary, isFadingOut, isTimelinePlaying, labelsDisabled, media, outLocked, outputCache, outputs, overlayTimers, playingAudio, playingMetronome, styles as outputStyles, timelineRecordingAction } from "../../shared/core/stores"
import { clearAll, clearBackground } from "./logic/clear"
import { getActiveOutputs, getOutputContent, isOutCleared } from "../../shared/utils/helpers/output"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { ClearButtons } from "./ClearButtons"

vi.mock("../../shared/audio/audioFading", () => ({ clearAudio: vi.fn() }))
vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../app/wiring/shortcuts", () => ({ presentationControllersKeysDisabled: vi.fn(() => false) }))
vi.mock("../../shared/utils/helpers/media", () => ({ getMediaLayerType: vi.fn(() => "background") }))
vi.mock("../../shared/utils/helpers/output", () => ({
    getActiveOutputs: vi.fn(() => []),
    getOutputContent: vi.fn(() => null),
    isOutCleared: vi.fn(() => false)
}))
vi.mock("./logic/clear", () => ({
    clearAll: vi.fn(),
    clearBackground: vi.fn(),
    clearOverlays: vi.fn(),
    clearScene: vi.fn(),
    clearSlide: vi.fn(),
    clearTimers: vi.fn(),
    restoreOutput: vi.fn()
}))

let restore = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setBaseStores() {
    restore = setStoresForTest([
        looseEntry(outputs, {}),
        looseEntry(playingAudio, {}),
        looseEntry(playingMetronome, false),
        looseEntry(outputCache, null),
        looseEntry(outLocked, false),
        looseEntry(outputStyles, {}),
        looseEntry(media, {}),
        looseEntry(overlayTimers, {}),
        looseEntry(activeTimers, {}),
        looseEntry(isFadingOut, false),
        looseEntry(isTimelinePlaying, false),
        looseEntry(labelsDisabled, false),
        looseEntry(dictionary, {}),
        looseEntry(timelineRecordingAction, null)
    ])
}

describe("ClearButtons", () => {
    it("renderiza_y_limpia_todo", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        vi.mocked(getActiveOutputs).mockReturnValue([])
        vi.mocked(getOutputContent).mockReturnValue(null)
        setBaseStores()

        render(<ClearButtons autoChange={false} activeClear={null} />)
        const clearAllBtn = screen.getByTitle("clear.all [esc]")
        fireEvent.click(clearAllBtn)
        expect(clearAll).toHaveBeenCalledWith(true)
    })

    it("ejecuta_accion_de_limpiar_y_callbacks", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        vi.mocked(getActiveOutputs).mockReturnValue([])
        vi.mocked(getOutputContent).mockReturnValue(null)
        setBaseStores()
        const onAutoChangeChange = vi.fn()
        const onUpdate = vi.fn()

        render(<ClearButtons autoChange={false} activeClear={null} onAutoChangeChange={onAutoChangeChange} onUpdate={onUpdate} />)
        fireEvent.click(screen.getByTitle("clear.background [F1]"))
        expect(clearBackground).toHaveBeenCalled()
        expect(onAutoChangeChange).toHaveBeenCalledWith(true)
    })
})
