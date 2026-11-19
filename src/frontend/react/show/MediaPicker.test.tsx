// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { destroyMain, receiveToMain, sendMain } from "../../shared/core/ipc/main"
import { MediaPicker } from "./MediaPicker"

vi.mock("../../shared/core/ipc/main", () => ({ receiveToMain: vi.fn(() => "listener"), destroyMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("MediaPicker", () => {
    it("pide archivos al backend con el filtro y el id", () => {
        const { container } = render(<MediaPicker id="subtitles" filter={{ extensions: ["vtt"] }} multiple />)
        fireEvent.click(container.querySelector("button")!)
        expect(sendMain).toHaveBeenCalledWith("OPEN_FILE", { channel: "MEDIA", id: "subtitles", filter: { extensions: ["vtt"] }, multiple: true })
    })

    it("avisa con una cadena vacía cuando clearOnClick está activo", () => {
        const onPicked = vi.fn()
        const { container } = render(<MediaPicker id="media" clearOnClick onPicked={onPicked} />)
        fireEvent.click(container.querySelector("button")!)
        expect(onPicked).toHaveBeenCalledWith("")
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("entrega un archivo o la lista según multiple y libera el listener", () => {
        const onPicked = vi.fn()
        const { unmount, rerender } = render(<MediaPicker id="media" onPicked={onPicked} />)
        const callback = vi.mocked(receiveToMain).mock.calls[0]![1]
        callback({ channel: "MEDIA", id: "otro", files: ["x"] } as never)
        expect(onPicked).not.toHaveBeenCalled()
        callback({ channel: "MEDIA", id: "media", files: ["a", "b"] } as never)
        expect(onPicked).toHaveBeenCalledWith("a")

        rerender(<MediaPicker id="media" multiple onPicked={onPicked} />)
        const callbackMultiple = vi.mocked(receiveToMain).mock.calls[1]![1]
        callbackMultiple({ channel: "MEDIA", id: "media", files: ["a", "b"] } as never)
        expect(onPicked).toHaveBeenLastCalledWith(["a", "b"])

        unmount()
        expect(destroyMain).toHaveBeenCalledWith("listener")
    })
})
