import { describe, expect, it } from "vitest"
import { shouldResendForVideo, videoStateKey, videoSyncFields } from "./videoSync"

describe("videoStateKey", () => {
    it("es ruta_salida, la clave con la que el webview guarda el estado", () => {
        expect(videoStateKey("/m/clip.mp4", "out1")).toBe("/m/clip.mp4_out1")
    })
})

describe("videoSyncFields", () => {
    it("es vacío sin estado", () => {
        expect(videoSyncFields(undefined)).toEqual({})
    })

    it("pasa la posición en ms y la pausa sólo si es true", () => {
        expect(videoSyncFields({ currentTime: 1.5, duration: 3, paused: true, loop: false, muted: false })).toEqual({ paused: true, positionMs: 1500 })
        expect(videoSyncFields({ currentTime: 1.5, duration: 3, paused: false, loop: false, muted: false })).toEqual({ positionMs: 1500 })
    })
})

describe("shouldResendForVideo", () => {
    const playing = { positionMs: 1000 }

    it("reenvía al cambiar la pausa", () => {
        expect(shouldResendForVideo(playing, { paused: true, positionMs: 1000 }, 0, 100)).toBe(true)
        expect(shouldResendForVideo({ paused: true, positionMs: 1000 }, playing, 0, 100)).toBe(true)
    })

    it("no reenvía a los 400 ms sin cambios y sí a los 1000 ms", () => {
        expect(shouldResendForVideo(playing, { positionMs: 1400 }, 0, 400)).toBe(false)
        expect(shouldResendForVideo(playing, { positionMs: 2000 }, 0, 1000)).toBe(true)
    })

    it("sin posición no reenvía por tiempo", () => {
        expect(shouldResendForVideo({}, {}, 0, 5000)).toBe(false)
    })
})
