// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { sendMain } from "../../../shared/core/ipc/main"
import { outputs } from "../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { commonMock } from "../../../shared/test/mockCommon"
import { Capture } from "./Capture"

const mocks = vi.hoisted(() => ({ getUserMedia: vi.fn(), stop: vi.fn() }))
vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/utils/helpers/output", () => ({ findMatchingOut: vi.fn(() => "out-1") }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div data-testid="select">{children}</div> }))
vi.mock("../Card", () => ({
    Card: ({ label, onClick, children }: { label: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; children?: ReactNode }) => (
        <button onClick={onClick}>
            {label}
            {children}
        </button>
    )
}))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(outputs, { "out-1": {} })])
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } })
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true, writable: true, value: null })
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] })
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("Capture", () => {
    it("captura la pantalla, guarda el stream en el array compartido y reenvía el click", async () => {
        const streams: MediaStream[] = []
        const onClick = vi.fn()
        render(<Capture screen={{ id: "screen-1", name: "Pantalla" }} streams={streams} onClick={onClick} />)
        await act(async () => {})
        expect(mocks.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.any(Object) }))
        expect(streams).toHaveLength(1)
        expect(screen.getByText("Pantalla")).toBeTruthy()
        fireEvent.click(screen.getByText("Pantalla"))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("muestra el video directo en background", () => {
        const { container } = render(<Capture screen={{ id: "screen-1", name: "Pantalla" }} streams={[]} background />)
        expect(container.querySelector("video")).toBeTruthy()
        expect(mocks.getUserMedia).toHaveBeenCalledTimes(1)
    })

    it("pide permiso y reintenta cuando falla la captura", async () => {
        vi.useFakeTimers()
        mocks.getUserMedia.mockRejectedValue({ name: "NotAllowedError", message: "denegado" })
        vi.spyOn(console, "error").mockImplementation(() => {})
        render(<Capture screen={{ id: "screen-1", name: "Pantalla" }} streams={[]} />)
        await act(async () => {})
        expect(sendMain).toHaveBeenCalledWith(Main.ACCESS_SCREEN_PERMISSION)
        act(() => vi.advanceTimersByTime(5000))
        expect(mocks.getUserMedia).toHaveBeenCalledTimes(2)
        vi.useRealTimers()
    })
})
