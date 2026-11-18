// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { allOutputs, outputs, stageShows } from "../../stores"
import { getSortedStageItems, shouldItemBeShown } from "../../components/edit/scripts/itemHelpers"
import { getAccess } from "../../utils/profile"
import { getSlideTextItems } from "../../components/stage/stage"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { StageSlide } from "./StageSlide"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({ global: "edit" })) }))
vi.mock("../../components/edit/scripts/itemHelpers", () => ({ getSortedStageItems: vi.fn(() => []), shouldItemBeShown: vi.fn(() => true) }))
vi.mock("../../components/helpers/output", () => ({
    getStageOutputId: vi.fn(() => "stage1"),
    getStageResolution: vi.fn(() => ({ width: 1920, height: 1080 }))
}))
vi.mock("../../components/stage/stage", () => ({ getSlideTextItems: vi.fn(() => []), stageItemToItem: vi.fn((item) => item) }))
vi.mock("../bridge/SvelteIsland", () => ({
    SvelteIsland: ({ component, props, events }: { component: { name?: string }; props: Record<string, unknown>; events?: Record<string, (event: unknown) => void> }) => (
        <span data-island={component?.name || "svelte"} data-props={JSON.stringify(props, (_, value) => (typeof value === "function" ? undefined : value))}>
            <button data-testid={props.allowEmpty !== undefined ? "edit-HiddenInput" : "edit-Stagebox"} onClick={() => events?.edit?.({ detail: { value: "Nuevo nombre" } })} />
        </span>
    )
}))
vi.mock("../stage/Stagebox", async () => ({ Stagebox: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).makePortMock("Stagebox") }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../system/SelectElem", () => ({
    SelectElem: ({ children }: { children: ReactNode }) => <div data-select>{children}</div>
}))
vi.mock("../slide/Zoomed", () => ({
    Zoomed: ({ children, onRatioChange, ...props }: { children: ReactNode; onRatioChange?: (ratio: number) => void } & Record<string, unknown>) => (
        <div data-view="Zoomed" data-props={JSON.stringify(props)}>
            <button data-testid="ratio" onClick={() => onRatioChange?.(0.5)} />
            {children}
        </div>
    )
}))

const layout = (extra: Record<string, unknown> = {}) => ({ id: "s1", name: "Escenario", items: [{ id: "i1" }], settings: {}, actions: {}, ...extra }) as never

let restore: () => void = () => {}
beforeEach(() => {
    restore = setStoresForTest([looseEntry(outputs, { stage1: { active: true } }), looseEntry(allOutputs, {}), looseEntry(stageShows, { st1: { name: "Antes", items: { i1: { id: "i1", type: "text" } } } })])
    vi.mocked(getSortedStageItems).mockReturnValue([{ id: "i1", type: "text" }] as never)
    vi.mocked(shouldItemBeShown).mockReturnValue(true as never)
})
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function renderStage(props: Record<string, unknown> = {}) {
    return render(<StageSlide layout={layout()} id="st1" {...props} />)
}

describe("StageSlide", () => {
    it("renderiza el slide, el SelectElem y el Zoomed de stage", () => {
        const { container } = renderStage({ columns: 3 })
        expect(container.querySelector("[data-select]")).toBeTruthy()
        expect(container.querySelector("[data-view='Zoomed']")).toBeTruthy()
        expect((container.querySelector(".main") as HTMLElement).getAttribute("style")).toContain("width: 33.333333333333336%")
        const zoomedProps = JSON.parse(container.querySelector("[data-view='Zoomed']")!.getAttribute("data-props") || "{}")
        expect(zoomedProps).toMatchObject({ background: "black", id: "stage1", isStage: true, disableStyle: true, center: true })
    })

    it("aplica active, list, disabled y password", () => {
        const { container } = renderStage({ active: true, list: true, layout: layout({ disabled: true, password: "1234", settings: { color: "red" } }) })
        const main = container.querySelector(".main") as HTMLElement
        expect(main.className).toContain("active")
        expect(main.className).toContain("list")
        expect(container.querySelector(".slide")!.className).toContain("disabled")
        expect(container.querySelector("[data-title='remote.password']")).toBeTruthy()
        expect((container.querySelector(".slide") as HTMLElement).getAttribute("style")).toContain("background-color: red")
    })

    it("renderiza un Stagebox por ítem visible", () => {
        const { container } = renderStage()
        expect(container.querySelector("[data-isla='Stagebox']")).toBeTruthy()
    })

    it("oculta los ítems filtrados por condiciones", () => {
        vi.mocked(shouldItemBeShown).mockReturnValue(false as never)
        vi.mocked(getSortedStageItems).mockReturnValue([{ id: "i1", type: "text", bindings: ["stage"] }] as never)
        const { container } = renderStage()
        expect(container.querySelector("[data-isla='Stagebox']")).toBeNull()
    })

    it("edita el nombre del stage desde HiddenInput", () => {
        const { container } = renderStage()
        fireEvent.click(container.querySelector("[data-testid='edit-HiddenInput']")!)
        expect(container.querySelector("[data-title='Escenario']")).toBeTruthy()
    })

    it("no edita en modo lectura", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        const { container } = renderStage()
        fireEvent.click(container.querySelector("[data-testid='edit-HiddenInput']")!)
        expect(container.querySelector(".slide")!.className).toContain("stage_slide_readonly")
    })

    it("propaga el clic del slide", () => {
        const onClick = vi.fn()
        const { container } = renderStage({ onClick })
        fireEvent.click(container.querySelector(".slide")!)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("usa los textos del slide para los ítems slide_text", async () => {
        vi.mocked(getSortedStageItems).mockReturnValue([{ id: "i2", type: "slide_text", bindings: ["stage"] }] as never)
        const { container } = renderStage()
        expect(getSlideTextItems).toHaveBeenCalled()
        expect(container.querySelector("[data-isla='Stagebox']")).toBeTruthy()
    })
})
