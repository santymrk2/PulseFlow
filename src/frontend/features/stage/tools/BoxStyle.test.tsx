// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, stageShows, theme, themes } from "../../../shared/core/stores"
import { addStyleString } from "../../edit/logic/scripts/textStyle"
import { history } from "../../../shared/utils/helpers/history"
import { updateStageShow } from "../logic/stage"
import { BoxStyle } from "./BoxStyle"

type ChangeEvent = { detail: { id: string; key?: string; value: unknown; values: { value: unknown } } }
type EditValuesProps = { sections: Record<string, { inputs: unknown[][] }>; styles: Record<string, string>; customValues: Record<string, string>; item: unknown; isStage: boolean }
let islandProps: EditValuesProps | null = null
let onChange: ((event: ChangeEvent) => void) | null = null

vi.mock("../../../shared/core/stores", () => {
    function makeStore(initial: unknown) {
        let value = initial
        const listeners = new Set<(next: unknown) => void>()
        return {
            subscribe(run: (next: unknown) => void) {
                listeners.add(run)
                run(value)
                return () => listeners.delete(run)
            },
            set(next: unknown) {
                value = next
                listeners.forEach((run) => run(value))
            },
            update(fn: (current: never) => unknown) {
                value = fn(value as never)
                listeners.forEach((run) => run(value))
            }
        }
    }
    const known: Record<string, unknown> = { activeStage: makeStore({ id: "st1", items: ["i1"] }), stageShows: makeStore({}), theme: makeStore("t1"), themes: makeStore({}) }
    // Los módulos transitivos piden stores de otras áreas: se les devuelve uno vacío en vez de cargar los reales (evita ciclos).
    return new Proxy(known, {
        get(target, prop: string) {
            if (!(prop in target)) target[prop] = makeStore({})
            return target[prop]
        }
    })
})
vi.mock("../../edit/logic/scripts/textStyle", () => ({ addStyleString: vi.fn((style: string, [key, value]) => `${style}${key}:${String(value)};`) }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/show", () => ({ getCustomMetadata: vi.fn(() => ({})) }))
vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../logic/stage", () => ({ updateStageShow: vi.fn() }))
vi.mock("../../edit/tools/EditValues", () => ({
    EditValues: (props: EditValuesProps & { onChange: (input: unknown) => void }) => {
        islandProps = props
        onChange = (event: ChangeEvent) => props.onChange(event.detail)
        return null
    }
}))

const stageItem = { id: "i1", type: "text", style: "left: 10px;font-size: 30px;", align: "center", flash: { enabled: true, color: "#00FF00", count: 5 } }

beforeEach(() => {
    activeStage.set({ id: "st1", items: ["i1"] } as never)
    stageShows.set({ st1: { items: { i1: stageItem } } } as never)
    theme.set("t1" as never)
    themes.set({ t1: { colors: { secondary: "#F0008C" } } } as never)
    islandProps = null
    onChange = null
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("BoxStyle", () => {
    it("pasa las secciones, estilos y alineación al EditValues", () => {
        render(<BoxStyle />)
        expect(islandProps).not.toBeNull()
        expect(islandProps!.isStage).toBe(true)
        expect(islandProps!.styles).toEqual({ left: "10", "font-size": "30" })
        expect(islandProps!.customValues).toEqual({ "text-align": "center", "align-items": "center" })
        expect(islandProps!.sections.special).toBeTruthy()
    })

    it("envía los cambios de contenido con history", () => {
        render(<BoxStyle />)
        onChange!({ detail: { id: "flash.enabled", value: true, values: { value: true } } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { color: "#00FF00", count: 5, enabled: true }, key: "items", subkey: "flash", keys: ["i1"] }, location: { page: "stage", id: "stage_item_content", override: "st1i1" } }))
    })

    it("traduce textFit en auto y ajusta el tamaño de fuente", () => {
        render(<BoxStyle />)
        onChange!({ detail: { id: "textFit", value: "none", values: { value: "growToFit" } } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: true, key: "items", subkey: "auto", keys: ["i1"] } }))
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { i1: "left: 10px;font-size: 30px;font-size:800px;" }, key: "items", subkey: "style", keys: ["i1"] }, location: { page: "stage", id: "stage_item_content", override: "st1i1" } }))
    })

    it("maneja la alineación por separado del estilo", () => {
        render(<BoxStyle />)
        onChange!({ detail: { id: "style", key: "text-align", value: "left", values: { value: "left" } } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: "left", key: "items", subkey: "alignX", keys: ["i1"] } }))
    })

    it("actualiza los estilos y refresca la salida del stage", () => {
        vi.useFakeTimers()
        render(<BoxStyle />)
        onChange!({ detail: { id: "style", key: "font-size", value: "40px", values: { value: "40px" } } })
        expect(addStyleString).toHaveBeenCalledWith("left: 10px;font-size: 30px;", ["font-size", "40px"])
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { i1: "left: 10px;font-size: 30px;font-size:40px;" }, key: "items", subkey: "style", keys: ["i1"] } }))
        expect(updateStageShow).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(500)
        expect(updateStageShow).toHaveBeenCalledTimes(2)
    })
})
