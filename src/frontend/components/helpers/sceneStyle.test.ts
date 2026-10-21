import { describe, expect, it } from "vitest"
import { applyTextTransform, parseCssColor, parseItemBox, parseTextAlign, parseTextShadow, parseTextStyle, parseVerticalAlign } from "./sceneStyle"

describe("sceneStyle", () => {
    it("parses hex and rgb colors", () => {
        expect(parseCssColor("#FF0000")).toEqual([1, 0, 0, 1])
        expect(parseCssColor("#fff")).toEqual([1, 1, 1, 1])
        expect(parseCssColor("rgb(0 0 0 / 0.5)")).toEqual([0, 0, 0, 0.5])
        expect(parseCssColor("rgba(255, 255, 255, 80%)")).toEqual([1, 1, 1, 0.8])
        expect(parseCssColor("nonsense", [0, 0, 0, 1])).toEqual([0, 0, 0, 1])
    })

    it("parses item box in px", () => {
        expect(parseItemBox("top:88px;left:50px;height:904px;width:1820px;", { x: 0, y: 0, width: 1, height: 1 })).toEqual({ x: 50, y: 88, width: 1820, height: 904 })
    })

    it("parses alignment", () => {
        expect(parseTextAlign("text-align: right;")).toBe("right")
        expect(parseTextAlign("")).toBeNull()
        expect(parseVerticalAlign("align-items:flex-end;")).toBe("bottom")
        expect(parseVerticalAlign(undefined)).toBe("center")
    })

    it("parses text shadow", () => {
        expect(parseTextShadow("2px 2px 10px #000000")).toEqual({ color: [0, 0, 0, 1], offsetX: 2, offsetY: 2 })
        expect(parseTextShadow("0 0 0 rgb(0 0 0 / 0)")).toBeNull()
        expect(parseTextShadow("none")).toBeNull()
    })

    it("parses text style", () => {
        const parsed = parseTextStyle("font-family: 'CMG Sans', Arial;font-size: 120px;font-weight: bold;color: #ffff00;line-height: 1.2em;-webkit-text-stroke-width: 3px;-webkit-text-stroke-color: #000000;")
        expect(parsed.fontFamily).toBe("CMG Sans")
        expect(parsed.fontSize).toBe(120)
        expect(parsed.fontWeight).toBe(700)
        expect(parsed.color).toEqual([1, 1, 0, 1])
        expect(parsed.lineHeight).toBe(1.2)
        expect(parsed.strokeWidth).toBe(3)
    })

    it("applies text transform", () => {
        expect(applyTextTransform("hola mundo", "uppercase")).toBe("HOLA MUNDO")
        expect(applyTextTransform("hola mundo", "capitalize")).toBe("Hola Mundo")
        expect(applyTextTransform("Hola", undefined)).toBe("Hola")
    })
})
