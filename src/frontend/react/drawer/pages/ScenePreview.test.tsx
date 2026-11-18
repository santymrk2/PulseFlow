// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Scene } from "../../../../types/Show"
import { outputs } from "../../../stores"
import { clearIslands, islands } from "../../test/islandMock"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { ScenePreview } from "./ScenePreview"

vi.mock("../../output/Output", async () => ({ Output: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).makePortMock("Output") }))
vi.mock("../../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

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
