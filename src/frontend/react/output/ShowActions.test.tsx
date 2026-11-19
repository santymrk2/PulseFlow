// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeEdit, activePage, activePopup, activeShow, outLocked, popupData, showsCache } from "../../shared/core/stores"
import { refreshOut, setOutput } from "../../components/helpers/output"
import { OutputHelper } from "../../components/helpers/OutputHelper"
import { getLayoutRef } from "../../components/helpers/show"
import { updateOut } from "../../components/helpers/showActions"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ShowActions } from "./ShowActions"

vi.mock("../../components/helpers/output", () => ({ refreshOut: vi.fn(), setOutput: vi.fn() }))
vi.mock("../../components/helpers/OutputHelper", () => ({ OutputHelper: { advanceOutputs: vi.fn() } }))
vi.mock("../../components/helpers/show", () => ({ getLayoutRef: vi.fn(() => []) }))
vi.mock("../../components/helpers/showActions", () => ({ updateOut: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(showType: string | undefined = "show") {
    restore = setStoresForTest([looseEntry(activeShow, showType ? { id: "s1", type: showType } : null), looseEntry(activePage, "show"), looseEntry(activeEdit, { slide: 0, items: [] }), looseEntry(activePopup, null), looseEntry(outLocked, false), looseEntry(popupData, {}), looseEntry(showsCache, { s1: { settings: { activeLayout: "l1" } } })])
    vi.mocked(getLayoutRef).mockReturnValue([])
}

describe("ShowActions", () => {
    it("renderiza_lo_principal", () => {
        setStores()
        const { container } = render(<ShowActions currentOutput={{} as never} refItems={[]} linesIndex={0} maxLines={0} />)
        expect(container.querySelectorAll("button").length).toBeGreaterThan(0)
    })

    it("avanza_a_la_siguiente_diapositiva", () => {
        setStores()
        vi.mocked(getLayoutRef).mockReturnValue([{ id: "a" }, { id: "b" }] as never[])
        render(<ShowActions currentOutput={{} as never} refItems={[{ id: "a" } as never, { id: "b" } as never]} linesIndex={0} maxLines={0} />)
        const next = screen.getByTitle("preview._next_slide [Arrow Right]")
        fireEvent.click(next)
        expect(OutputHelper.advanceOutputs).toHaveBeenCalledWith("next")
    })

    it("inicia_la_presentacion_actual", () => {
        setStores()
        render(<ShowActions currentOutput={{} as never} refItems={[]} linesIndex={0} maxLines={0} />)
        const start = screen.getByTitle("preview._start [Space]")
        fireEvent.click(start)
        expect(setOutput).toHaveBeenCalled()
        expect(updateOut).toHaveBeenCalled()
    })

    it("abre_el_popup_de_transicion", () => {
        setStores()
        render(<ShowActions currentOutput={{} as never} refItems={[]} linesIndex={0} maxLines={0} />)
        const transition = screen.getByTitle("popup.transition")
        fireEvent.click(transition)
        expect(get(activePopup)).toBeTruthy()
        // store updated
        expect(refreshOut).not.toHaveBeenCalled()
    })
})
