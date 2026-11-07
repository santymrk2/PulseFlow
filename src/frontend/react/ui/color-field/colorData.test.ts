import { describe, expect, it } from "vitest"
import { BLACK, WHITE } from "./colorData"

describe("colorData", () => {
    it("blanco_y_negro_salen_de_la_paleta_y_no_quedan_vacios", () => {
        expect(WHITE).toBe("#ffffff")
        expect(BLACK).toBe("#000000")
    })
})
