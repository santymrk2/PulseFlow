// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import OutputTransition from "./OutputTransition"

vi.mock("../../shared/utils/transitions", () => ({ custom: () => ({ duration: 0, delay: 0, css: () => "" }) }))

afterEach(cleanup)

describe("OutputTransition", () => {
    it("renderiza hijos", () => {
        render(
            <OutputTransition transition={{ type: "none", duration: 0 } as unknown as never}>
                <span>contenido</span>
            </OutputTransition>
        )
        expect(screen.getByText("contenido")).toBeTruthy()
    })
})
