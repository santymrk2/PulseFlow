// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NDI } from "../../../../types/Channels"
import { special } from "../../../stores"
import { destroy, receive, send } from "../../../utils/request"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { commonMock } from "../../test/mockCommon"
import { NDIStreams } from "./NDIStreams"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/request", () => ({ send: vi.fn(), receive: vi.fn(), destroy: vi.fn() }))
vi.mock("../../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).SvelteIslandMock }))
vi.mock("../../../components/main/Loader.svelte", () => ({ default: { isla: "Loader" } }))
vi.mock("./NDIStream", () => ({ NDIStream: ({ screen: item, onClick }: { screen: { id: string; name: string }; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{item.name}</button> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(special, { ndiInputGroups: "public" })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("NDIStreams", () => {
    it("muestra Loader, reenvía los grupos y lista las fuentes", () => {
        const onClick = vi.fn()
        const { unmount } = render(<NDIStreams onClick={onClick} />)
        expect(screen.queryByText("[empty.general]")).toBeNull()
        expect(document.querySelector("[data-isla='Loader']")).toBeTruthy()
        expect(send).toHaveBeenCalledWith(NDI, ["RECEIVE_LIST"], { groups: "public" })

        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        act(() => receiver.RECEIVE_LIST(JSON.stringify([{ name: "Fuente NDI", urlAddress: "ndi://1" }])))
        fireEvent.click(screen.getByText("Fuente NDI"))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ screen: { id: "ndi://1", name: "Fuente NDI" } }))
        unmount()
        expect(destroy).toHaveBeenCalledWith(NDI, "NDI_CAPTURE")
    })

    it("muestra empty cuando la lista llega vacía", () => {
        render(<NDIStreams />)
        const receiver = vi.mocked(receive).mock.calls[0][1] as Record<string, (msg: string) => void>
        act(() => receiver.RECEIVE_LIST("[]"))
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })
})
