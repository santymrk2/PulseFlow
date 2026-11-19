// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { outputs } from "../../../shared/core/stores"
import { findMatchingOut, setOutput } from "../../../components/helpers/output"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { EffectPreview } from "./EffectPreview"

vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/helpers/output", () => ({ findMatchingOut: vi.fn(() => null), setOutput: vi.fn() }))
vi.mock("../../system/HoverPlay", () => ({
    HoverPlay: ({ icon, size, onClick, children }: { icon: string; size?: number; onClick?: () => void; children?: unknown }) => (
        <div data-isla="HoverPlay" data-props={JSON.stringify({ icon, size })}>
            <button data-testid="hover" onClick={onClick} />
            {children as never}
        </div>
    )
}))
vi.mock("../../output/Effect", async () => ({ Effect: (await vi.importActual<typeof import("../../test/islandMock")>("../../test/islandMock")).makePortMock("Effect") }))
vi.mock("../../slide/Zoomed", () => ({ Zoomed: ({ children }: { children: unknown }) => <div data-view="Zoomed">{children as never}</div> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("EffectPreview", () => {
    it("muestra play y envía el efecto a la salida", () => {
        restore = setStoresForTest([looseEntry(outputs, {})])
        const { container, getAllByTestId } = render(<EffectPreview show={{ id: "fx1" } as never} />)
        expect(container.firstElementChild!.className).toContain("effectPreview")
        expect(JSON.parse(container.querySelector('[data-isla="HoverPlay"]')!.getAttribute("data-props")!).icon).toBe("play")
        getAllByTestId("hover")[0].click()
        expect(setOutput).toHaveBeenCalledWith("effects", "fx1", true)
    })

    it("muestra clear cuando ya está en salida", () => {
        vi.mocked(findMatchingOut).mockReturnValue("out1")
        restore = setStoresForTest([looseEntry(outputs, {})])
        const { container } = render(<EffectPreview show={{ id: "fx1" } as never} />)
        expect(JSON.parse(container.querySelector('[data-isla="HoverPlay"]')!.getAttribute("data-props")!).icon).toBe("clear")
    })
})
