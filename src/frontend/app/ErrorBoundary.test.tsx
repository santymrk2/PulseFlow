// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ErrorBoundary } from "./ErrorBoundary"

let shouldThrow = true
function Child() {
    if (shouldThrow) throw new Error("boom")
    return <p>hijo ok</p>
}

describe("ErrorBoundary", () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        shouldThrow = true
    })

    it("muestra el panel con el mensaje y Reintentar vuelve a renderizar el hijo", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {})
        render(
            <ErrorBoundary>
                <Child />
            </ErrorBoundary>
        )
        expect(screen.getByRole("alert").textContent).toContain("boom")
        expect(log).toHaveBeenCalled()

        shouldThrow = false
        fireEvent.click(screen.getByText("Reintentar"))
        expect(screen.getByText("hijo ok")).toBeTruthy()
    })
})
