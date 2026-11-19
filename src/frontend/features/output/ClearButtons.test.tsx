// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeTimers, dictionary, isFadingOut, isTimelinePlaying, labelsDisabled, media, outLocked, outputCache, outputs, overlayTimers, playingAudio, playingMetronome, special, styles as outputStyles, timelineRecordingAction } from "../../shared/core/stores"
import { clearAll, clearBackground } from "./logic/clear"
import { clearToLogo } from "./logic/clearToLogo"
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
vi.mock("./logic/clearToLogo", () => ({ clearToLogo: vi.fn() }))
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

function setBaseStores(specialValue: Record<string, unknown> = {}) {
    restore = setStoresForTest([
        looseEntry(special, specialValue),
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

    it("ordena_los_botones_de_capa_de_arriba_hacia_abajo_de_la_pila", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        vi.mocked(getActiveOutputs).mockReturnValue([])
        vi.mocked(getOutputContent).mockReturnValue(null)
        setBaseStores()

        render(<ClearButtons autoChange={false} activeClear={null} />)
        const titles = screen.getAllByRole("button").map((b) => b.getAttribute("title") || "")
        const order = ["clear.overlays", "clear.slide", "clear.nextTimer", "clear.background", "clear.audio"].map((t) => titles.findIndex((x) => x.startsWith(t)))
        expect(order.every((i) => i >= 0)).toBe(true)
        expect([...order].sort((a, b) => a - b)).toEqual(order)
    })

    it("clear_all_y_restore_siempre_se_renderizan", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        vi.mocked(getActiveOutputs).mockReturnValue([])
        vi.mocked(getOutputContent).mockReturnValue(null)
        setBaseStores()

        render(<ClearButtons autoChange={false} activeClear={null} />)
        expect(screen.getByTitle("clear.all [esc]")).toBeTruthy()
        const restore = screen.getByTitle("preview.restore_output") as HTMLButtonElement
        expect(restore.disabled).toBe(true)
    })

    it("el_boton_logo_esta_deshabilitado_sin_logo_configurado", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        setBaseStores()

        render(<ClearButtons autoChange={false} activeClear={null} />)
        const logo = screen.getByTitle("clear.logo_missing") as HTMLButtonElement
        expect(logo.disabled).toBe(true)
        fireEvent.click(logo)
        expect(clearToLogo).not.toHaveBeenCalled()
    })

    it("con_logo_el_boton_llama_a_clearToLogo", () => {
        vi.mocked(isOutCleared).mockReturnValue(false)
        setBaseStores({ outputLogo: "/img/logo.png" })

        render(<ClearButtons autoChange={false} activeClear={null} />)
        fireEvent.click(screen.getByTitle("clear.logo [F6]"))
        expect(clearToLogo).toHaveBeenCalled()
    })
})
