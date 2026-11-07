import { describe, expect, it } from "vitest"
import { evaluateArithmetic } from "./safeMath"

describe("evaluateArithmetic", () => {
    it("calcula con precedencia y paréntesis", () => {
        expect(evaluateArithmetic("2+3*4")).toBe(14)
        expect(evaluateArithmetic("(2+3)*4")).toBe(20)
        expect(evaluateArithmetic("-3+5")).toBe(2)
        expect(evaluateArithmetic("10/4")).toBe(2.5)
        expect(evaluateArithmetic("7%3")).toBe(1)
        expect(evaluateArithmetic(" 1.5 * 2 ")).toBe(3)
        expect(evaluateArithmetic(".5+.5")).toBe(1)
        expect(evaluateArithmetic("1920/2")).toBe(960)
        expect(evaluateArithmetic("--2")).toBe(2)
    })
    it("devuelve null ante cualquier cosa que no sea aritmética", () => {
        for (const bad of ["", "2+", "alert(1)", "2**3", "((1)", "1)", "1e3", "a+1", "1/0", "0/0", "constructor"]) {
            expect(evaluateArithmetic(bad)).toBeNull()
        }
    })
})
