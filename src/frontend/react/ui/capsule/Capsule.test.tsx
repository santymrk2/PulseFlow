// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Capsule } from "./Capsule"

afterEach(() => cleanup())

describe("Capsule", () => {
    it("renderiza_los_botones_de_adentro", () => {
        render(
            <Capsule>
                <button>Buscar</button>
            </Capsule>
        )
        expect(screen.getByRole("button", { name: "Buscar" }).parentElement?.getAttribute("data-slot")).toBe("capsule")
    })

    it("recibe_className_extra", () => {
        const { container } = render(<Capsule className="extra">x</Capsule>)
        expect(container.querySelector("[data-slot=capsule]")?.classList.contains("extra")).toBe(true)
    })
})
