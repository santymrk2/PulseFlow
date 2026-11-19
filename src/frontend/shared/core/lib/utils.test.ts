import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
    it("une las clases y descarta los valores falsos", () => {
        expect(cn("a", false && "b", "c")).toBe("a c")
    })

    it("no deduplica clases en conflicto (sin tailwind-merge)", () => {
        expect(cn("p-1", "p-2")).toBe("p-1 p-2")
    })
})
