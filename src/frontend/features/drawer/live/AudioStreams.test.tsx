// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { audioStreams, playingAudio } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { commonMock } from "../../../shared/test/mockCommon"
import { AudioStreams } from "./AudioStreams"

const mocks = vi.hoisted(() => ({ start: vi.fn(() => Promise.resolve(true)) }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioPlayer", () => ({ AudioPlayer: { start: mocks.start } }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../react/main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Loader") }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div data-testid="select">{children}</div> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(audioStreams, { s2: { name: "Stream B", value: "http://b" }, s1: { name: "Stream A", value: "http://a" } }), looseEntry(playingAudio, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioStreams", () => {
    it("lista los streams ordenados por nombre y reproduce el elegido", async () => {
        render(<AudioStreams />)
        const buttons = screen.getAllByRole("button")
        expect(buttons.map((b) => b.textContent)).toEqual(["Stream Ahttp://a", "Stream Bhttp://b"])
        fireEvent.click(buttons[0])
        expect(mocks.start).toHaveBeenCalledWith("http://a", { name: "Stream A" })
        expect(document.querySelector("[data-isla='Loader']")).not.toBeNull()
    })

    it("muestra empty sin streams", () => {
        audioStreams.set({})
        render(<AudioStreams />)
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })
})
