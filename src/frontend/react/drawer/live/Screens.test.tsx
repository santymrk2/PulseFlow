// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { requestMain } from "../../../shared/core/ipc/main"
import { commonMock } from "../../test/mockCommon"
import { Screens } from "./Screens"

vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../utils/common", () => commonMock())
vi.mock("./Capture", () => ({ Capture: ({ screen: item, onClick }: { screen: { id: string; name: string }; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{item.name}</button> }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requestMain).mockResolvedValue([{ id: "s1", name: "Pantalla 1" }] as never)
})
afterEach(() => cleanup())

describe("Screens", () => {
    it("pide la lista de pantallas y avisa al hacer click", async () => {
        const onClick = vi.fn()
        render(<Screens streams={[]} onClick={onClick} />)
        expect(requestMain).toHaveBeenCalledWith(Main.GET_SCREENS)
        const button = await screen.findByText("Pantalla 1")
        fireEvent.click(button)
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ screen: { id: "s1", name: "Pantalla 1" } }))
    })

    it("no muestra nada cuando no hay pantallas", async () => {
        vi.mocked(requestMain).mockResolvedValue(undefined as never)
        const { container } = render(<Screens streams={[]} />)
        await act(async () => {})
        expect(container.querySelector("button")).toBeNull()
    })
})
