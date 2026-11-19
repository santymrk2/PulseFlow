// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { destroyMain, receiveMain, requestMain, sendMain } from "../../shared/core/ipc/main"
import { activePage, activePopup, deletedShows, dictionary, popupData, shows, showsCache } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { clearIslands } from "../../shared/test/islandMock"
import { looseEntry, setStoresForTest } from "../../shared/test/storeTestKit"
import { CleaningUtility } from "./CleaningUtility"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), requestMain: vi.fn(), receiveMain: vi.fn(() => "listener-1"), destroyMain: vi.fn() }))
vi.mock("../../app/main/Loader", async () => ({ Loader: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Loader") }))

const SHOWS = { a: { name: "Amazing Grace" }, b: { name: "Amazing Grace 2" }, c: { name: "Otra" }, d: { name: "" } }
let restaurar: () => void = () => {}
function montar(data: object = { type: "shows" }, showsValue: object = SHOWS) {
    restaurar = setStoresForTest([looseEntry(popupData, data), looseEntry(shows, showsValue), looseEntry(showsCache, { cached: true }), looseEntry(deletedShows, [{ name: "Borrado", id: "z" }]), looseEntry(activePopup, "cleaning_utility"), looseEntry(activePage, "edit"), looseEntry(dictionary, { actions: { delete_shows_not_indexed: "Borrar sin indexar", delete_empty_shows: "Borrar vacíos" }, popup: { delete_duplicated_shows: "Duplicados" }, empty: { search: "Nada" } })] as never)
    return render(<CleaningUtility />)
}
const listener = () => vi.mocked(receiveMain).mock.calls[0][1] as (data: string[]) => void
const emptyCallback = () => vi.mocked(requestMain).mock.calls[0][2] as (data: { id: string; name: string }[] | undefined) => void
beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("CleaningUtility", () => {
    it("al_montar_vacia_popupData_y_pide_la_lista_y_los_vacios_con_los_mismos_argumentos", () => {
        montar()
        expect(get(popupData)).toEqual({})
        expect(receiveMain).toHaveBeenCalledWith(Main.FULL_SHOWS_LIST, expect.any(Function))
        expect(sendMain).toHaveBeenCalledWith(Main.FULL_SHOWS_LIST)
        expect(requestMain).toHaveBeenCalledWith(Main.GET_EMPTY_SHOWS, { cached: { cached: true } }, expect.any(Function), 60000)
    })

    it("detecta_duplicados_sin_numero_final_y_ofrece_borrarlos", () => {
        montar()
        act(() => listener()(["a.show", "b.show", "c.show", "d.show"]))
        fireEvent.click(screen.getByText("Duplicados"))
        expect(get(popupData)).toEqual({ id: "delete_duplicated_shows", data: [{ ids: ["a", "b"] }] })
        expect(get(activePopup)).toBe("delete_duplicated_shows")
    })

    it("sin_nada_que_limpiar_muestra_el_mensaje", () => {
        montar({ type: "shows" }, { c: { name: "Otra" } })
        act(() => listener()(["c.show"]))
        expect(screen.getByText(/Nada/)).toBeTruthy()
    })

    it("con_mas_archivos_que_shows_indexados_ofrece_borrar_los_rotos_y_refresca_a_los_800ms", () => {
        montar({ type: "shows" }, { c: { name: "Otra" } })
        act(() => listener()(["c.show", "x.show", "y.show"]))
        const boton = screen.getByText("Borrar sin indexar").closest("button") as HTMLElement
        expect(boton.textContent).toContain("2")
        vi.mocked(sendMain).mockClear()
        fireEvent.click(boton)
        expect(sendMain).toHaveBeenCalledWith(Main.DELETE_SHOWS_NI, { shows: { c: { name: "Otra" } } })
        expect(sendMain).toHaveBeenCalledTimes(1)
        act(() => vi.advanceTimersByTime(800))
        expect(sendMain).toHaveBeenLastCalledWith(Main.FULL_SHOWS_LIST)
    })

    it("la_lista_ignora_los_shows_ya_borrados", () => {
        montar({ type: "shows" }, { c: { name: "Otra" } })
        act(() => listener()(["c.show", "Borrado.show"]))
        expect(screen.queryByText("Borrar sin indexar")).toBeNull()
    })

    it("muestra_el_loader_mientras_pide_los_vacios_si_hay_algo_que_limpiar", () => {
        const { container } = montar({ type: "shows" }, { c: { name: "Otra" } })
        act(() => listener()(["c.show", "x.show"]))
        expect(container.querySelector("[data-isla='Loader']")).toBeTruthy()
        act(() => emptyCallback()([{ id: "e1", name: "Vacío uno" }]))
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })

    it("borrar_vacios_manda_la_lista_y_va_a_la_pagina_show", () => {
        montar()
        act(() => emptyCallback()([{ id: "e1", name: "Vacío uno" }]))
        fireEvent.click(screen.getByText("Borrar vacíos"))
        expect(sendMain).toHaveBeenCalledWith(Main.DELETE_SHOWS, { shows: [{ id: "e1", name: "Vacío uno" }] })
        expect(get(activePage)).toBe("show")
    })

    it("la_lista_de_vacios_se_despliega_con_la_flecha", () => {
        const { container } = montar()
        act(() => emptyCallback()([{ id: "e1", name: "Vacío uno" }]))
        expect(screen.queryByText("Vacío uno")).toBeNull()
        fireEvent.click(container.querySelectorAll("button")[1] as HTMLElement)
        expect(screen.getByText("Vacío uno")).toBeTruthy()
    })

    it("si_el_pedido_de_vacios_vuelve_sin_datos_deja_de_cargar", () => {
        const { container } = montar({ type: "shows" }, { c: { name: "Otra" } })
        act(() => listener()(["c.show", "x.show"]))
        act(() => emptyCallback()(undefined))
        expect(container.querySelector("[data-isla='Loader']")).toBeNull()
    })

    it("con_otro_tipo_no_muestra_nada", () => {
        const { container } = montar({ type: "otro" })
        expect(container.innerHTML).toBe("")
    })

    it("al_desmontar_quita_el_receptor", () => {
        const { unmount } = montar()
        unmount()
        expect(destroyMain).toHaveBeenCalledWith("listener-1")
    })
})
