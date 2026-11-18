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

vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../audio/audioChannelRecorder", () => ({ AudioChannelRecorder: {}, stopAllChannelRecordings: () => {}, stopChannelRecording: () => {}, startChannelRecording: () => {}, toggleChannelRecording: () => {}, isChannelRecording: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../components/helpers/historyHelpers", () => ({ _updaters: {}, history: () => {} }))
vi.mock("../../components/actions/apiHelper", () => ({}))
vi.mock("../../utils/save", () => ({}))
vi.mock("../../stores", () => {
    const sub = (value: unknown) => ({ subscribe: (fn: (v: unknown) => void) => (fn(value), () => {}) })
    return {
        livePrepare: sub({}),
        outputs: sub({ o1: { out: {} } }),
        styles: sub({})
    }
})
vi.mock("../hooks/useStore", () => ({ useStore: () => ({ o1: { out: {} } }) }))
vi.mock("../../components/helpers/output", () => ({ getResolution: () => ({ width: 1920, height: 1080 }) }))
vi.mock("../../components/slide/getStyleResolution", () => ({ getStyleResolution: () => "width:100%" }))
vi.mock("../../components/stage/StageLayout.svelte", () => ({ default: {} }))
vi.mock("../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="island" /> }))
vi.mock("../helpers/Icon", () => ({ Icon: () => <span /> }))

import PreviewOutput from "./PreviewOutput"

afterEach(cleanup)

describe("PreviewOutput", () => {
    it("renderiza", () => {
        const { container } = render(<PreviewOutput outputId="o1" />)
        expect(container.querySelector("div")).toBeTruthy()
    })
})
