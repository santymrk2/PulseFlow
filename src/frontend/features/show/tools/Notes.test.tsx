// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Notes } from "./Notes"

vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe("Notes", () => {
    it("debe actualizar el valor y avisar de la edición con debounce", () => {
        vi.useFakeTimers()
        const onEdit = vi.fn()
        const { container } = render(<Notes value="" onEdit={onEdit} placeholder="Escribe" />)
        const textarea = container.querySelector("textarea")!
        expect(textarea.placeholder).toBe("Escribe")
        fireEvent.input(textarea, { target: { value: "Hola" } })
        vi.advanceTimersByTime(100)
        expect(onEdit).toHaveBeenCalledWith("Hola")
    })

    it("respeta disabled y avisa del cambio al perder el foco", () => {
        vi.useFakeTimers()
        const onChange = vi.fn()
        const { container } = render(<Notes value="Texto" disabled lines={2} onChange={onChange} />)
        const textarea = container.querySelector("textarea")!
        expect(textarea.disabled).toBe(true)
        expect(Number(textarea.rows)).toBe(2)
        fireEvent.blur(textarea)
        vi.advanceTimersByTime(1)
        expect(onChange).toHaveBeenCalledWith("Texto")
    })
})
