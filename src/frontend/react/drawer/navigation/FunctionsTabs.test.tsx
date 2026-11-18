// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "../../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actions, actionTags, activeActionTagFilter, activeTimerTagFilter, activeVariableTagFilter, dictionary, drawerTabsData, obsData, timerTags, timers, variableTags, variables } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { FunctionsTabs } from "./FunctionsTabs"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../utils/profile", () => ({ getAccess: () => ({}) }))

interface SectionsProps {
    sections: unknown
    active?: string
    onRename?: (detail: { id: string; value: string }) => void
    section0?: ReactNode
    section1?: ReactNode
    section2?: ReactNode
    section3?: ReactNode
    section4?: ReactNode
}

vi.mock("./NavigationSections", () => ({
    NavigationSections: ({ sections }: SectionsProps) => <div data-testid="sections" data-sections={JSON.stringify(sections)} />
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sections = (): Array<Array<Record<string, unknown>>> => JSON.parse(screen.getByTestId("sections").getAttribute("data-sections") || "[]") as Array<Array<Record<string, unknown>>>

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("FunctionsTabs", () => {
    beforeEach(() => {
        restaurar = setStoresForTest([
            looseEntry(dictionary, {}),
            looseEntry(drawerTabsData, { functions: { activeSubTab: "actions", enabled: true } }),
            looseEntry(obsData, { enabled: false }),
            looseEntry(actions, { a1: { name: "Acción", tags: ["t1"] } }),
            looseEntry(actionTags, { t1: { name: "Tag uno", color: "#fff" } }),
            looseEntry(activeActionTagFilter, ["t1"]),
            looseEntry(variables, {}),
            looseEntry(variableTags, {}),
            looseEntry(activeVariableTagFilter, []),
            looseEntry(timers, {}),
            looseEntry(timerTags, {}),
            looseEntry(activeTimerTagFilter, [])
        ])
    })

    it("arma las secciones con los tags y su cantidad de usos", () => {
        render(<FunctionsTabs />)

        expect(sections()[0][0]).toMatchObject({ id: "actions", label: "tabs.actions" })
        const submenu = sections()[0][0].submenu as { options: Array<Record<string, unknown>> }
        expect(submenu.options[0]).toMatchObject({ id: "t1", label: "Tag uno", count: 1 })
        expect(sections()[1][0]).toMatchObject({ id: "timer", label: "tabs.timers" })
        expect(sections()[2][0]).toMatchObject({ id: "variables", label: "tabs.variables" })
        expect(sections()[3][0]).toMatchObject({ id: "scenes", label: "tabs.scenes" })
        expect(sections()[4][0]).toMatchObject({ id: "interactions", label: "tabs.interactions" })
        expect(sections()).toHaveLength(5)
    })

    it("sanea los filtros iniciales contra los tags visibles", () => {
        restaurar()
        restaurar = setStoresForTest([
            looseEntry(dictionary, {}),
            looseEntry(drawerTabsData, { functions: { activeSubTab: "actions", enabled: true } }),
            looseEntry(obsData, { enabled: false }),
            looseEntry(actions, {}),
            looseEntry(actionTags, { t1: { name: "Tag uno", color: "#fff" } }),
            looseEntry(activeActionTagFilter, ["t1", "inexistente"]),
            looseEntry(variables, {}),
            looseEntry(variableTags, {}),
            looseEntry(activeVariableTagFilter, []),
            looseEntry(timers, {}),
            looseEntry(timerTags, {}),
            looseEntry(activeTimerTagFilter, [])
        ])

        render(<FunctionsTabs />)
        expect(get(activeActionTagFilter)).toEqual(["t1"])
    })
})
