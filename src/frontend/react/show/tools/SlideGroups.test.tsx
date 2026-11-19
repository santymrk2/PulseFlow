// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeShow, cachedShowsData, fullColors, globalGroupViewEnabled, groups, selected, showsCache, templates } from "../../../shared/core/stores"
import { isGroupHidden } from "../../../shared/utils/profile"
import { getDuplicateGroups, getSlideGroups } from "../../../components/show/tools/groups"
import { _show } from "../../../shared/utils/helpers/shows"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { SlideGroups } from "./SlideGroups"

vi.mock("../../../shared/utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})), isGroupHidden: vi.fn(() => false) }))
vi.mock("../../../shared/utils/common", () => ({ newToast: vi.fn() }))
vi.mock("../../../shared/utils/helpers/array", () => ({ sortByName: vi.fn((value: unknown) => value) }))
vi.mock("../../../shared/utils/helpers/color", () => ({ hexToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })) }))
vi.mock("../../../shared/utils/helpers/drop", () => ({ ondrop: vi.fn(() => () => {}) }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../shared/utils/helpers/shows", () => ({ _show: vi.fn() }))
vi.mock("../../../components/show/tools/groups", () => ({ getDuplicateGroups: vi.fn(() => []), getSlideGroups: vi.fn(() => []), mergeDuplicateGroups: vi.fn() }))
vi.mock("../../../shared/ui/helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../../shared/ui/helpers/T", () => ({ T: ({ id }: { id: string }) => <span data-t={id}>{id}</span> }))
vi.mock("../../../shared/ui/kit/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children?: ReactNode }) => <div data-testid="bar">{children}</div> }))
vi.mock("../../../shared/ui/kit/button/Button", () => ({ Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> }))
vi.mock("../../../shared/ui/system/Center", () => ({ Center: ({ children }: { children?: ReactNode }) => <div data-testid="center">{children}</div> }))
vi.mock("../../../shared/ui/system/SelectElem", () => ({ SelectElem: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

let restore: () => void = () => {}
afterEach(() => {
    cleanup()
    restore()
    vi.clearAllMocks()
})

function setStores() {
    restore = setStoresForTest([looseEntry(activeShow, { id: "s1" }), looseEntry(cachedShowsData, {}), looseEntry(fullColors, false), looseEntry(globalGroupViewEnabled, false), looseEntry(groups, {}), looseEntry(selected, {}), looseEntry(showsCache, { s1: { layouts: {}, slides: {} } }), looseEntry(templates, {})])
    vi.mocked(isGroupHidden).mockReturnValue(false)
    vi.mocked(getSlideGroups).mockReturnValue([])
    vi.mocked(getDuplicateGroups).mockReturnValue([])
    vi.mocked(_show).mockImplementation(() => ({ get: vi.fn(() => "") }) as never)
}

describe("SlideGroups", () => {
    it("muestra el estado vacío cuando no hay grupos", () => {
        setStores()
        render(<SlideGroups />)
        expect(screen.getAllByText("empty.groups").length).toBeGreaterThan(0)
        expect(screen.getAllByTestId("center").length).toBeGreaterThan(0)
    })

    it("consulta los grupos del show activo", () => {
        setStores()
        render(<SlideGroups />)
        expect(getSlideGroups).toHaveBeenCalledWith("s1", expect.anything(), expect.anything())
    })
})
