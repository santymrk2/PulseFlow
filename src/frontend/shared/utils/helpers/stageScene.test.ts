import { describe, expect, it } from "vitest"
import type { StageItem, StageLayout } from "../../../../types/Stage"
import type { SceneMediaItem, SceneTextItem } from "../../../../types/SceneGraph"
import { buildStageItems, stageItemType, stageTimerId, stageVariableText, type StageContext } from "./stageScene"

const box = (left: number, top: number, width: number, height: number) => `left:${left}px;top:${top}px;width:${width}px;height:${height}px;font-size:60px;color:#ffeb3b;`

const layout = (items: { [key: string]: StageItem }, settings: StageLayout["settings"] = {}): StageLayout => ({ name: "Stage", settings, items })

const ctx = (extra: Partial<StageContext> = {}): StageContext => ({
    resolution: { width: 1920, height: 1080 },
    slideTexts: ["uno", "dos", "tres"],
    slideNotes: ["nota 1", "nota 2", "nota 3"],
    currentIndex: 0,
    clockText: "10:30:15",
    timerTexts: {},
    variableTexts: {},
    trackerText: null,
    ...extra
})

const four = (): StageLayout =>
    layout({
        a: { type: "slide_text", style: box(40, 40, 1000, 400), align: "", auto: false },
        b: { type: "slide_text", slideOffset: 1, style: box(40, 500, 1000, 300), align: "", auto: false },
        c: { type: "clock", style: box(1400, 20, 500, 100), align: "", auto: false },
        d: { type: "slide_notes", style: box(40, 850, 1840, 200), align: "", auto: false }
    })

const texts = (items: unknown[]) => items as SceneTextItem[]

