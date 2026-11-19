// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, effects, outputs } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { EffectIcons } from "./EffectIcons"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const dict = {
    actions: { remove: "Quitar", specific_outputs: "Salidas específicas" },
    popup: { display_duration: "Duración" },
    context: { place_under_slide: "Debajo de la diapositiva" }
}

const effect = (extra: Record<string, unknown> = {}) => ({ name: "Efecto", color: null, items: [], style: "", background: "", ...extra })

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(effects, { e1: effect({ displayDuration: 5, bindings: ["out1"], placeUnderSlide: true }) } as never), storeEntry(outputs, { out1: { name: "Pantalla 1" } } as never)])
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    restaurar()
    restaurar = () => {}
})

describe("EffectIcons", () => {
    it("muestra duración, salida y debajo de la diapositiva", () => {
        render(<EffectIcons columns={5} effectId="e1" />)
        expect(screen.getByText("5s")).toBeTruthy()
        expect(screen.getByText("Pantalla 1")).toBeTruthy()
        expect(screen.getAllByRole("button")).toHaveLength(3)
    })

    it("con varias salidas muestra la cantidad", () => {
        act(() =>
            effects.set({
                e1: effect({ bindings: ["out1", "out2"] })
            } as never)
        )
        render(<EffectIcons columns={5} effectId="e1" />)
        expect(screen.getByText("2")).toBeTruthy()
    })

    it("quita la acción del efecto al hacer clic", () => {
        vi.useFakeTimers()
        render(<EffectIcons columns={5} effectId="e1" />)
        fireEvent.click(document.querySelector('[data-title="Quitar: Duración"]') as HTMLElement)
        act(() => vi.runAllTimers())
        expect(get(effects).e1.displayDuration).toBeUndefined()
        expect(get(effects).e1.bindings).toEqual(["out1"])
    })

    it("sin acciones no muestra nada", () => {
        act(() => effects.set({ e1: effect() } as never))
        const { container } = render(<EffectIcons columns={5} effectId="e1" />)
        expect(container.firstElementChild?.children).toHaveLength(0)
    })

    it("ajusta el zoom según las columnas", () => {
        const { container } = render(<EffectIcons columns={10} effectId="e1" />)
        expect((container.firstElementChild as HTMLElement).style.zoom).toBe("0.5")
    })
})
