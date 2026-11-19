// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowList } from "../../../../types/Show"
import { activeEdit, activeProfile, activeShow, activeTagFilter, activePopup, categories, dictionary, drawer, focusMode, focusedArea, labelsDisabled, profiles, shows, sorted, sortedShowsList } from "../../../shared/core/stores"
import { commonMock } from "../../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../../shared/test/storeTestKit"
import { Shows } from "./Shows"

const { historyMock, updateShowsListMock } = vi.hoisted(() => ({ historyMock: vi.fn(), updateShowsListMock: vi.fn() }))

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../../shared/core/classes/Show", () => ({ ShowObj: class ShowObj {} }))
vi.mock("../../../shared/utils/helpers/history", () => ({ history: historyMock }))
vi.mock("../../../shared/utils/helpers/show", () => ({ updateShowsList: updateShowsListMock }))
vi.mock("../../show/ShowButton", () => ({
    ShowButton: (props: Record<string, unknown>) => <div data-isla="ShowButton" data-props={JSON.stringify(props)} />
}))
vi.mock("../VirtualList", () => ({
    VirtualList: ({ items, activeIndex, className, render }: { items: ShowList[]; activeIndex?: number | null; className?: string; render: (item: ShowList, index: number) => ReactNode }) => (
        <div data-class={className} data-active-index={activeIndex ?? ""}>
            {items.map((item, index) => (
                <div key={item.id}>{render(item, index)}</div>
            ))}
        </div>
    )
}))

const dict = {
    show: { name: "Nombre" },
    meta: { number: "Número" },
    info: { modified: "Modificado", created: "Creado", used: "Usado" },
    empty: { shows: "Sin shows" },
    new: { show: "Nuevo show" },
    actions: { import: "Importar" },
    main: { unnamed: "Sin nombre" },
    category: { create_nonexistent: "Crear categorías" }
}

const show = (id: string, extra: Partial<ShowList> = {}): ShowList => ({
    id,
    name: id,
    category: null,
    timestamps: { created: 1700000000000, modified: null, used: null },
    ...extra
})

let restaurar: () => void = () => {}

function montar(active: string | null = "all") {
    return render(<Shows active={active} />)
}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([
        storeEntry(dictionary, dict),
        storeEntry(sortedShowsList, [show("a"), show("b")]),
        storeEntry(categories, {}),
        storeEntry(drawer, { height: 300, stored: null }),
        storeEntry(activeProfile, null),
        storeEntry(profiles, {}),
        storeEntry(activeTagFilter, []),
        storeEntry(sorted, { shows: { type: "name" } }),
        storeEntry(shows, {} as never),
        storeEntry(activeShow, null),
        storeEntry(activeEdit, { items: [] } as never),
        storeEntry(focusMode, false),
        storeEntry(labelsDisabled, false)
    ])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const islas = () => [...document.querySelectorAll('[data-isla="ShowButton"]')] as HTMLElement[]
const propsDe = (isla: HTMLElement) => JSON.parse(isla.getAttribute("data-props") ?? "{}") as Record<string, unknown>

describe("Shows", () => {
    it("lista los shows con un ShowButton por entrada y la fecha del orden activo", () => {
        montar()
        expect(islas()).toHaveLength(2)
        expect(propsDe(islas()[0]).id).toBe("a")
        expect(propsDe(islas()[0]).className).toBe("#drawer_show_button")
        expect(document.querySelector("[data-class]")?.getAttribute("data-class")).toContain("list")
        expect(document.querySelector("#show_drawer")?.getAttribute("data-item")).toBe('{"id":"a"}')
    })

    it("filtra por categoría, archivo y acceso del perfil", () => {
        restaurar()
        restaurar = setStoresForTest([storeEntry(dictionary, dict), storeEntry(sortedShowsList, [show("a", { category: "c1" }), show("b", { category: "c2" }), show("c", { category: "c1" })]), storeEntry(categories, { c2: { isArchive: true } } as never), storeEntry(drawer, { height: 300, stored: null }), storeEntry(activeProfile, "p1"), storeEntry(profiles, { p1: { access: { shows: { c1: "none" } } } } as never), storeEntry(activeTagFilter, []), storeEntry(sorted, { shows: { type: "name" } })])
        montar("all")
        expect(islas()).toHaveLength(0)
    })

    it("con active locked sólo muestra los shows bloqueados", () => {
        act(() => sortedShowsList.set([show("a", { locked: true }), show("b")]))
        montar("locked")
        expect(islas()).toHaveLength(1)
        expect(propsDe(islas()[0]).id).toBe("a")
    })

    it("filtra por las etiquetas activas", () => {
        act(() => sortedShowsList.set([show("a", { quickAccess: { tags: ["t1", "t2"] } }), show("b", { quickAccess: { tags: ["t1"] } })]))
        act(() => activeTagFilter.set(["t1", "t2"]))
        montar()
        expect(islas()).toHaveLength(1)
        expect(propsDe(islas()[0]).id).toBe("a")
    })

    it("las cabeceras ordenan el store y actualizan la lista", () => {
        montar()
        fireEvent.click(screen.getByText("Nombre"))
        expect(get(sorted).shows.type).toBe("name_des")
        expect(updateShowsListMock).toHaveBeenCalledWith(get(shows))
    })

    it("el botón nuevo abre el popup y con ctrl escribe el historial", () => {
        montar()
        const botones = screen.getAllByRole("button")
        fireEvent.click(botones[botones.length - 1])
        expect(get(activePopup)).toBe("show")

        fireEvent.click(botones[botones.length - 1], { ctrlKey: true })
        expect(historyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "UPDATE",
                location: { page: "show", id: "show" },
                newData: expect.objectContaining({ remember: { project: null, index: undefined } })
            })
        )
    })

    it("ctrl+flecha derecha activa el siguiente show", () => {
        montar()
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true }))
        })
        expect(get(activeShow)).toEqual({ id: "a", type: "show" })
    })

    it("sin shows muestra el vacío", () => {
        act(() => sortedShowsList.set([]))
        montar()
        expect(screen.getByText("Sin shows")).toBeTruthy()
        expect(islas()).toHaveLength(0)
    })

    it("con el cajón cerrado difiere la actualización de la lista hasta abrirlo", () => {
        montar()
        act(() => drawer.set({ height: 40, stored: null }))
        act(() => sortedShowsList.set([show("a"), show("b"), show("c")]))
        expect(islas()).toHaveLength(2)

        act(() => drawer.set({ height: 300, stored: null }))
        expect(islas()).toHaveLength(3)
    })

    it("mouseup pone el foco en show_drawer", () => {
        const { container } = montar()
        fireEvent.mouseUp(container.querySelector("[class*='column']") as HTMLElement)
        expect(get(focusedArea)).toBe("show_drawer")
    })

    it("en unlabeled ofrece crear las categorías inexistentes", () => {
        act(() => sortedShowsList.set([show("a", { category: "c1" })]))
        montar("unlabeled")
        fireEvent.click(screen.getByText("Crear categorías"))
        expect(get(categories).c1).toEqual({ name: "Sin nombre" })
    })

    it("renderiza los datos del show con la fecha del orden modificado", () => {
        act(() => sorted.set({ shows: { type: "modified_old" } }))
        montar()
        expect(typeof propsDe(islas()[0]).data).toBe("string")
    })
})
