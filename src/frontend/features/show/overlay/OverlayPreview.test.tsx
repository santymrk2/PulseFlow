// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { outputs } from "../../../shared/core/stores"
import { findMatchingOut, getActiveOutputs, setOutput } from "../../../shared/utils/helpers/output"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { OverlayPreview } from "./OverlayPreview"

vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../shared/utils/helpers/output", () => ({ findMatchingOut: vi.fn(() => null), getActiveOutputs: vi.fn(() => ["out1"]), setOutput: vi.fn() }))
vi.mock("../../../shared/ui/system/HoverPlay", () => ({
    HoverPlay: ({ icon, size, onClick, children }: { icon: string; size?: number; onClick?: () => void; children?: unknown }) => (
        <div data-isla="HoverPlay" data-props={JSON.stringify({ icon, size })}>
            <button data-testid="hover" onClick={onClick} />
            {children as never}
        </div>
    )
}))
vi.mock("../../../react/output/OutputOverlay", async () => ({ Overlay: (await vi.importActual<typeof import("../../../shared/test/islandMock")>("../../../shared/test/islandMock")).makePortMock("Overlay") }))
vi.mock("../../slide/Zoomed", () => ({ Zoomed: ({ children }: { children: unknown }) => <div data-view="Zoomed">{children as never}</div> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

describe("OverlayPreview", () => {
    it("usa la primera salida activa y muestra la capa", () => {
        restore = setStoresForTest([looseEntry(outputs, {})])
        const { container, getAllByTestId } = render(<OverlayPreview show={{ id: "ov1" } as never} />)
        expect(getActiveOutputs).toHaveBeenCalled()
        expect(container.querySelector("[data-view='Zoomed']")).toBeTruthy()
        getAllByTestId("hover")[0].click()
        expect(setOutput).toHaveBeenCalledWith("overlays", "ov1", true)
    })

    it("muestra clear cuando la capa ya está en salida", () => {
        vi.mocked(findMatchingOut).mockReturnValue("out1")
        restore = setStoresForTest([looseEntry(outputs, { out1: {} })])
        const { container } = render(<OverlayPreview show={{ id: "ov1" } as never} />)
        expect(JSON.parse(container.querySelector('[data-isla="HoverPlay"]')!.getAttribute("data-props")!).icon).toBe("clear")
    })
})
