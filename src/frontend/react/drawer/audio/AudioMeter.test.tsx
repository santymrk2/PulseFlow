// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeDrawerTab, activePage, audioChannelsData, audioRouting, drawer } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { AudioMeter } from "./AudioMeter"

vi.mock("../../../audio/routing/audioInputCapture", () => ({
    AudioInputCapture: { getInstance: () => ({ getVisualizerData: vi.fn(() => undefined) }) }
}))
vi.mock("../../../shared/utils/common", () => ({ ...commonMock(), DEFAULT_DRAWER_HEIGHT: 300 }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn(() => 1)
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    restaurar = setStoresForTest([looseEntry(audioChannelsData, {}), looseEntry(audioRouting, { channels: [], connections: [] }), looseEntry(drawer, { height: 300, stored: null }), looseEntry(activePage, "show"), looseEntry(activeDrawerTab, "media")])
})

afterEach(() => {
    cleanup()
    restaurar()
    vi.unstubAllGlobals()
})

describe("AudioMeter", () => {
    it("renderiza el medidor", () => {
        const { container } = render(<AudioMeter channelId="main" />)
        expect(container.querySelector("[class*='background']")).not.toBeNull()
    })

    it("muestra la barra de sidechain cuando hay una conexión", () => {
        audioRouting.set({ channels: [], connections: [{ to: "main", type: "sidechain" }] } as never)
        render(<AudioMeter channelId="main" />)
        expect(document.querySelector("[data-title*='sidechain']")).not.toBeNull()
    })

    it("no muestra sidechain sin conexión", () => {
        render(<AudioMeter channelId="main" />)
        expect(document.querySelector("[data-title*='sidechain']")).toBeNull()
    })

    it("detailed muestra la escala en dB", () => {
        render(<AudioMeter channelId="main" detailed />)
        expect(screen.getByText("-60")).toBeTruthy()
        expect(screen.getByText("0")).toBeTruthy()
    })

    it("preview cambia a la pestaña de audio al hacer click", () => {
        const { container } = render(<AudioMeter channelId="main" preview />)
        fireEvent.click(container.querySelector("[class*='background']") as Element)
        expect(get(activeDrawerTab)).toBe("audio")
    })
})
