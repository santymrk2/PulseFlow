// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { Item } from "../../../../types/Show"
import { QrCode } from "./QrCode"

afterEach(cleanup)

const item = (qr_code: unknown) => ({ qr_code }) as Item

describe("QrCode", () => {
    it("sin_texto_y_sin_edit_no_renderiza_nada", () => {
        const { container } = render(<QrCode item={item({ text: "" })} />)
        expect(container.querySelector("svg")).toBeNull()
    })

    it("sin_texto_y_con_edit_muestra_el_icono_vacio", () => {
        const { container } = render(<QrCode item={item({ text: "" })} edit />)
        expect(container.querySelector("svg")).toBeTruthy()
    })

    it("con_texto_genera_un_svg_y_aplica_color_y_fondo", async () => {
        const { container } = render(<QrCode item={item({ text: "https://pulseflow.app", color: "#123456", background: "#abcdef" })} />)
        await act(async () => {})
        const svg = container.querySelector("svg") as unknown as HTMLElement
        expect(svg).toBeTruthy()
        expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet")
        expect(svg.outerHTML).toContain('fill="#123456"')
        expect(svg.outerHTML).toContain('fill="#abcdef"')
    })
})
