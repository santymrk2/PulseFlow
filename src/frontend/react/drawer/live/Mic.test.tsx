// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent, ReactNode } from "react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../IPC/main"
import { activeFocus, activeShow, focusMode, playingAudio } from "../../../stores"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { commonMock } from "../../test/mockCommon"
import { Mic } from "./Mic"

const mocks = vi.hoisted(() => ({ getUserMedia: vi.fn(), start: vi.fn() }))

// Mic crea un AudioContext para medir el nivel: sin él el botón queda deshabilitado y no llega el doble click.
vi.hoisted(() => {
    const analyser = { smoothingTimeConstant: 0, fftSize: 0, frequencyBinCount: 1, getByteFrequencyData: vi.fn(), connect: vi.fn() }
    vi.stubGlobal(
        "AudioContext",
        class {
            state = "running"
            createMediaStreamSource() {
                return { connect: vi.fn() }
            }
            createAnalyser() {
                return analyser
            }
            close() {
                return Promise.resolve()
            }
        }
    )
    // Evita el loop de requestAnimationFrame del medidor durante el test.
    vi.stubGlobal("requestAnimationFrame", () => 0)
    vi.stubGlobal("cancelAnimationFrame", () => {})
})

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../IPC/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../audio/audioMicrophone", () => ({ AudioMicrophone: { getList: vi.fn(), start: mocks.start } }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ onClick, onDblClick, children, disabled }: { onClick?: (d: { ctrl: boolean }, e: MouseEvent<HTMLButtonElement>) => void; onDblClick?: (d: { ctrl: boolean }, e: MouseEvent<HTMLButtonElement>) => void; children?: ReactNode; disabled?: boolean }) => (
        <button disabled={disabled} onClick={(e) => onClick?.({ ctrl: e.ctrlKey || e.metaKey }, e)} onDoubleClick={(e) => onDblClick?.({ ctrl: e.ctrlKey || e.metaKey }, e)}>
            {children}
        </button>
    )
}))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(playingAudio, {}), looseEntry(focusMode, false), looseEntry(activeFocus, { id: "" }), looseEntry(activeShow, null)])
    mocks.getUserMedia.mockResolvedValue({ getAudioTracks: () => [] } as unknown as MediaStream)
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } })
    vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

const MIC = { id: "m1", name: "Mic 1" }

describe("Mic", () => {
    it("pide permiso cuando el micrófono no es legible", async () => {
        vi.useFakeTimers()
        mocks.getUserMedia.mockRejectedValue({ name: "NotReadableError", message: "denegado" })
        render(<Mic mic={MIC} />)
        await act(async () => {})
        expect(sendMain).toHaveBeenCalledWith(Main.ACCESS_MICROPHONE_PERMISSION)
        act(() => vi.advanceTimersByTime(5000))
        expect(mocks.getUserMedia).toHaveBeenCalledTimes(2)
    })

    it("doble click selecciona el micrófono como audio", async () => {
        render(<Mic mic={MIC} />)
        await act(async () => {})
        fireEvent.doubleClick(screen.getByText("Mic 1"))
        expect(get(activeShow)).toMatchObject({ id: "m1", type: "audio", name: "Mic 1" })
    })

    it("en modo enfoque actualiza activeFocus", async () => {
        focusMode.set(true)
        render(<Mic mic={MIC} />)
        await act(async () => {})
        fireEvent.doubleClick(screen.getByText("Mic 1"))
        expect(get(activeFocus)).toEqual({ id: "m1", type: "audio" })
        expect(get(activeShow)).toBeNull()
    })

    it("muestra el icono muted cuando no está reproduciéndose", () => {
        const { container } = render(<Mic mic={MIC} />)
        expect(container.querySelector("[data-icon='muted']")).toBeTruthy()
    })
})
