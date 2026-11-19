// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NDI } from "../../../../types/Channels"
import { outputs } from "../../../shared/core/stores"
import { send } from "../../../utils/request"
import { onStreamFrame } from "../../../utils/streamPort"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { commonMock } from "../../test/mockCommon"
import { StreamFrame } from "./StreamFrame"

const mocks = vi.hoisted(() => ({ draw: vi.fn(), destroy: vi.fn(), stop: vi.fn() }))

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
vi.mock("../../../utils/streamPort", () => ({ onStreamFrame: vi.fn(() => mocks.stop) }))
vi.mock("../../../components/drawer/live/streamCanvas", () => ({
    StreamCanvasRenderer: class {
        draw = mocks.draw
        destroy = mocks.destroy
    }
}))
vi.mock("../../../components/helpers/output", () => ({ findMatchingOut: vi.fn(() => "out-1") }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../audio/spectrumAnalyzer", () => ({ SpectrumAnalyzer: class {} }))
vi.mock("../../system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div data-testid="select">{children}</div> }))
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
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("StreamFrame (NDI/OMT)", () => {
    it("recibe el stream, dibuja los frames y libera recursos al desmontar", () => {
        const onClick = vi.fn()
        const { unmount } = render(<StreamFrame channel={NDI} selectId="ndi" icon="ndi" screen={{ id: "n1", name: "NDI 1" }} onClick={onClick} />)
        expect(send).toHaveBeenCalledWith(NDI, ["RECEIVE_STREAM"], { source: { id: "n1", name: "NDI 1" } })
        expect(onStreamFrame).toHaveBeenCalledWith(NDI, expect.any(Function))

        const handler = vi.mocked(onStreamFrame).mock.calls[0][1]
        act(() => {
            handler({ id: "otro", frame: { xres: 2 }, time: 0 })
            handler({ id: "n1", frame: { xres: 2 }, time: 1 })
        })
        expect(mocks.draw).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { xres: 2 })
        expect(screen.getByText("NDI 1")).toBeTruthy()
        fireEvent.click(screen.getByText("NDI 1"))
        expect(onClick).toHaveBeenCalledTimes(1)

        unmount()
        expect(mocks.destroy).toHaveBeenCalledTimes(1)
        expect(mocks.stop).toHaveBeenCalledTimes(1)
    })

    it("en background captura hacia la salida y envía CAPTURE_DESTROY", () => {
        const { unmount } = render(<StreamFrame channel={NDI} selectId="ndi" icon="ndi" screen={{ id: "n1", name: "NDI 1" }} background />)
        expect(send).toHaveBeenCalledWith(NDI, ["CAPTURE_STREAM"], { source: { id: "n1", name: "NDI 1" }, outputId: "out-1" })
        unmount()
        expect(send).toHaveBeenCalledWith(NDI, ["CAPTURE_DESTROY"], { id: "n1", outputId: "out-1" })
    })

    it("respeta mirror en background", () => {
        render(<StreamFrame channel={NDI} selectId="ndi" icon="ndi" screen={{ id: "n1", name: "NDI 1" }} background mirror />)
        expect(send).not.toHaveBeenCalledWith(NDI, ["CAPTURE_STREAM"], expect.any(Object))
    })
})
