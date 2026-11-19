// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EXPORT } from "../../../../types/Channels"
import { activePopup, activeShow, activeTagFilter, categories, globalTags, popupData, shows, showsCache, special, templates, usageLog } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { ShowInfo } from "./ShowInfo"

const mocks = vi.hoisted(() => ({ send: vi.fn(), lines: [] as unknown[] }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false, newToast: () => {}, hasNewerUpdate: () => Promise.resolve(false) }))
vi.mock("../../../shared/utils/request", () => ({ send: mocks.send }))
vi.mock("../../../shared/utils/helpers/show", () => ({ updateCachedShows: vi.fn() }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: () => ({ slides: () => ({ items: () => ({ lines: () => ({ get: () => mocks.lines }) }) }) }) }))
vi.mock("../../../shared/ui/system/Clock", () => ({ Clock: () => <div data-isla="Clock" /> }))
vi.mock("../../../shared/ui/system/Date", () => ({ Date: () => <div data-isla="Date" /> }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))

const SHOW = { id: "sh1", name: "Mi show", type: "show", category: "cat1", quickAccess: { tags: ["tag1"] }, timestamps: { created: 1700000000000 } }
let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.lines = []
    restaurar = setStoresForTest([looseEntry(activeShow, null), looseEntry(shows, {}), looseEntry(showsCache, {}), looseEntry(categories, { cat1: { name: "Alabanza" } }), looseEntry(globalTags, { tag1: { name: "domingo" } }), looseEntry(templates, {}), looseEntry(special, {}), looseEntry(usageLog, { all: [] }), looseEntry(activeTagFilter, [])])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ShowInfo", () => {
    it("muestra reloj y fecha sin show activo", () => {
        render(<ShowInfo optionsOpen={false} />)
        expect(document.querySelector('[data-isla="Clock"]')).toBeTruthy()
        expect(document.querySelector('[data-isla="Date"]')).toBeTruthy()
    })

    it("muestra metadatos, categoría, etiquetas y palabras del show activo", async () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeShow, SHOW), looseEntry(shows, { sh1: SHOW }), looseEntry(showsCache, { sh1: { slides: { s1: {} }, settings: { template: "tpl1" } } }), looseEntry(categories, { cat1: { name: "Alabanza" } }), looseEntry(globalTags, { tag1: { name: "domingo" } }), looseEntry(templates, { tpl1: { name: "Plantilla 1" } }), looseEntry(special, {}), looseEntry(usageLog, { all: [] })])
        mocks.lines = [[{ text: [{ value: "dos palabras" }] }]]
        await act(async () => {
            render(<ShowInfo optionsOpen={false} />)
        })
        expect(screen.getByText("Mi show")).toBeTruthy()
        expect(screen.getByText("Alabanza")).toBeTruthy()
        expect(screen.getByText("domingo")).toBeTruthy()
        expect(screen.getByText("Plantilla 1")).toBeTruthy()
        expect(screen.getByText("2")).toBeTruthy()
    })

    it("permite limpiar el filtro de etiquetas", () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(activeTagFilter, ["tag1"])])
        render(<ShowInfo optionsOpen={false} />)
        fireEvent.click(screen.getByText("[meta.clear_tag_filter]"))
        expect(get(activeTagFilter)).toEqual([])
    })

    it("abre el popup de limpieza desde las opciones", () => {
        render(<ShowInfo optionsOpen={true} />)
        fireEvent.click(document.querySelector('[data-title="popup.cleaning_utility"]') as HTMLElement)
        expect(get(popupData)).toEqual({ type: "shows" })
        expect(get(activePopup)).toBe("cleaning_utility")
    })

    it("exporta el registro de uso", async () => {
        restaurar()
        restaurar = setStoresForTest([looseEntry(special, { logSongUsage: true }), looseEntry(usageLog, { all: [{ id: "u1" }] })])
        vi.useFakeTimers()
        try {
            render(<ShowInfo optionsOpen={true} />)
            fireEvent.click(screen.getByText("[actions.export_usage_log]"))
            expect(mocks.send).toHaveBeenCalledWith(EXPORT, ["USAGE"], { content: { all: [{ id: "u1" }] } })
            await act(async () => {
                vi.advanceTimersByTime(1000)
            })
            expect(screen.getByText("[actions.reset_usage_log]")).toBeTruthy()
        } finally {
            vi.useRealTimers()
        }
    })
})
