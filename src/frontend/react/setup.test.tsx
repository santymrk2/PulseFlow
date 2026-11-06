// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

function Hola({ nombre }: { nombre: string }) {
    return <p>Hola {nombre}</p>
}

describe("base de React", () => {
    it("renderiza un componente", () => {
        render(<Hola nombre="PulseFlow" />)
        expect(screen.getByText("Hola PulseFlow")).toBeTruthy()
    })
})
