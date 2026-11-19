// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Scene } from "../../../../types/Show"
import { outputs } from "../../../shared/core/stores"
import { clearIslands, islands } from "../../../shared/test/islandMock"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { ScenePreview } from "./ScenePreview"

vi.mock("../../../features/output/Output", async () => ({ Output: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Output") }))
vi.mock("../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([
        looseEntry(outputs, {
            screen1: { id: "screen1", name: "Screen 1", enabled: true, type: "normal", out: { id: "screen1", slide: "a" } },
            screen2: { id: "screen2", name: "Screen 2", enabled: true, type: "normal" }
        })
    ])
})
afterEach(() => {
    cleanup()
    restaurar()
    clearIslands()
})

const scene = (bindings?: string[]): Scene => ({ name: "Escena", id: "s1", bindings, content: { style: "style1" } })

describe("ScenePreview", () => {
    it("previsualiza en la primera salida del binding de la escena", () => {
        render(<ScenePreview scene={scene(["screen2"])} />)
        expect(islands.Output.props.outputId).toBe("screen2")
        expect(islands.Output.props.mirror).toBe(true)
        expect(islands.Output.props.style).toBe("width: 100%; height: 100%;")
    })

    it("arma el outOverride con los datos de la escena", () => {
        render(<ScenePreview scene={scene()} />)
        const outOverride = islands.Output.props.outOverride as { scene: { name: string; id: string; style?: string } }
        expect(outOverride.scene).toEqual({ style: "style1", name: "Escena", id: "s1" })
    })

    it("sin bindings usa la primera salida activa", () => {
        render(<ScenePreview scene={scene()} />)
        expect(islands.Output.props.outputId).toBe("screen1")
    })
})
