// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../IPC/main"
import { commonMock } from "../../test/mockCommon"
import { Windows } from "./Windows"

vi.mock("../../../IPC/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("./Capture", () => ({ Capture: ({ screen: item, onClick }: { screen: { id: string; name: string }; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{item.name}</button> }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requestMain).mockResolvedValue([{ id: "w1", name: "Ventana 1" }] as never)
})
afterEach(() => cleanup())

describe("Windows", () => {
    it("pide la lista de ventanas y avisa al hacer click", async () => {
        const onClick = vi.fn()
        render(<Windows streams={[]} onClick={onClick} />)
        expect(requestMain).toHaveBeenCalledWith(Main.GET_WINDOWS)
        fireEvent.click(await screen.findByText("Ventana 1"))
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ screen: { id: "w1", name: "Ventana 1" } }))
    })

    it("muestra el empty general sin ventanas", async () => {
        vi.mocked(requestMain).mockResolvedValue([] as never)
        const { container } = render(<Windows streams={[]} />)
        await act(async () => {})
        expect(screen.getByText("[empty.general]")).toBeTruthy()
        expect(container.querySelector("button")).toBeNull()
    })
})
