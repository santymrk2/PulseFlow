// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Slide } from "../../../types/Show"
import { outputs, previewOutputId, slidesOptions, styles } from "../../shared/core/stores"
import { looseEntry, storeEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { SkeletonSlide } from "./SkeletonSlide"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const slide = { group: "Culto" } as Slide

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setup(mode = "grid", columns = 4) {
    restore = setStoresForTest([looseEntry(outputs, {}), storeEntry(previewOutputId, ""), looseEntry(styles, {}), storeEntry(slidesOptions, { columns, mode } as never)])
}

describe("SkeletonSlide", () => {
    it("en_modo_grid_calcula_el_ancho_segun_las_columnas", () => {
        setup("grid", 4)
        const { container } = render(<SkeletonSlide slide={slide} index={0} color="#fff" columns={4} />)
        expect((container.firstElementChild as HTMLElement).style.width).toBe("25%")
    })

    it("en_modo_lyrics_muestra_la_etiqueta_con_el_nombre", () => {
        setup("lyrics")
        const { container } = render(<SkeletonSlide slide={slide} index={2} color="#fff" />)
        expect(container.textContent).toContain("Culto")
        expect(container.textContent).toContain("3")
    })

    it("reenvia_el_click_al_padre", () => {
        setup()
        const onClick = vi.fn()
        const { container } = render(<SkeletonSlide slide={slide} index={0} color="#fff" onClick={onClick} />)
        fireEvent.click(container.firstElementChild as HTMLElement)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("aplica_la_clase_active", () => {
        setup()
        const { container } = render(<SkeletonSlide slide={slide} index={0} color="#fff" active />)
        expect(container.firstElementChild?.className).toContain("active")
    })
})
