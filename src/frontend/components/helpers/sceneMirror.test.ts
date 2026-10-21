import { describe, expect, it } from "vitest"
import { getSceneSourceId } from "./sceneMirror"

describe("getSceneSourceId", () => {
    const outs: any = {
        a: { name: "A", enabled: true },
        b: { name: "B", enabled: true, screenType: "mirror", mirrorOf: "a" },
        c: { name: "C", enabled: true, screenType: "mirror", mirrorOf: "zzz" },
        d: { name: "D", enabled: true, screenType: "single", mirrorOf: "a" }
    }
    it("espejo válido usa la escena de origen", () => expect(getSceneSourceId("b", outs)).toBe("a"))
    it("espejo a una salida inexistente usa la propia", () => expect(getSceneSourceId("c", outs)).toBe("c"))
    it("sin modo espejo usa la propia", () => expect(getSceneSourceId("d", outs)).toBe("d"))
})
