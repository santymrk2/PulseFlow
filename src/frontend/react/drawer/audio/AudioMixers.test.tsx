// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioRoutingManager } from "../../../audio/routing/audioRoutingManager"
import { audioRouting, outputs } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { AudioMixers } from "./AudioMixers"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/routing/audioRoutingManager", () => ({
    AudioRoutingManager: { sortChannels: vi.fn((config) => config) }
}))
vi.mock("./AudioChannelMixer", () => ({
    AudioChannelMixer: ({ channelId, label }: { channelId: string; label: string }) => <div>{`${channelId}:${label}`}</div>
}))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([
        storeEntry(audioRouting, {
            channels: [
                { id: "main", name: "Principal" },
                { id: "channel_out1", name: "Monitor" }
            ],
            connections: []
        } as never),
        storeEntry(outputs, { out1: { enabled: false } } as never)
    ])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioMixers", () => {
    it("muestra los canales activos", () => {
        render(<AudioMixers />)
        expect(screen.getByText("main:Principal")).toBeTruthy()
    })

    it("oculta los canales de outputs deshabilitados", () => {
        render(<AudioMixers />)
        expect(screen.queryByText("channel_out1:Monitor")).toBeNull()
    })

    it("usa el canal main por defecto cuando no hay configuración", () => {
        audioRouting.set(null as never)
        render(<AudioMixers />)
        expect(AudioRoutingManager.sortChannels).toHaveBeenCalled()
        expect(screen.getByText("main:audio.main")).toBeTruthy()
    })
})
