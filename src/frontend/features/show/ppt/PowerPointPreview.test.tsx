// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, os, outputs, presentationApps, presentationData, special } from "../../../shared/core/stores"
import { sendMain } from "../../../shared/core/ipc/main"
import { getOutputContent } from "../../../shared/utils/helpers/output"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { PowerPointPreview } from "./PowerPointPreview"

vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/core/ipc/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../shared/utils/helpers/media", () => ({ getFileName: (path: string) => path, removeExtension: (name: string) => name }))
vi.mock("../../../shared/utils/helpers/output", () => ({ getOutputContent: vi.fn(() => ({})), getActiveOutputs: vi.fn(() => ["out1"]), setOutput: vi.fn() }))
vi.mock("../../output/logic/clear", () => ({ clearBackground: vi.fn(), clearSlide: vi.fn() }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: () => <span data-icon /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({
    Button: ({ children, onClick, title }: { children: unknown; onClick?: () => void; title?: string }) => (
        <button onClick={onClick} title={title}>
            {children as never}
        </button>
    )
}))
vi.mock("../../../shared/ui/kit/dropdown/Dropdown", () => ({ Dropdown: ({ options, onClick }: { options: { name: string }[]; onClick?: (option: { name: string }) => void }) => <button onClick={() => onClick?.(options[0])}>{options[0].name}</button> }))
vi.mock("../../../shared/ui/system/Center", () => ({ Center: ({ children }: { children: unknown }) => <div>{children as never}</div> }))
vi.mock("./ScreenCapture", () => ({ ScreenCapture: ({ path }: { path: string }) => <div data-capture={path} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
    vi.mocked(getOutputContent).mockReturnValue({} as never)
})

describe("PowerPointPreview", () => {
    it("muestra la captura cuando la presentación está en la salida", () => {
        vi.mocked(getOutputContent).mockReturnValue({ id: "show1" } as never)
        restore = setStoresForTest([looseEntry(presentationApps, ["PowerPoint"]), looseEntry(presentationData, {}), looseEntry(outputs, {}), looseEntry(special, { presentationApp: "PowerPoint" }), looseEntry(activeShow, { id: "show1", type: "ppt" }), looseEntry(os, { platform: "darwin" })])
        const { container } = render(<PowerPointPreview show={{ id: "show1", type: "ppt" }} />)
        expect(container.querySelector("[data-capture='show1']")).toBeTruthy()
    })

    it("inicia una presentación nueva al hacer click", () => {
        restore = setStoresForTest([looseEntry(presentationApps, ["PowerPoint"]), looseEntry(presentationData, {}), looseEntry(outputs, {}), looseEntry(special, { presentationApp: "PowerPoint" }), looseEntry(activeShow, { id: "show1", type: "ppt" }), looseEntry(os, { platform: "darwin" })])
        const { getByText } = render(<PowerPointPreview show={{ id: "show1", type: "ppt" }} />)
        fireEvent.click(getByText("presentation_control.start"))
        expect(sendMain).toHaveBeenCalled()
    })
})
