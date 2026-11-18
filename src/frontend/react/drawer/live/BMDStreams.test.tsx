// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BLACKMAGIC } from "../../../../types/Channels"
import { destroy, receive, send } from "../../../utils/request"
import { commonMock } from "../../test/mockCommon"
import { BMDStreams } from "./BMDStreams"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
vi.mock("./BMDStream", () => ({ BMDStream: ({ screen: item, onClick }: { screen: { id: string; name: string }; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{item.name}</button> }))

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => cleanup())

describe("BMDStreams", () => {
    it("pide dispositivos, los convierte y avisa al hacer click", () => {
        const onClick = vi.fn()
        const { unmount } = render(<BMDStreams onClick={onClick} />)
        expect(send).toHaveBeenCalledWith(BLACKMAGIC, ["GET_DEVICES"])
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        act(() => receiver.GET_DEVICES(JSON.stringify([{ deviceHandle: "b1", displayName: "DeckLink" }])))
        fireEvent.click(screen.getByText("DeckLink"))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ screen: { id: "b1", name: "DeckLink" } }))
        unmount()
        expect(destroy).toHaveBeenCalledWith(BLACKMAGIC, "GET_DEVICES_RECEIVER")
    })

    it("usa modelName como fallback y muestra empty sin dispositivos", () => {
        render(<BMDStreams />)
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        act(() => receiver.GET_DEVICES(JSON.stringify([{ deviceHandle: "b2", modelName: "Mini" }])))
        expect(screen.getByText("Mini")).toBeTruthy()
        expect(screen.queryByText("[empty.general]")).toBeNull()
    })

    it("muestra empty mientras no llegan dispositivos", () => {
        render(<BMDStreams />)
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })
})
