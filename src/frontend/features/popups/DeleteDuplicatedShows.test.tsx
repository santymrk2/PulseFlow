// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { loadShows } from "../../shared/utils/helpers/setShow"
import { activePopup, dictionary, popupData, shows, showsCache } from "../../shared/core/stores"
import { clearFields, fields } from "../../shared/test/kitMocks"
import { clearIslands, islands } from "../../shared/test/islandMock"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { DeleteDuplicatedShows } from "./DeleteDuplicatedShows"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/setShow", () => ({ loadShows: vi.fn(async () => {}) }))
vi.mock("../../components/edit/scripts/textStyle", () => ({ getTextLines: (slide: { lines: string[] }) => slide.lines }))
vi.mock("../../shared/utils/helpers/time", () => ({ dateToString: (d: number) => `fecha:${d}` }))
vi.mock("../../react/main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Loader") }))
vi.mock("../../shared/ui/kit/textarea-field/TextareaField", async () => ({ TextareaField: (await vi.importActual<typeof import("../../shared/test/kitMocks")>("../../shared/test/kitMocks")).FieldMock }))

const cache = (...lines: string[]) => ({ slides: { s: { lines } } })
const SHOWS = {
    a: { name: "A", timestamps: { created: 5, modified: 30 } },
    b: { name: "B", timestamps: { created: 1, modified: 10 } },
    c: { name: "C", timestamps: { created: 9, modified: 20 } },
    d: { name: "D", timestamps: { created: 2, modified: 5 } },
    e: { name: "E", timestamps: { created: 3, modified: 6 } }
}
const DATA = [{ ids: ["a", "b", "c"] }, { ids: ["d", "e"] }]
let restaurar: () => void = () => {}
function montar(data: object[] = DATA, texts: Record<string, string> = { a: "igual", b: "igual", c: "distinto", d: "x", e: "x" }) {
    restaurar = setStoresForTest([
        looseEntry(popupData, { data: structuredClone(data) }),
        looseEntry(shows, SHOWS),
        looseEntry(showsCache, Object.fromEntries(Object.entries(texts).map(([id, t]) => [id, cache(t)]))),
        storeEntry(activePopup, "delete_duplicated_shows"),
        storeEntry(dictionary, { show: { delete_manual: "Manual", delete_match: "Iguales", delete_keep_last_modified: "Conservar última", delete_keep_first_created: "Conservar primera" }, actions: { delete: "Borrar" }, guide: { skip: "Saltar" } })
    ] as never)
    return render(<DeleteDuplicatedShows />)
}
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const ids = (call: number) => (vi.mocked(history).mock.calls[call][0].oldData as { data: { id: string }[] }).data.map((a) => a.id)

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("DeleteDuplicatedShows", () => {
    it("renderiza_manual_con_cantidades_y_los_dos_conservar_con_su_cuenta", () => {
        montar()
        expect(screen.getByText("Manual").closest("button")?.textContent).toContain("2 (5)")
        // conserva el más recientemente modificado (a, e) y borra el resto
        expect(screen.getByText("Conservar última").closest("button")?.textContent).toContain("3")
        // conserva el creado primero (b, d) y borra el resto
        expect(screen.getByText("Conservar primera").closest("button")?.textContent).toContain("3")
    })

    it("conservar_última_borra_los_demás_con_history_SHOWS_y_cierra_a_los_500ms", () => {
        montar()
        fireEvent.click(screen.getByText("Conservar última"))
        expect(history).toHaveBeenCalledTimes(1)
        expect(history).toHaveBeenCalledWith({ id: "SHOWS", oldData: { data: [{ id: "b" }, { id: "c" }, { id: "d" }] }, location: { page: "drawer" } })
        expect(get(activePopup)).toBe("delete_duplicated_shows")
        vi.advanceTimersByTime(500)
        expect(get(activePopup)).toBeNull()
    })

    it("conservar_primera_creada_borra_los_demás", () => {
        montar()
        fireEvent.click(screen.getByText("Conservar primera"))
        expect(ids(0)).toEqual(["a", "c", "e"])
    })

    it("el_menú_de_la_flecha_lista_los_nombres_a_borrar", () => {
        montar()
        fireEvent.click(document.querySelectorAll(".submenu_open")[0].closest("button") as HTMLElement)
        expect([...document.querySelectorAll("li")].map((a) => a.textContent)).toEqual(["B", "C", "D"])
    })

    it("borrar_iguales_carga_los_shows_y_borra_sólo_los_que_tienen_el_mismo_texto_que_el_primero", async () => {
        montar()
        fireEvent.click(screen.getByText("Iguales"))
        expect(islands.Loader).toBeDefined()
        await tick(0)
        expect(loadShows).toHaveBeenCalledWith(["a", "b", "c"])
        expect(loadShows).toHaveBeenCalledWith(["d", "e"])
        expect(history).toHaveBeenCalledTimes(1)
        expect(ids(0)).toEqual(["b", "e"])
        await tick(500)
        expect(get(activePopup)).toBeNull()
    })

    it("borrar_iguales_sin_texto_en_el_primero_no_borra_ese_grupo", async () => {
        montar(DATA, { a: "", b: "", c: "", d: "x", e: "x" })
        fireEvent.click(screen.getByText("Iguales"))
        await tick(0)
        expect(ids(0)).toEqual(["e"])
    })

    it("no_cierra_a_los_500ms_si_ya_se_abrió_otro_popup", async () => {
        montar()
        fireEvent.click(screen.getByText("Conservar última"))
        activePopup.set("alert")
        vi.advanceTimersByTime(500)
        expect(get(activePopup)).toBe("alert")
    })

    it("manual_muestra_el_primer_grupo_con_nombre_fecha_y_texto", async () => {
        montar()
        fireEvent.click(screen.getByText("Manual"))
        await tick(0)
        expect(screen.getByText("fecha:30")).toBeTruthy()
        expect(screen.getByText("A")).toBeTruthy()
        expect(screen.getAllByText("Borrar").length).toBe(3)
        expect(loadShows).toHaveBeenCalledWith(["a", "b", "c"])
        expect(screen.getByText("Saltar").closest("button")?.textContent).toContain("(1/2)")
        expect(fields["edit.text"]).toMatchObject({ rows: 5, disabled: true })
    })

    it("manual_borrar_uno_lo_borra_con_history_y_pasa_al_siguiente_grupo_si_quedan_menos_de_2", async () => {
        montar([{ ids: ["d", "e"] }, { ids: ["a", "b", "c"] }])
        fireEvent.click(screen.getByText("Manual"))
        await tick(0)
        fireEvent.click(screen.getAllByText("Borrar")[1])
        expect(history).toHaveBeenCalledWith({ id: "SHOWS", oldData: { data: [{ id: "e" }] }, location: { page: "drawer" } })
        await tick(0)
        expect(screen.getByText("Saltar").closest("button")?.textContent).toContain("(2/2)")
        expect(screen.getAllByText("Borrar").length).toBe(3)
    })

    it("manual_borrar_uno_de_tres_deja_el_grupo_con_dos", async () => {
        montar()
        fireEvent.click(screen.getByText("Manual"))
        await tick(0)
        fireEvent.click(screen.getAllByText("Borrar")[0])
        expect(ids(0)).toEqual(["a"])
        expect(screen.getAllByText("Borrar").length).toBe(2)
        expect(screen.getByText("Saltar").closest("button")?.textContent).toContain("(1/2)")
    })

    it("manual_saltar_avanza_y_en_el_último_grupo_cierra", async () => {
        montar()
        fireEvent.click(screen.getByText("Manual"))
        await tick(0)
        fireEvent.click(screen.getByText("Saltar"))
        await tick(0)
        expect(screen.getByText("Saltar").closest("button")?.textContent).toContain("(2/2)")
        fireEvent.click(screen.getByText("Saltar"))
        await tick(500)
        expect(get(activePopup)).toBeNull()
        expect(history).not.toHaveBeenCalled()
    })

    it("manual_volver_regresa_a_la_pantalla_principal", async () => {
        montar()
        fireEvent.click(screen.getByText("Manual"))
        await tick(0)
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)
        expect(screen.getByText("Iguales")).toBeTruthy()
        expect(history).not.toHaveBeenCalled()
    })

    it("cerrar_sin_elegir_no_borra_nada", () => {
        const { unmount } = montar()
        unmount()
        expect(history).not.toHaveBeenCalled()
    })
})
