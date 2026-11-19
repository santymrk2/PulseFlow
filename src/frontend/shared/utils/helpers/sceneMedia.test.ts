import { describe, expect, test } from "vitest"
import { imagePathsOf } from "./sceneMedia"

const media = (src: string, mediaType: string) => ({ type: "media", src, mediaType })

describe("imagePathsOf", () => {
    test("junta las imágenes de los items en orden y sin repetir", () => {
        const items = [media("/m/a.png", "image"), media("/m/b.jpg", "image"), media("/m/a.png", "image")]
        expect(imagePathsOf(items)).toEqual(["/m/a.png", "/m/b.jpg"])
    })

    test("deja afuera videos, texto y items sin ruta", () => {
        const items = [media("/m/clip.mp4", "video"), { type: "text" }, media("", "image"), { type: "media", mediaType: "image" }]
        expect(imagePathsOf(items)).toEqual([])
    })

    test("las rutas extra (fondos) van primero y tampoco se repiten", () => {
        expect(imagePathsOf([media("/m/a.png", "image")], ["/m/bg.png", "/m/a.png", undefined, null, ""])).toEqual(["/m/bg.png", "/m/a.png"])
    })
})
