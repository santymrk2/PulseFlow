// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { showsCache } from "../../shared/core/stores"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { getStageTextLayoutOffset } from "../../components/stage/stage"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { SlideNotes } from "./SlideNotes"

vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: vi.fn(() => [{ id: "s1" }]) }))
vi.mock("../../components/stage/stage", () => ({ getStageTextLayoutOffset: vi.fn(() => 0) }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(showsCache, { sh1: { slides: { s1: { notes: "Línea 1\nLínea 2" } } } })])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const currentSlide = { id: "sh1", index: 0 } as never

describe("SlideNotes", () => {
    it("renderiza las notas con saltos de línea convertidos a <br>", () => {
        const { container } = render(<SlideNotes currentSlide={currentSlide} />)
        expect(container.querySelector(".autoFontSize")!.innerHTML).toBe("Línea 1<br>Línea 2")
        expect(getLayoutRef).toHaveBeenCalledWith("sh1")
        expect(getStageTextLayoutOffset).toHaveBeenCalled()
    })

    it("aplica el tamaño automático recibido", () => {
        const { container } = render(<SlideNotes currentSlide={currentSlide} autoSize={42} />)
        expect((container.querySelector(".autoFontSize") as HTMLElement).style.fontSize).toBe("42px")
    })

    it("no renderiza nada si no hay slide", () => {
        restore()
        restore = setStoresForTest([looseEntry(showsCache, { sh1: { slides: {} } })])
        const { container } = render(<SlideNotes currentSlide={currentSlide} />)
        expect(container.firstChild).toBeNull()
    })
})
