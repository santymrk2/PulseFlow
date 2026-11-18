// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { actions, activeFocus, activeProject, activeShow, contextActive, drawer, editingProjectTemplate, focusMode, fullColors, playerVideos, projects, projectTemplates, recentFiles, selected, special } from "../../stores"
import { getAccess } from "../../utils/profile"
import { addProjectItem } from "../../converters/project"
import { getTimeUntilClock } from "../../components/drawer/timers/timers"
import { getFileName, removeExtension } from "../../components/helpers/media"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ProjectContentList } from "./ProjectContentList"

vi.mock("../../utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))
vi.mock("../../converters/project", () => ({ addProjectItem: vi.fn(), addToProject: vi.fn(), updateRecentlyAddedFiles: vi.fn() }))
vi.mock("../../components/actions/actions", () => ({ getActionIcon: vi.fn(() => "") }))
vi.mock("../../components/drawer/timers/timers", () => ({ getTimeUntilClock: vi.fn(() => 0) }))
vi.mock("../../components/helpers/array", () => ({ clone: vi.fn((value: unknown) => value) }))
vi.mock("../../components/helpers/color", () => ({ brightenDarkColor: vi.fn((value: string) => value), fadeColor: vi.fn((value: string) => value), getContrast: vi.fn(() => "#fff") }))
vi.mock("../../components/helpers/media", () => ({ getExtension: vi.fn(() => ""), getFileName: vi.fn((path: string) => path), getMediaType: vi.fn(() => "image"), removeExtension: vi.fn((name: string) => name) }))
vi.mock("../../components/helpers/time", () => ({ joinTimeBig: vi.fn((value: string) => value) }))
vi.mock("../../components/show/project", () => ({ clipboardToProject: vi.fn(async () => []) }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../ui/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../system/DropArea", () => ({ DropArea: ({ children }: { children?: ReactNode | ((over: boolean) => ReactNode) }) => <div data-testid="drop">{typeof children === "function" ? children(false) : children}</div> }))
vi.mock("../system/Autoscroll", () => ({ Autoscroll: ({ children }: { children?: ReactNode }) => <div data-testid="autoscroll">{children}</div> }))
vi.mock("../system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("./ShowButton", () => ({
    ShowButton: ({ id, show }: { id: string; show: { name?: string } }) => (
        <div data-testid="show-button" data-id={id}>
            {show.name}
        </div>
    )
}))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores(shows: unknown[] = []) {
    restore = setStoresForTest([
        looseEntry(actions, {}),
        looseEntry(activeFocus, { id: "" }),
        looseEntry(activeProject, "p1"),
        looseEntry(activeShow, null),
        looseEntry(contextActive, false),
        looseEntry(drawer, {}),
        looseEntry(editingProjectTemplate, false),
        looseEntry(focusMode, false),
        looseEntry(fullColors, false),
        looseEntry(playerVideos, {}),
        looseEntry(projects, { p1: { id: "p1", shows } }),
        looseEntry(projectTemplates, {}),
        looseEntry(recentFiles, {}),
        looseEntry(selected, {}),
        looseEntry(special, {})
    ])
    vi.mocked(getAccess).mockReturnValue({} as never)
    vi.mocked(getTimeUntilClock).mockReturnValue(0)
    vi.mocked(getFileName).mockImplementation((path: string) => path)
    vi.mocked(removeExtension).mockImplementation((name: string) => name)
}

describe("ProjectContentList", () => {
    it("muestra los shows del proyecto activo", () => {
        setStores([
            { id: "s1", name: "Intro", type: "show" },
            { id: "s2", name: "Outro", type: "show" }
        ])
        render(<ProjectContentList tree={[]} />)
        expect(screen.getAllByTestId("show-button")).toHaveLength(2)
        expect(screen.getByText("Intro")).toBeTruthy()
        expect(screen.getByText("Outro")).toBeTruthy()
    })

    it("no agrega items por defecto", () => {
        setStores([{ id: "s1", name: "Intro", type: "show" }])
        render(<ProjectContentList tree={[]} />)
        expect(addProjectItem).not.toHaveBeenCalled()
    })
})
