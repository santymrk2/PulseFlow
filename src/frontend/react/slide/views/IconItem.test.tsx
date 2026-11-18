// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { Item } from "../../../../types/Show"
import { IconItem } from "./IconItem"

afterEach(cleanup)

describe("IconItem", () => {
    it("con_customSvg_inserta_el_svg_y_marca_la_clase_de_color_custom", () => {
        const item = { customSvg: "<svg><path d='M0 0' /></svg>", style: "color: red;" } as Item
        const { container } = render(<IconItem item={item} />)
        expect(container.querySelector("svg path")).toBeTruthy()
        const wrapper = container.querySelector("svg")!.parentElement as HTMLElement
        expect(wrapper.className).toContain("customColor")
    })

    it("sin_customSvg_cae_al_icono_por_id_con_el_zoom_inverso_al_ratio", () => {
        const { container } = render(<IconItem item={{ id: "folder" } as Item} ratio={2} />)
        const svg = container.querySelector("svg") as unknown as HTMLElement
        expect(svg).toBeTruthy()
        expect(svg.style.zoom).toBe("0.5")
    })

    it("sin_color_en_el_style_no_marca_la_clase_de_color_custom", () => {
        const { container } = render(<IconItem item={{ customSvg: "<svg />", style: "font-size: 2em;" } as Item} />)
        expect(container.querySelector("svg")!.parentElement!.className).not.toContain("customColor")
    })
})
