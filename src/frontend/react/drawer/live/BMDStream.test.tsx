// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BLACKMAGIC } from "../../../../types/Channels"
import { outputs } from "../../../shared/core/stores"
import { destroy, receive, send } from "../../../shared/utils/request"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { commonMock } from "../../../shared/test/mockCommon"
import { BMDStream } from "./BMDStream"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
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
    vi.stubGlobal(
        "ImageData",
        class {
            constructor(
                public data: unknown,
                public width: number,
                public height: number
            ) {}
        }
    )
    restaurar = setStoresForTest([looseEntry(outputs, { "out-1": {} })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("BMDStream", () => {
    it("pide un frame al montar y destruye el receiver al desmontar", () => {
        const { unmount } = render(<BMDStream screen={{ id: "b1", name: "Cámara BMD" }} />)
        expect(send).toHaveBeenCalledWith(BLACKMAGIC, ["RECEIVE_FRAME"], { source: { id: "b1", name: "Cámara BMD" } })
        expect(receive).toHaveBeenCalledWith(BLACKMAGIC, expect.any(Object), expect.stringMatching(/^b1#\d+$/))
        const receiverId = vi.mocked(receive).mock.calls[0][2]
        unmount()
        expect(destroy).toHaveBeenCalledWith(BLACKMAGIC, receiverId)
    })

    it("en background captura hacia la primera salida y libera el receiver", () => {
        const { unmount } = render(<BMDStream screen={{ id: "b1", name: "BMD" }} background />)
        expect(send).toHaveBeenCalledWith(BLACKMAGIC, ["RECEIVE_STREAM"], { source: { id: "b1", name: "BMD" }, outputId: "out-1" })
        unmount()
        expect(send).toHaveBeenCalledWith(BLACKMAGIC, ["STOP_RECEIVER"], { id: "b1", outputId: "out-1" })
    })

    it("dibuja el frame recibido y reenvía el click", () => {
        const onClick = vi.fn()
        render(<BMDStream screen={{ id: "b1", name: "BMD" }} onClick={onClick} />)
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (data: unknown) => void>
        act(() => {
            receiver.RECEIVE_STREAM({ id: "otro", frame: { video: {} } })
            receiver.RECEIVE_STREAM({ id: "b1", frame: { video: { width: 2, height: 2, data: new Uint8Array(16) } } })
        })
        const canvas = document.querySelector("canvas") as HTMLCanvasElement
        expect(canvas.width).toBe(2)
        fireEvent.click(screen.getByText("BMD"))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
