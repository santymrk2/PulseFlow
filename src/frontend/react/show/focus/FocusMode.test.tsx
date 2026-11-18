// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import type { ProjectShowRef } from "../../../../types/Projects"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeFocus, activeProject, outputs, projects, resized } from "../../../stores"
import { getAllProjectItems } from "../../../components/show/focus/focus"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { FocusMode } from "./FocusMode"

vi.mock("../../../components/show/focus/focus", () => ({ getAllProjectItems: vi.fn(async () => []) }))
vi.mock("../../../components/helpers/output", () => ({ getActiveOutputs: vi.fn(() => []) }))
vi.mock("../../../utils/common", () => ({ hasNewerUpdate: vi.fn(async () => false) }))
vi.mock("../../../components/main/Loader.svelte", () => ({ default: () => null }))
vi.mock("../../bridge/SvelteIsland", () => ({ SvelteIsland: () => <div data-testid="loader" /> }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("./FocusItem", () => ({ FocusItem: ({ show }: { show: { id: string; index?: number } }) => <div data-testid="focus-item" data-id={show.id} data-index={show.index} /> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(shows: unknown[] = []) {
    restore = setStoresForTest([looseEntry(activeProject, "project1"), looseEntry(projects, { project1: { shows } }), looseEntry(outputs, {}), looseEntry(resized, { leftPanel: 250 }), looseEntry(activeFocus, { id: "", type: "show" })])
}

describe("FocusMode", () => {
    it("muestra el loader mientras se cargan los items", async () => {
        let resolve!: (value: ProjectShowRef[]) => void
        vi.mocked(getAllProjectItems).mockImplementationOnce(
            () =>
                new Promise((res) => {
                    resolve = res
                })
        )
        setStores([{ id: "show1" }])
        render(<FocusMode />)

        expect(screen.getByTestId("loader")).toBeTruthy()
        resolve([{ id: "show1", name: "Show 1" }])
        await waitFor(() => expect(screen.getByTestId("focus-item")).toBeTruthy())
    })

    it("renderiza cada item con su nombre, ícono y FocusItem", async () => {
        vi.mocked(getAllProjectItems).mockResolvedValueOnce([
            { id: "show1", name: "Show 1", type: "show", icon: "folder" },
            { id: "audio1", name: "Song", type: "audio", icon: "music" }
        ])
        setStores([{ id: "show1" }, { id: "audio1", type: "audio" }])
        render(<FocusMode />)

        await waitFor(() => expect(screen.getAllByTestId("focus-item")).toHaveLength(2))
        expect(screen.getByText("Show 1")).toBeTruthy()
        expect(screen.getByText("Song")).toBeTruthy()
        expect(screen.getAllByTestId("focus-item")[0].getAttribute("data-index")).toBe("0")
    })

    it("muestra el estado vacío cuando no hay items", async () => {
        vi.mocked(getAllProjectItems).mockResolvedValueOnce([])
        setStores([])
        render(<FocusMode />)

        await waitFor(() => expect(screen.getByTestId("center")).toBeTruthy())
        expect(screen.getByText("empty.general")).toBeTruthy()
        expect(screen.queryByTestId("focus-item")).toBeNull()
    })
})
