// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, categories, dictionary, drawerTabsData, popupData, shows, sortedShowsList } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SelectShow } from "./SelectShow"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../drawer/VirtualList", () => ({
    VirtualList: ({ items, render }: { items: { id: string; name: string; private?: boolean }[]; render: (item: { id: string; name: string; private?: boolean }) => ReactNode }) => (
        <div>
            {items.map((item, i) => (
                <div key={i}>{render(item)}</div>
            ))}
        </div>
    )
}))
vi.mock("../ui/text-field/TextField", () => ({
    TextField: ({ label, onInput }: { label: string; onInput?: (v: string) => void }) => <input data-label={label} onChange={(e) => onInput?.(e.currentTarget.value)} />
}))

const trigger = vi.fn()
let restaurar: () => void = () => {}
function montar(
    data: object = {},
    list: object[] = [
        { id: "s1", name: "Canción uno" },
        { id: "s2", name: "Canción dos", private: true }
    ]
) {
    restaurar = setStoresForTest([storeEntry(popupData, data), looseEntry(sortedShowsList, list), looseEntry(shows, {}), looseEntry(categories, {}), looseEntry(drawerTabsData, {}), storeEntry(activePopup, "select_show"), storeEntry(dictionary, { main: { search: "Buscar" }, empty: { search: "Sin resultados", shows: "Sin shows" } })] as never)
    return render(<SelectShow />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("SelectShow", () => {
    it("lista los shows ordenados y marca el activo", () => {
        montar({ action: "select_show", active: "s1" })
        expect(screen.getByText("Canción uno")).toBeTruthy()
        expect(screen.getByText("Canción dos")).toBeTruthy()
        expect(screen.getByText("Canción uno").closest("button")?.classList.contains("isActive")).toBe(true)
        expect(document.querySelectorAll("svg").length).toBe(1)
    })

    it("elegir un show llama al trigger y vuelve al popup de origen", () => {
        montar({ action: "select_show", trigger, revert: "anterior" })
        fireEvent.click(screen.getByText("Canción dos"))
        expect(trigger).toHaveBeenCalledWith("s2")
        expect(get(activePopup)).toBe("anterior")
    })

    it("fuera de la acción select_show no hace nada", () => {
        montar({ trigger })
        fireEvent.click(screen.getByText("Canción uno"))
        expect(trigger).not.toHaveBeenCalled()
        expect(get(activePopup)).toBe("select_show")
    })

    it("sin trigger escribe showId en popupData", () => {
        montar({ action: "select_show" })
        fireEvent.click(screen.getByText("Canción uno"))
        expect(get(popupData)).toMatchObject({ action: "select_show", showId: "s1" })
        expect(get(activePopup)).toBeNull()
    })

    it("la búsqueda sin resultados muestra empty.search", () => {
        montar({ action: "select_show" })
        fireEvent.change(document.querySelector("input") as HTMLInputElement, { target: { value: "zzz" } })
        expect(screen.getByText("Sin resultados")).toBeTruthy()
    })

    it("sin shows muestra empty.shows", () => {
        montar({ action: "select_show" }, [])
        expect(screen.getByText("Sin shows")).toBeTruthy()
    })
})