describe("buildStageItems", () => {
    it("dibuja actual, siguiente, reloj y notas con su texto y su caja", () => {
        const items = texts(buildStageItems(four(), ctx()))
        expect(items.map((i) => i.text)).toEqual(["uno", "dos", "10:30:15", "nota 1"])
        expect(items[0]).toMatchObject({ type: "text", x: 40, y: 40, width: 1000, height: 400, fontSize: 60, color: [1, 235 / 255, 59 / 255, 1] })
        expect(items[1]).toMatchObject({ x: 40, y: 500, width: 1000, height: 300 })
        expect(items[2]).toMatchObject({ x: 1400, y: 20, live: true })
        expect(items[0].live).toBeUndefined()
        expect(items[0].spans.map((s) => s.text).join("")).toBe("uno")
    })

    it("la última slide no genera el ítem de la siguiente", () => {
        const items = texts(buildStageItems(four(), ctx({ currentIndex: 2 })))
        expect(items.map((i) => i.text)).toEqual(["tres", "10:30:15", "nota 3"])
    })

    it("un ítem con enabled false no aparece", () => {
        const l = four()
        l.items.c.enabled = false
        expect(texts(buildStageItems(l, ctx())).map((i) => i.text)).toEqual(["uno", "dos", "nota 1"])
    })

    it("labels true suma un texto de 28 px con labelColor pegado arriba de la caja", () => {
        const l = four()
        l.settings = { labels: true, labelColor: "#ff0000" }
        l.items.c.label = "Reloj"
        const items = texts(buildStageItems(l, ctx()))
        const label = items.find((i) => i.text === "Reloj")
        expect(label).toMatchObject({ fontSize: 28, color: [1, 0, 0, 1], x: 1400, width: 500 })
        expect(label!.y + label!.height).toBe(20)
        expect(items.indexOf(label!)).toBe(items.findIndex((i) => i.text === "10:30:15") + 1)
    })

    it("sin labels no hay etiquetas aunque el ítem tenga label", () => {
        const l = four()
        l.items.c.label = "Reloj"
        expect(buildStageItems(l, ctx())).toHaveLength(4)
    })

    it("slide_text con lineCount deja sólo esas líneas", () => {
        const l = layout({ a: { type: "slide_text", lineCount: 2, style: box(0, 0, 900, 300), align: "", auto: false } })
        expect(texts(buildStageItems(l, ctx({ slideTexts: ["l1\nl2\nl3"] })))[0].text).toBe("l1\nl2")
    })

    it("deduce el tipo por la clave cuando falta item.type", () => {
        expect(stageItemType("current_slide_text", { style: "", align: "" })).toBe("slide_text")
        expect(stageItemType("next_slide", { style: "", align: "" })).toBe("slide_text")
        expect(stageItemType("slide_tracker", { style: "", align: "" })).toBe("slide_tracker")
        expect(stageItemType("clock", { style: "", align: "" })).toBe("clock")
        expect(stageItemType("variables#v1", { style: "", align: "" })).toBe("variable")
        expect(stageItemType("timers#t1", { style: "", align: "" })).toBe("timer")
        expect(stageItemType("x", { type: "timer", style: "", align: "" })).toBe("timer")
    })

    it("un ítem sin tipo cuya clave es next_slide usa la slide siguiente", () => {
        const l = layout({ next_slide: { style: box(0, 0, 900, 300), align: "", auto: false } })
        expect(texts(buildStageItems(l, ctx()))[0].text).toBe("dos")
    })

    it("timer, variable y tracker toman su texto del contexto", () => {
        const l = layout({
            t: { type: "timer", timer: { id: "t1" }, style: box(0, 0, 400, 100), align: "", auto: false },
            v: { type: "variable", variable: { id: "v1" }, style: box(0, 100, 400, 100), align: "", auto: false },
            s: { type: "slide_tracker", style: box(0, 200, 400, 100), align: "", auto: false }
        })
        const items = texts(buildStageItems(l, ctx({ timerTexts: { t1: "05:00" }, variableTexts: { v1: "Hola" }, trackerText: "1/3" })))
        expect(items.map((i) => i.text)).toEqual(["05:00", "Hola", "1/3"])
        expect(items.map((i) => i.live)).toEqual([true, true, undefined])
    })

    it("text con lines dibuja el texto fijo; sin texto no se dibuja", () => {
        const l = layout({
            a: { type: "text", lines: [{ align: "", text: [{ style: "", value: "Bienvenidos" }] }], style: box(0, 0, 900, 100), align: "", auto: false },
            b: { type: "text", lines: [], style: box(0, 100, 900, 100), align: "", auto: false }
        })
        expect(texts(buildStageItems(l, ctx())).map((i) => i.text)).toEqual(["Bienvenidos"])
    })

    it("media con src es un ítem de medio; un tipo desconocido no dibuja nada", () => {
        const l = layout({
            m: { type: "media", src: "/m/logo.png", style: box(10, 20, 300, 200), align: "" },
            z: { type: "current_output", style: box(0, 0, 100, 100), align: "" }
        })
        const items = buildStageItems(l, ctx())
        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({ type: "media", src: "/m/logo.png", mediaType: "image", x: 10, y: 20, width: 300, height: 200 } satisfies Partial<SceneMediaItem>)
    })

    it("el texto con autoajuste entra en la caja y crece al haber menos texto", () => {
        const l = layout({ a: { type: "slide_text", style: "left:0px;top:0px;width:1000px;height:300px;font-size:800px;", align: "" } })
        const corto = texts(buildStageItems(l, ctx({ slideTexts: ["Hola"] })))[0]
        const largo = texts(buildStageItems(l, ctx({ slideTexts: ["Una frase bastante larga que ocupa muchas más líneas dentro de la misma caja del stage"] })))[0]
        expect(corto.fontSize).toBeGreaterThan(largo.fontSize)
        expect(corto.fontSize).toBeLessThanOrEqual(300)
        expect(largo.fontSize).toBeGreaterThanOrEqual(8)
    })

    it("sin ítems devuelve una lista vacía", () => {
        expect(buildStageItems(layout({}), ctx())).toEqual([])
    })

    it("cada reloj usa su propio texto y uno sin texto (analógico) no se dibuja", () => {
        const l = layout({
            a: { type: "clock", style: box(0, 0, 400, 100), align: "", auto: false },
            b: { type: "clock", style: box(0, 100, 400, 100), align: "", auto: false },
            c: { type: "clock", style: box(0, 200, 400, 100), align: "", auto: false }
        })
        const items = texts(buildStageItems(l, ctx({ clockTexts: { a: "10:30", b: "07/11/2026 10:30:15" } })))
        expect(items.map((i) => i.text)).toEqual(["10:30", "07/11/2026 10:30:15"])
    })

    it("una variable deshabilitada se oculta sólo en el ítem antiguo sin tipo", () => {
        const off = { type: "text", text: "Hola", enabled: false }
        expect(stageVariableText({ style: "", align: "" }, off)).toBe("")
        expect(stageVariableText({ type: "variable", style: "", align: "" }, off)).toBe("Hola")
    })

    it("un timer con tipo y sin id cae en el primer activo o no contador", () => {
        const typed: StageItem = { type: "timer", style: "", align: "" }
        expect(stageTimerId("t", typed, "act", "nc")).toBe("act")
        expect(stageTimerId("t", typed, undefined, "nc")).toBe("nc")
        expect(stageTimerId("t", { ...typed, timer: { id: "mio" } }, "act", "nc")).toBe("mio")
        expect(stageTimerId("timers#x", { style: "", align: "" }, "act", "nc")).toBe("x")
    })
})
