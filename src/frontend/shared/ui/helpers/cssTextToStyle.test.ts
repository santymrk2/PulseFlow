import { describe, expect, it } from "vitest"
import { cssTextToStyle } from "./cssTextToStyle"

describe("cssTextToStyle", () => {
    it("convierte propiedades con guion a camelCase", () => {
        expect(cssTextToStyle("background-color: red; font-size: 12px;")).toEqual({ backgroundColor: "red", fontSize: "12px" })
    })

    it("conserva las variables CSS (--nombre) sin camelCase", () => {
        expect(cssTextToStyle("--secondary-text: #f0f0ff; height: calc(100% - 25px);")).toEqual({ "--secondary-text": "#f0f0ff", height: "calc(100% - 25px)" })
    })

    it("ignora declaraciones vacías", () => {
        expect(cssTextToStyle(" ; :: ; color: blue;;")).toEqual({ color: "blue" })
    })
})
