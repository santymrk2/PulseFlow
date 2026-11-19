// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeActionTagFilter, activeDrawerTab, activeEdit, activeTimerTagFilter, activeVariableTagFilter, dictionary, drawerTabsData, labelsDisabled } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { looseEntry, setStoresForTest } from "../../../shared/test/storeTestKit"
import { NavigationSections, type NavSection } from "./NavigationSections"

vi.mock("../../../shared/utils/common", () => commonMock())

interface DrawerTabMockProps {
    category: { id: string; label: string }
    onRename?: (detail: { id: string; value: string }) => void
}

vi.mock("../DrawerTab", () => ({
    DrawerTab: ({ category, onRename }: DrawerTabMockProps) => (
        <button type="button" data-testid={`tab-${category.id}`} onClick={() => onRename?.({ id: category.id, value: "cambio" })}>
            {category.label}
        </button>
    )
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let restaurar: () => void = () => {}

function prepararStores(valores: { activeSubTab?: string; labelsOff?: boolean; items?: string[]; actionFilter?: string[] } = {}) {
    restaurar = setStoresForTest([looseEntry(dictionary, {}), looseEntry(labelsDisabled, valores.labelsOff ?? false), looseEntry(activeDrawerTab, "audio"), looseEntry(activeEdit, { items: valores.items ?? [] }), looseEntry(drawerTabsData, { audio: { activeSubTab: valores.activeSubTab ?? "a", enabled: true } }), looseEntry(activeActionTagFilter, valores.actionFilter ?? []), looseEntry(activeVariableTagFilter, []), looseEntry(activeTimerTagFilter, [])])
}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
})

describe("NavigationSections", () => {
    it("oculta items y secciones según hidden y renderiza el slot del índice", () => {
        prepararStores()
        const sections: NavSection[] = [
            [{ id: "oculto", label: "Oculto", hidden: true }],
            [
                { id: "TITLE", label: "titulo.seccion" },
                { id: "a", label: "A" }
            ],
            ["SEPARATOR", { id: "b", label: "B" }]
        ]

        render(<NavigationSections sections={sections} active="a" section1={<span>slot-uno</span>} />)

        expect(screen.queryByTestId("tab-oculto")).toBeNull()
        expect(screen.getByText("titulo.seccion")).toBeTruthy()
        expect(screen.getByTestId("tab-a")).toBeTruthy()
        expect(screen.getByTestId("tab-b")).toBeTruthy()
        expect(screen.getByText("slot-uno")).toBeTruthy()
        expect(document.querySelectorAll("hr")).toHaveLength(1)
    })

    it("reenvía onRename con el detalle del hijo", () => {
        prepararStores()
        const onRename = vi.fn()
        render(<NavigationSections sections={[[{ id: "a", label: "A" }]]} active="a" onRename={onRename} />)

        fireEvent.click(screen.getByTestId("tab-a"))
        expect(onRename).toHaveBeenCalledWith({ id: "a", value: "cambio" })
    })

    it("selecciona la primera subpestaña cuando active no está en sections", () => {
        vi.useFakeTimers()
        prepararStores({ activeSubTab: "" })

        render(
            <NavigationSections
                sections={[
                    [
                        { id: "a", label: "A" },
                        { id: "b", label: "B" }
                    ]
                ]}
                active=""
            />
        )
        act(() => {
            vi.advanceTimersByTime(60)
        })

        expect(get(drawerTabsData).audio?.activeSubTab).toBe("a")
        expect(get(drawerTabsData).audio?.enabled).toBe(true)
    })

    it("Ctrl + ArrowDown cambia de subpestaña y cierra los filtros de tags", () => {
        prepararStores({ actionFilter: ["tag-1"] })

        render(
            <NavigationSections
                sections={[
                    [
                        { id: "a", label: "A" },
                        { id: "b", label: "B" }
                    ]
                ]}
                active="a"
            />
        )
        fireEvent.keyDown(window, { key: "ArrowDown", ctrlKey: true })

        expect(get(drawerTabsData).audio?.activeSubTab).toBe("b")
        expect(get(activeActionTagFilter)).toEqual([])
        expect(get(activeVariableTagFilter)).toEqual([])
        expect(get(activeTimerTagFilter)).toEqual([])
    })

    it("ignora Ctrl + ArrowDown mientras hay un item en edición", () => {
        prepararStores({ items: ["slide-1"] })

        render(
            <NavigationSections
                sections={[
                    [
                        { id: "a", label: "A" },
                        { id: "b", label: "B" }
                    ]
                ]}
                active="a"
            />
        )
        fireEvent.keyDown(window, { key: "ArrowDown", ctrlKey: true })

        expect(get(drawerTabsData).audio?.activeSubTab).toBe("a")
    })
})
