// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { channelSidechainMultipliers } from "../../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../test/storeTestKit"
import { AudioSidechain } from "./AudioSidechain"

vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(channelSidechainMultipliers, { ch1: 0.25, mudo: 1 })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioSidechain", () => {
    it("muestra la reducción en dB del canal", () => {
        const { container } = render(<AudioSidechain channelId="ch1" />)
        const track = container.querySelector("[data-title]")
        expect(track?.getAttribute("data-title")).toContain("audio.sidechain: -12.0 dB")
    })

    it("pinta la barra con el porcentaje de reducción", () => {
        const { container } = render(<AudioSidechain channelId="ch1" />)
        const bar = container.querySelector("[data-title]")?.firstElementChild as HTMLElement
        expect(parseFloat(bar.style.width)).toBeCloseTo((12.04119982655925 / 60) * 100, 1)
    })

    it("sin reducción la barra queda vacía", () => {
        const { container } = render(<AudioSidechain channelId="mudo" />)
        const bar = container.querySelector("[data-title]")?.firstElementChild as HTMLElement
        expect(bar.style.width).toBe("0%")
    })
})
