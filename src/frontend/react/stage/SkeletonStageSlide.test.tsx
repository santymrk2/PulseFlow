// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { outputs } from "../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { SkeletonStageSlide } from "./SkeletonStageSlide"

vi.mock("../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../shared/utils/helpers/output", () => ({
    getStageOutputId: vi.fn(() => "stage1"),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(outputs, { stage1: { id: "stage1", active: true } })])
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

const layout = (extra: Record<string, unknown> = {}) => ({ id: "l1", name: "Escenario", items: [], settings: {}, ...extra }) as never

describe("SkeletonStageSlide", () => {
    it("renderiza el nombre, la proporción y el ancho según columnas", () => {
        const { container } = render(<SkeletonStageSlide layout={layout()} columns={4} />)
        expect(container.textContent).toContain("Escenario")
        expect((container.querySelector(".main") as HTMLElement).getAttribute("style")).toContain("width: 25%")
        expect((container.querySelector(".preview") as HTMLElement).getAttribute("style")).toContain("aspect-ratio: 1920 / 1080")
        expect((container.querySelector(".preview") as HTMLElement).getAttribute("style")).toContain("background-color: transparent")
    })

    it("marca active, list, disabled y password", () => {
        const { container } = render(<SkeletonStageSlide layout={layout({ disabled: true, password: "1234", settings: { color: "red" } })} active list />)
        const main = container.querySelector(".main") as HTMLElement
        expect(main.className).toContain("active")
        expect(main.className).toContain("list")
        expect(container.querySelector(".slide")!.className).toContain("disabled")
        expect(container.querySelector("[data-title='remote.password']")).toBeTruthy()
        expect((container.querySelector(".slide") as HTMLElement).getAttribute("style")).toContain("background-color: red")
    })

    it("muestra guion cuando no hay nombre y propaga el clic", () => {
        const onClick = vi.fn()
        const { container } = render(<SkeletonStageSlide layout={layout({ name: "" })} onClick={onClick} />)
        expect(container.textContent).toContain("—")
        fireEvent.click(container.querySelector(".main")!)
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
