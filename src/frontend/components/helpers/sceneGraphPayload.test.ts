import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { SceneGraph } from "../../../types/SceneGraph"
import { SCENE_GRAPH_VERSION } from "../../../types/SceneGraph"
import { sceneBackground, sceneGraphPayload, sceneMediaItem, sceneTextItem, sceneTextSpan, sceneTransition } from "./sceneGraphPayload"

/**
 * Fixtures del contrato Scene Graph (F4.2).
 *
 * Los JSON de `src-tauri/tests/fixtures/scene/` los deserializa el engine en
 * `src-tauri/src/render/scene_contract.rs`. Este test los arma con
 * `sceneGraphPayload.ts` —el único módulo que enumera las claves del contrato— y
 * comprueba que los archivos commiteados sigan coincidiendo: renombrar una clave
 * acá rompe este test y, al regenerar los fixtures, también el del engine.
 *
 * Regenerar: `UPDATE_SCENE_FIXTURES=1 bun run test:unit`.
 */
const FIXTURES_DIR = fileURLToPath(new URL("../../../../src-tauri/tests/fixtures/scene/", import.meta.url))

/** Escenas de referencia: cubren todos los campos del contrato, no todos los casos de la app. */
function scenes(): { [name: string]: SceneGraph } {
    return {
        "audience-text": sceneGraphPayload({
            outputId: "audience-1",
            stage: false,
            width: 1920,
            height: 1080,
            background: null,
            items: [
                sceneTextItem({
                    id: "item-0",
                    x: 50,
                    y: 88,
                    width: 1820,
                    height: 904,
                    align: "center",
                    verticalAlign: "center",
                    lineHeight: 1.1,
                    fontFamily: "CMG Sans",
                    fontSize: 96,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: [1, 1, 1, 1],
                    stroke: { color: [0, 0, 0, 1], width: 4 },
                    shadow: { color: [0, 0, 0, 0.7], offsetX: 2, offsetY: 2 },
                    text: "Santo\nSanto",
                    spans: [sceneTextSpan({ text: "Santo", color: [1, 0, 0, 1] }), sceneTextSpan({ text: "\n" }), sceneTextSpan({ text: "Santo", fontStyle: "italic" })]
                })
            ],
            overlays: [],
            transition: sceneTransition({ type: "crossfade", durationMs: 400, easing: "ease-in" }),
            plainText: "Santo\nSanto"
        }),

        "audience-background-video": sceneGraphPayload({
            outputId: "audience-2",
            stage: false,
            width: 1920,
            height: 1080,
            background: sceneBackground({ path: "/media/fondo.mp4", type: "video", fit: "contain", opacity: 0.8, loop: true, muted: true }),
            items: [],
            overlays: [],
            transition: sceneTransition({ type: "fade", durationMs: 500 }),
            plainText: ""
        }),

        "audience-media": sceneGraphPayload({
            outputId: "audience-3",
            stage: false,
            width: 1920,
            height: 1080,
            background: null,
            items: [sceneMediaItem({ id: "media-0", x: 50, y: 100, width: 1820, height: 880, src: "/media/imagen.png", mediaType: "image", fit: "contain", opacity: 1 }), sceneMediaItem({ x: 0, y: 0, width: 1920, height: 1080, src: "/media/fondo.mp4", mediaType: "video", fit: "fill", opacity: 0.5 })],
            overlays: [],
            transition: null,
            plainText: ""
        }),

        "audience-overlays": sceneGraphPayload({
            outputId: "audience-4",
            stage: false,
            width: 1920,
            height: 1080,
            background: null,
            items: [
                sceneTextItem({
                    id: "item-0",
                    x: 50,
                    y: 88,
                    width: 1820,
                    height: 904,
                    align: "center",
                    verticalAlign: "center",
                    lineHeight: 1.1,
                    fontSize: 96,
                    fontWeight: 700,
                    color: [1, 1, 1, 1],
                    text: "Slide",
                    spans: []
                })
            ],
            overlays: [
                sceneMediaItem({ id: "overlay-media", x: 160, y: 940, width: 480, height: 140, src: "/media/logo.png", mediaType: "image", fit: "contain", opacity: 0.9 }),
                sceneTextItem({
                    id: "overlay-text",
                    x: 160,
                    y: 88,
                    width: 1600,
                    height: 80,
                    align: "left",
                    verticalAlign: "center",
                    lineHeight: 1.2,
                    fontFamily: "CMG Sans",
                    fontSize: 48,
                    fontWeight: 700,
                    color: [1, 1, 0, 1],
                    text: "Aviso",
                    spans: []
                })
            ],
            transition: null,
            plainText: "Slide"
        }),

        stage: sceneGraphPayload({
            outputId: "stage-1",
            stage: true,
            width: 1280,
            height: 720,
            background: null,
            items: [],
            overlays: [],
            transition: null,
            plainText: "Santo\nSanto",
            nextText: "Digno"
        }),

        cleared: sceneGraphPayload({
            outputId: "audience-2",
            stage: false,
            width: 1920,
            height: 1080,
            background: null,
            items: [],
            overlays: [],
            transition: null,
            plainText: ""
        })
    }
}

describe("sceneGraphPayload (contrato F4.2)", () => {
    it("pone la versión actual del contrato y no deja claves sin valor", () => {
        const scene = scenes()["cleared"]
        expect(scene.version).toBe(SCENE_GRAPH_VERSION)
        expect(Object.keys(scene)).not.toContain("nextText")
    })

    it("coincide con los fixtures que deserializa el engine", () => {
        const update = !!process.env.UPDATE_SCENE_FIXTURES
        if (update) mkdirSync(FIXTURES_DIR, { recursive: true })

        Object.entries(scenes()).forEach(([name, scene]) => {
            const json = `${JSON.stringify(scene, null, 4)}\n`
            if (update) {
                writeFileSync(`${FIXTURES_DIR}${name}.json`, json)
                return
            }
            expect(JSON.parse(readFileSync(`${FIXTURES_DIR}${name}.json`, "utf8")), `fixtures/scene/${name}.json desactualizado: regenerar con UPDATE_SCENE_FIXTURES=1 bun run test:unit`).toEqual(scene)
        })
    })
})
