// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { activeEdit, activeShow, media } from "../../shared/core/stores"
import { MediaTools } from "./MediaTools"

vi.mock("../../audio/audioPlayer", () => ({ AudioPlayer: {} }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../shared/utils/language", () => ({ translateText: (s: string) => s }))
vi.mock("../../shared/utils/helpers/array", () => ({ clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) }))
vi.mock("../main/Tabs", () => ({
    Tabs: (props: { tabs: Record<string, unknown>; active: string; onActiveChange?: (id: string) => void }) => (
        <div data-testid="tabs">
            {Object.keys(props.tabs).map((id) => (
                <button key={id} data-active={String(id === props.active)} onClick={() => props.onActiveChange?.(id)}>
                    {id}
                </button>
            ))}
        </div>
    )
}))
vi.mock("./tools/EditValues", () => ({
    EditValues: () => <div data-testid="edit-values" />
}))

vi.mock("../../features/media/logic/video/videoPlayer", () => ({
    VideoPlayer: {
        getDuration: () => Promise.resolve(0),
        updateProperties: () => {}
    }
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    restore = () => {}
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeEdit, { id: "img.png", type: "media" }), looseEntry(activeShow, null), looseEntry(media, {})])
}

describe("MediaTools", () => {
    it("renderiza las herramientas de medios con la pestaña media activa", () => {
        setStores()
        const { container } = render(<MediaTools />)
        expect(container.querySelector(".main.border.editTools")).not.toBeNull()
        expect(screen.getByText("media").dataset.active).toBe("true")
        expect(screen.getByTestId("edit-values")).toBeTruthy()
    })

    it("onActiveChange de Tabs cambia a la pestaña filters", () => {
        setStores()
        render(<MediaTools />)
        fireEvent.click(screen.getByText("filters"))
        expect(screen.getByText("filters").dataset.active).toBe("true")
        expect(screen.getByTestId("edit-values")).toBeTruthy()
    })
})
