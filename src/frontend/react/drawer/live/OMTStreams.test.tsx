// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OMT } from "../../../../types/Channels"
import { destroy, receive, send } from "../../../utils/request"
import { commonMock } from "../../test/mockCommon"
import { OMTStreams } from "./OMTStreams"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).makePortMock("Loader") }))
vi.mock("./OMTStream", () => ({ OMTStream: ({ screen: item, onClick }: { screen: { id: string; name: string }; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{item.name}</button> }))

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => cleanup())

describe("OMTStreams", () => {
    it("pide la lista al montar y cada 3 segundos", () => {
        vi.useFakeTimers()
        const { unmount } = render(<OMTStreams />)
        expect(send).toHaveBeenCalledTimes(1)
        act(() => vi.advanceTimersByTime(3000))
        expect(send).toHaveBeenCalledTimes(2)
        unmount()
        act(() => vi.advanceTimersByTime(3000))
        expect(send).toHaveBeenCalledTimes(2)
        expect(destroy).toHaveBeenCalledWith(OMT, "OMT_CAPTURE")
        vi.useRealTimers()
    })

    it("deduplica la lista y avisa al hacer click", () => {
        const onClick = vi.fn()
        render(<OMTStreams onClick={onClick} />)
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        const message = JSON.stringify([{ name: "OMT 1", urlAddress: "omt://1" }])
        act(() => receiver.RECEIVE_LIST(message))
        act(() => receiver.RECEIVE_LIST(message))
        expect(screen.getAllByText("OMT 1")).toHaveLength(1)
        fireEvent.click(screen.getByText("OMT 1"))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ screen: { id: "omt://1", name: "OMT 1" } }))
    })

    it("muestra empty cuando la lista llega vacía", () => {
        render(<OMTStreams />)
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        act(() => receiver.RECEIVE_LIST("[]"))
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })
})
