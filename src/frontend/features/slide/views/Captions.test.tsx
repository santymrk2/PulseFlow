// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Captions } from "./Captions"

afterEach(cleanup)

describe("Captions", () => {
    it("renderiza_la_previsualizacion_del_item", () => {
        const { container } = render(<Captions item={{ type: "captions" }} />)
        const div = container.firstElementChild as HTMLElement
        expect(div.tagName).toBe("DIV")
        expect(div.textContent).toBe("")
    })
})
