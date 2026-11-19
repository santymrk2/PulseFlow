import { describe, expect, it } from "vitest"
import { markSceneClock, resetSceneClock, scenesHaveClock } from "./sceneClock"

describe("scenesHaveClock", () => {
    it("es falso por defecto", () => {
        resetSceneClock()
        expect(scenesHaveClock()).toBe(false)
    })

    it("es verdadero tras marcar un reloj en la escena", () => {
        resetSceneClock()
        markSceneClock()
        expect(scenesHaveClock()).toBe(true)
    })

    it("vuelve a falso al resetear (escena sin reloj)", () => {
        markSceneClock()
        resetSceneClock()
        expect(scenesHaveClock()).toBe(false)
    })
})
