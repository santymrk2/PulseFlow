import { describe, expect, it } from "vitest"
import { languageFlags, languages, replace } from "./languageData"

describe("languageData", () => {
    it("F25.6: sólo quedan inglés y español en las tres tablas", () => {
        expect(Object.keys(languages)).toEqual(["en", "es"])
        expect(Object.keys(replace)).toEqual(["en", "es"])
        expect(Object.keys(languageFlags)).toEqual(["en", "es"])
    })
})
