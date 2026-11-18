// @vitest-environment happy-dom
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { get } from "../../lib/store"
import { activePopup, quickSearchActive } from "../../stores"
import { disablePopupClose, keydown } from "../../utils/shortcuts"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"

// Initialize no decide si se puede cerrar: lo hace el marco (Esc en shortcuts.ts; clic afuera y X, que usan la misma lista).
// shortcuts.ts arrastra módulos de audio que crean AudioContext al cargarse: un doble que acepta cualquier uso
vi.hoisted(() => {
    const any = (): unknown => new Proxy(function () {}, { get: () => any(), apply: () => any(), construct: () => any() as object })
    vi.stubGlobal("AudioWorkletNode", class {})
    vi.stubGlobal("AudioContext", function () {
        return any()
    })
})

let restaurar: () => void = () => {}
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
    restaurar()
    vi.useRealTimers()
})
afterAll(() => vi.unstubAllGlobals())

const escape = () => {
    keydown(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }))
    vi.advanceTimersByTime(100)
}

describe("Initialize: el marco no lo deja cerrar", () => {
    it("initialize_esta_en_disablePopupClose", () => {
        expect(disablePopupClose).toContain("initialize")
    })

    it("Esc_con_initialize_abierto_no_lo_cierra", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, "initialize"), storeEntry(quickSearchActive, false)])
        escape()
        expect(get(activePopup)).toBe("initialize")
    })

    it("control: Esc con otro popup abierto si lo cierra", () => {
        restaurar = setStoresForTest([storeEntry(activePopup, "about"), storeEntry(quickSearchActive, false)])
        escape()
        expect(get(activePopup)).toBeNull()
    })
})
