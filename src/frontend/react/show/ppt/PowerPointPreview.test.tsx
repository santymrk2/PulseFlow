// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, os, outputs, presentationApps, presentationData, special } from "../../../stores"
import { sendMain } from "../../../IPC/main"
import { getOutputContent } from "../../../components/helpers/output"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { PowerPointPreview } from "./PowerPointPreview"

vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../IPC/main", () => ({ requestMain: vi.fn(), sendMain: vi.fn() }))
vi.mock("../../../components/helpers/media", () => ({ getFileName: (path: string) => path, removeExtension: (name: string) => name }))
vi.mock("../../../components/helpers/output", () => ({ getOutputContent: vi.fn(() => ({})), getActiveOutputs: vi.fn(() => ["out1"]), setOutput: vi.fn() }))
vi.mock("../../../components/output/clear", () => ({ clearBackground: vi.fn(), clearSlide: vi.fn() }))
vi.mock("../../helpers/Icon", () => ({ Icon: () => <span data-icon /> }))
vi.mock("../../helpers/T", () => ({ T: ({ id }: { id: string }) => <span>{id}</span> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ children, onClick, title }: { children: unknown; onClick?: () => void; title?: string }) => (
        <button onClick={onClick} title={title}>
            {children as never}
        </button>
    )
}))
vi.mock("../../ui/dropdown/Dropdown", () => ({ Dropdown: ({ options, onClick }: { options: { name: string }[]; onClick?: (option: { name: string }) => void }) => <button onClick={() => onClick?.(options[0])}>{options[0].name}</button> }))
vi.mock("../../system/Center", () => ({ Center: ({ children }: { children: unknown }) => <div>{children as never}</div> }))
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
