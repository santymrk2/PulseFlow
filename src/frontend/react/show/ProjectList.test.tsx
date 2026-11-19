// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Tree } from "../../../types/Projects"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeProfile, activeProject, folders, labelsDisabled, openedFolders, projects } from "../../shared/core/stores"
import { history } from "../../components/helpers/history"
import { isProjectLinked, openProject } from "../../components/show/project"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ProjectList } from "./ProjectList"

vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/show/project", () => ({ isProjectLinked: vi.fn(() => false), openProject: vi.fn() }))
vi.mock("../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../ui/button/Button", () => ({
    Button: ({ children, onClick, className, isActive }: { children?: ReactNode; onClick?: (detail: unknown) => void; className?: string; isActive?: boolean }) => (
        <button type="button" className={`${className || ""}${isActive ? " isActive" : ""}`} onClick={() => onClick?.({})}>
            {children}
        </button>
    )
}))
vi.mock("../ui/hidden-input/HiddenInput", () => ({ HiddenInput: ({ value }: { value: string }) => <span data-name={value}>{value}</span> }))
vi.mock("../system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeProfile, null), looseEntry(activeProject, "p1"), looseEntry(folders, {}), looseEntry(labelsDisabled, false), looseEntry(openedFolders, []), looseEntry(projects, { p1: { id: "p1", name: "Mi lista", shows: [] } })])
    vi.mocked(isProjectLinked).mockReturnValue(false)
}

const tree = [
    { id: "p1", name: "Mi lista", shows: [], type: "project" as const, path: "/" },
    { id: "p2", name: "Otra lista", shows: [], type: "project" as const, path: "/" }
] as unknown as Tree[]

describe("ProjectList", () => {
    it("muestra cada proyecto del árbol", () => {
        setStores()
        render(<ProjectList tree={tree} />)
        expect(screen.getByText("Mi lista")).toBeTruthy()
        expect(screen.getByText("Otra lista")).toBeTruthy()
    })

    it("respeta selectedId sobre el proyecto activo", () => {
        setStores()
        const { container } = render(<ProjectList tree={tree} selectedId="p2" />)
        const active = container.querySelector(".isActive")
        expect(active?.textContent).toBeTruthy()
        expect(openProject).not.toHaveBeenCalled()
        expect(history).not.toHaveBeenCalled()
    })
})
