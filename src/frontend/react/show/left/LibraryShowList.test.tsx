// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowList } from "../../../../types/Show"
import { dateToString } from "../../../components/helpers/time"
import { activeShow, dictionary, focusedArea, sorted } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { LibraryShowList } from "./LibraryShowList"
import styles from "./LibraryShowList.module.css"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../ShowButton", () => ({
    ShowButton: (props: Record<string, unknown>) => <div data-isla="ShowButton" data-props={JSON.stringify(props)} />
}))
vi.mock("../../drawer/VirtualList", () => ({
    VirtualList: ({ items, activeIndex, render }: { items: ShowList[]; activeIndex?: number | null; render: (item: ShowList, index: number) => ReactNode }) => (
        <div data-active-index={activeIndex ?? ""}>
            {items.map((item, index) => (
                <div key={item.id}>{render(item, index)}</div>
            ))}
        </div>
    )
}))

const dict = { ui: { no_results: "Sin resultados" }, empty: { shows: "Sin shows" } }
const show = (id: string, timestamps: Partial<ShowList["timestamps"]> = {}): ShowList => ({
    id,
    name: id,
    category: null,
    timestamps: { created: 1700000000000, modified: null, used: null, ...timestamps }
})

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(sorted, { shows: { type: "name" } }), storeEntry(activeShow, null), storeEntry(focusedArea, ""), storeEntry(dictionary, dict)] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

const lista = () => document.querySelector('[role="none"]') as HTMLElement
const islas = () => [...document.querySelectorAll('[data-isla="ShowButton"]')] as HTMLElement[]
const propsDe = (isla: HTMLElement) => JSON.parse(isla.dataset.props ?? "{}") as Record<string, unknown>

describe("LibraryShowList", () => {
    it("renderiza_la_lista_con_las_clases_globales_y_un_ShowButton_por_show", () => {
        render(<LibraryShowList shows={[show("a"), show("b")]} />)
        const list = lista()
        expect(list.classList.contains("list")).toBe(true)
        expect(list.classList.contains(styles.list)).toBe(true)
        expect(list.classList.contains("context")).toBe(true)
        expect(list.classList.contains("#drawer_show")).toBe(true)
        expect(islas()).toHaveLength(2)
        expect(propsDe(islas()[0]).id).toBe("a")
        expect(propsDe(islas()[0]).className).toBe("#drawer_show_button")
        expect(document.querySelector("#show_drawer")?.getAttribute("data-item")).toBe('{"id":"a"}')
    })

    it("mouseup_pone_el_foco_en_show_drawer", () => {
        render(<LibraryShowList shows={[show("a")]} />)
        fireEvent.mouseUp(lista())
        expect(get(focusedArea)).toBe("show_drawer")
    })

    it("el_activeIndex_viene_del_show_activo", () => {
        activeShow.set({ id: "b" } as never)
        render(<LibraryShowList shows={[show("a"), show("b")]} />)
        expect(document.querySelector("[data-active-index]")?.getAttribute("data-active-index")).toBe("1")
    })

    it("la_fecha_secundaria_usa_el_sortType_de_sorted_y_respeta_el_sufijo_old", () => {
        sorted.set({ shows: { type: "used_old" } })
        render(<LibraryShowList shows={[show("a", { used: 1600000000000, modified: 1700000000000 })]} />)
        expect(propsDe(islas()[0]).data).toBe(dateToString(1600000000000, true, dict))
    })

    it("sin_shows_muestra_el_mensaje_de_biblioteca_vacia", () => {
        render(<LibraryShowList shows={[]} />)
        expect(screen.getByText("Sin shows")).toBeTruthy()
        expect(islas()).toHaveLength(0)
    })

    it("sin_shows_por_busqueda_muestra_el_mensaje_de_sin_resultados", () => {
        render(<LibraryShowList shows={[]} searching />)
        expect(screen.getByText("Sin resultados")).toBeTruthy()
        expect(screen.queryByText("Sin shows")).toBeNull()
    })
})
