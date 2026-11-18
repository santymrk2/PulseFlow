// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, stageShows } from "../../../stores"
import { addFilterString } from "../../../components/edit/scripts/textStyle"
import { history } from "../../../components/helpers/history"
import { percentageToAspectRatio, stylePosToPercentage } from "../../../components/helpers/output"
import { updateStageShow } from "../../../components/stage/stage"
import { ItemStyle } from "./ItemStyle"

type ChangeEvent = { detail: { id: string; key?: string; type?: string; value: unknown; values: { value: unknown } } }
type EditValuesProps = { sections: Record<string, { inputs: { id: string; hidden?: boolean }[][] }>; styles: Record<string, string>; item: unknown; isStage: boolean }
let islandProps: EditValuesProps | null = null
let onChange: ((event: ChangeEvent) => void) | null = null

vi.mock("../../../stores", () => {
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
    const known: Record<string, unknown> = { activeStage: makeStore({ id: "st1", items: ["i1"] }), stageShows: makeStore({}) }
    // Los módulos transitivos piden stores de otras áreas: se les devuelve uno vacío en vez de cargar los reales (evita ciclos).
    return new Proxy(known, {
        get(target, prop: string) {
            if (!(prop in target)) target[prop] = makeStore({})
            return target[prop]
        }
    })
})
vi.mock("../../../components/edit/scripts/textStyle", () => ({
    addStyleString: vi.fn((style: string, [key, value]) => `${style}${key}:${String(value)};`),
    addFilterString: vi.fn((oldFilter: string, [key, value]) => `${oldFilter}${key}(${String(value)})`)
}))
vi.mock("../../../components/edit/values/item", () => ({
    itemSections: {
        shape_outside: { inputs: [[]] },
        transform: { inputs: [[{ id: "perspective", hidden: false }]] }
    }
}))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../components/helpers/output", () => ({
    percentageToAspectRatio: vi.fn((input: unknown) => input),
    stylePosToPercentage: vi.fn((data: Record<string, string>) => ({
        ...data,
        left: String((Number(data.left) / 1920) * 100),
        top: String((Number(data.top) / 1080) * 100)
    }))
}))
vi.mock("../../../components/helpers/style", () => ({
    getStyles: vi.fn((style: string, removeTxt = false) => {
        const result: Record<string, string> = {}
        for (const declaration of (style || "").split(";")) {
            const [key, value] = declaration.split(":")
            if (!key?.trim() || !value) continue
            const text = value.trim()
            const keepText = ["color", "background", "text-decoration", "text-transform", "text-shadow", "box-shadow", "font-family", "transform", "shape-outside"].some((d) => key.includes(d))
            result[key.trim()] = removeTxt && !keepText ? text.replace(/[^0-9.-]/g, "") : text
        }
        return result
    })
}))
vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/stage/stage", () => ({ updateStageShow: vi.fn() }))
vi.mock("../../../components/edit/tools/EditValues.svelte", () => ({ default: () => null }))
vi.mock("../../bridge/SvelteIsland", () => ({
    SvelteIsland: ({ props, events }: { props: EditValuesProps; events: { change: (event: ChangeEvent) => void } }) => {
        islandProps = props
        onChange = events.change
        return null
    }
}))

const stageItem = {
    id: "i1",
    type: "text",
    style: "left: 100px;top: 50px;width: 200px;height: 100px;backdrop-filter: blur(5px);transform: rotateY(10deg);"
}

beforeEach(() => {
    activeStage.set({ id: "st1", items: ["i1"] } as never)
    stageShows.set({ st1: { items: { i1: stageItem } } } as never)
    islandProps = null
    onChange = null
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe("ItemStyle", () => {
    it("pasa las secciones sin shape_outside, el item y los estilos en porcentaje al EditValues", () => {
        render(<ItemStyle />)
        expect(islandProps).not.toBeNull()
        expect(islandProps!.isStage).toBe(true)
        expect(islandProps!.sections.shape_outside).toBeUndefined()
        expect(islandProps!.sections.transform.inputs[0][0].hidden).toBe(true)
        expect(islandProps!.styles.left).toBe(String((100 / 1920) * 100))
        expect(islandProps!.styles.top).toBe(String((50 / 1080) * 100))
        expect(islandProps!.item).toEqual(stageItem)
        expect(stylePosToPercentage).toHaveBeenCalled()
    })

    it("muestra la perspectiva cuando el transform tiene rotateX distinto de cero", () => {
        stageShows.set({ st1: { items: { i1: { ...stageItem, style: "transform: rotateX(10deg) rotateY(5deg);" } } } } as never)
        render(<ItemStyle />)
        expect(islandProps!.sections.transform.inputs[0][0].hidden).toBe(false)
    })

    it("convierte posiciones relativas y guarda el estilo con history", () => {
        vi.useFakeTimers()
        render(<ItemStyle />)
        onChange!({ detail: { id: "style", key: "left", type: "number", value: "50", values: { value: "50" } } })
        expect(percentageToAspectRatio).toHaveBeenCalledWith(expect.objectContaining({ relative: true, input: "number" }))
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { data: { i1: `${stageItem.style}left:50;` }, key: "items", subkey: "style", keys: ["i1"] },
            oldData: { id: "st1" },
            location: { page: "stage", id: "stage_item_style", override: "st1i1" }
        })
        expect(updateStageShow).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(500)
        expect(updateStageShow).toHaveBeenCalledTimes(2)
    })

    it("compone los filtros backdrop-filter y transform sobre el valor previo", () => {
        render(<ItemStyle />)
        onChange!({ detail: { id: "backdrop-filter", key: "brightness", type: "number", value: 0.5, values: { value: 0.5 } } })
        expect(addFilterString).toHaveBeenCalledWith("blur(5px)", ["brightness", 0.5])
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { i1: `${stageItem.style}backdrop-filter:blur(5px)brightness(0.5);` }, key: "items", subkey: "style", keys: ["i1"] } }))
    })

    it("escribe un gradiente en background en vez de background-color", () => {
        render(<ItemStyle />)
        onChange!({ detail: { id: "style", key: "background-color", type: "color", value: "linear-gradient(red, blue)", values: { value: "linear-gradient(red, blue)" } } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { i1: `${stageItem.style}background:linear-gradient(red, blue);` }, key: "items", subkey: "style", keys: ["i1"] } }))
    })

    it("usa el valor literal para el CSS personalizado", () => {
        render(<ItemStyle />)
        onChange!({ detail: { id: "CSS_text", type: "text", value: "color:red;", values: { value: "color:red;" } } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: { i1: "color:red;" }, key: "items", subkey: "style", keys: ["i1"] } }))
    })
})
