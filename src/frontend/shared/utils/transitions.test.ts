import { describe, expect, it } from "vitest"
import { custom, easings, transitionTypes } from "./transitions"

const node = {} as HTMLElement

describe("utils/transitions sin Svelte", () => {
    it("mantiene los tipos de transición ofrecidos al usuario", () => {
        expect(transitionTypes.map((transition) => transition.id)).not.toContain("crossfade")
        expect(transitionTypes.map((transition) => transition.id)).toContain("fade")
    })

    it("custom aplica duración, delay y easing elegidos", () => {
        const effect = custom(node, { type: "fade", duration: 300, delay: 20, easing: "linear" })
        expect(effect.duration).toBe(300)
        expect(effect.delay).toBe(20)
        expect(effect.easing?.(0.5)).toBe(0.5)
        expect(effect.css?.(1)).toContain("opacity:")
    })

    it("none fuerza duración cero y slide respeta la dirección", () => {
        expect(custom(node, { type: "none", duration: 500 }).duration).toBe(0)
        expect(custom(node, { type: "slide", custom: { direction: "right_left" } }).css?.(0.5)).toContain("translate(50%)")
    })

    it("los easings van de 0 a 1", () => {
        for (const easing of easings) {
            expect(easing.function(0)).toBeCloseTo(0, 5)
            expect(easing.function(1)).toBeCloseTo(1, 5)
        }
    })
})
