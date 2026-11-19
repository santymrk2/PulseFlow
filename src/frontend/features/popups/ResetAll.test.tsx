// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendMain } from "../../shared/core/ipc/main"
import { Main } from "../../../types/IPC/Main"
import { clearAll } from "../../components/output/clear"
import { activeEdit, activePage, activePopup, activeShow, deletedShows, dictionary, renamedShows, scripturesCache } from "../../shared/core/stores"
import { save } from "../../app/wiring/save"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { ResetAll } from "./ResetAll"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../components/output/clear", () => ({ clearAll: vi.fn() }))
vi.mock("../../app/wiring/save", () => ({ save: vi.fn() }))

let restaurar: () => void = () => {}
function montar() {
    restaurar = setStoresForTest([looseEntry(dictionary, { popup: { reset_all_confirm: "Confirmar reset", reset_all_action: "Acción", continue: "Continuar" } }), looseEntry(scripturesCache, { biblia: {} }), looseEntry(deletedShows, [{ name: "x", id: "x" }]), looseEntry(renamedShows, [{ id: "x", name: "n", oldName: "o" }]), looseEntry(activeShow, { id: "sh" }), looseEntry(activeEdit, { items: [0], slide: 1 }), looseEntry(activePage, "live"), looseEntry(activePopup, "reset_all")] as never)
    return render(<ResetAll />)
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("ResetAll", () => {
    it("muestra los tres textos traducidos", () => {
        montar()
        expect(screen.getByText("Confirmar reset")).toBeTruthy()
        expect(screen.getByText("Acción")).toBeTruthy()
        expect(screen.getByText("Continuar")).toBeTruthy()
    })

    it("al confirmar hace backup y un segundo después envía el Main.SAVE de reset", () => {
        montar()
        fireEvent.click(screen.getByText("Continuar"))
        expect(save).toHaveBeenCalledWith(false, { backup: true, isAutoBackup: true })
        expect(sendMain).not.toHaveBeenCalled()
        act(() => vi.advanceTimersByTime(1000))
        expect(sendMain).toHaveBeenCalledTimes(1)
        expect(sendMain).toHaveBeenCalledWith(Main.SAVE, {
            SETTINGS: {},
            SYNCED_SETTINGS: {},
            SHOWS: {},
            STAGE: {},
            PROJECTS: { projects: {}, folders: {}, projectTemplates: {} },
            OVERLAYS: {},
            TEMPLATES: {},
            EVENTS: {},
            MEDIA: {},
            THEMES: {},
            DRIVE_API_KEY: {},
            CACHE: { media: {}, text: {} },
            HISTORY: { undo: [], redo: [] },
            USAGE: { all: [] },
            closeWhenFinished: false,
            customTriggers: { reset: true }
        })
    })

    it("después del backup limpia los stores y abre initialize", () => {
        montar()
        fireEvent.click(screen.getByText("Continuar"))
        act(() => vi.advanceTimersByTime(1000))
        expect(clearAll).toHaveBeenCalledTimes(1)
        expect(get(scripturesCache)).toEqual({})
        expect(get(deletedShows)).toEqual([])
        expect(get(renamedShows)).toEqual([])
        expect(get(activeShow)).toBeNull()
        expect(get(activeEdit)).toEqual({ items: [] })
        expect(get(activePage)).toBe("show")
        expect(get(activePopup)).toBe("initialize")
    })

    it("sin confirmar no escribe nada", () => {
        montar()
        act(() => vi.advanceTimersByTime(5000))
        expect(save).not.toHaveBeenCalled()
        expect(sendMain).not.toHaveBeenCalled()
        expect(clearAll).not.toHaveBeenCalled()
    })
})
