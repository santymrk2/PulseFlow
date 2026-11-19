// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeTimers, dictionary } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { TimerInfo } from "./TimerInfo"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const dict = {
    media: { play: "Reproducir" },
    actions: { pause_timers: "Pausar temporizadores" }
}

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([
        storeEntry(dictionary, dict),
        storeEntry(activeTimers, [
            { id: "t1", paused: false },
            { id: "t2", paused: true }
        ] as never)
    ])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("TimerInfo", () => {
    it("pausa todos los temporizadores activos", () => {
        render(<TimerInfo />)
        fireEvent.click(screen.getByText("Pausar temporizadores"))
        expect(get(activeTimers).every((timer) => timer.paused)).toBe(true)
    })

    it("con todos pausados ofrece reanudarlos", () => {
        act(() =>
            activeTimers.set([
                { id: "t1", paused: true },
                { id: "t2", paused: true }
            ] as never)
        )
        render(<TimerInfo />)
        fireEvent.click(screen.getByText("Reproducir"))
        expect(get(activeTimers).every((timer) => timer.paused === false)).toBe(true)
    })

    it("con un solo temporizador no muestra el botón", () => {
        act(() => activeTimers.set([{ id: "t1", paused: false }] as never))
        const { container } = render(<TimerInfo />)
        expect(container.querySelector("button")).toBeNull()
    })
})
