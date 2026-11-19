// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.hoisted(() => {
    class MockAudioContext {
        createAnalyser() {
            return { connect: () => {}, disconnect: () => {}, fftSize: 0, frequencyBinCount: 0, getByteFrequencyData: () => {} }
        }
        createChannelSplitter() {
            return { connect: () => {}, disconnect: () => {} }
        }
        createMediaStreamSource() {
            return { connect: () => {}, disconnect: () => {} }
        }
        get destination() {
            return {}
        }
    }
    for (const target of [globalThis, global]) {
        Object.defineProperty(target, "AudioContext", { value: MockAudioContext, configurable: true, writable: true })
        Object.defineProperty(target, "webkitAudioContext", { value: MockAudioContext, configurable: true, writable: true })
    }
})

vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/audio/audioChannelRecorder", () => ({ AudioChannelRecorder: {}, stopAllChannelRecordings: () => {}, stopChannelRecording: () => {}, startChannelRecording: () => {}, toggleChannelRecording: () => {}, isChannelRecording: () => false }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/utils/helpers/historyHelpers", () => ({ _updaters: {}, history: () => {} }))
vi.mock("../actions/logic/apiHelper", () => ({}))
vi.mock("../../app/wiring/save", () => ({}))
vi.mock("../../shared/core/stores", () => {
    const sub = (value: unknown) => ({ subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) })
    return {
        livePrepare: sub({}),
        outputs: sub({ o1: { out: {} } }),
        styles: sub({})
    }
})
vi.mock("../../shared/ui/hooks/useStore", () => ({ useStore: () => ({ o1: { out: {} } }) }))
vi.mock("../../shared/utils/helpers/output", () => ({ getResolution: () => ({ width: 1920, height: 1080 }) }))
vi.mock("../slide/logic/getStyleResolution", () => ({ getStyleResolution: () => "width:100%" }))
vi.mock("../stage/StageLayout", () => ({ StageLayout: () => <div data-testid="island" /> }))
vi.mock("./Output", () => ({ Output: (props: { outputId: string; mirror: boolean; preview: boolean }) => <div data-testid="output" data-output-id={props.outputId} data-mirror={String(props.mirror)} data-preview={String(props.preview)} /> }))
vi.mock("../../shared/ui/helpers/Icon", () => ({ Icon: () => <span /> }))

import PreviewOutput from "./PreviewOutput"

afterEach(cleanup)

describe("PreviewOutput", () => {
    it("renderiza", () => {
        const { container } = render(<PreviewOutput outputId="o1" />)
        expect(container.querySelector("div")).toBeTruthy()
    })

    it("monta <Output> de la salida en espejo, si no la preview queda negra (F11)", () => {
        const { getByTestId } = render(<PreviewOutput outputId="o1" />)
        const output = getByTestId("output")
        expect(output.dataset).toMatchObject({ outputId: "o1", mirror: "true", preview: "true" })
    })
})
