// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { audioStreams, dictionary, popupData, selected } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { AudioStream } from "./AudioStream"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../import/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../edit/logic/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/show", () => ({ getLayoutRef: () => [{ data: { actions: { x: 1 } } }, { data: { actions: { y: 2 } } }] }))

let restaurar: () => void = () => {}
function montar(data: object, sel: { id: string | null; data: unknown[] } = { id: null, data: [] }) {
    restaurar = setStoresForTest([storeEntry(popupData, data), storeEntry(selected, sel), storeEntry(audioStreams, { a: { name: "Radio", value: "http://radio" }, b: { name: "Alabanza", value: "http://alabanza" } }), storeEntry(dictionary, { inputs: { name: "Nombre" }, variables: { value: "Valor" }, empty: { general: "Vacío" } })] as never)
    return render(<AudioStream />)
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
})

describe("AudioStream", () => {
    it("al_montar_vacia_popupData", () => {
        montar({ dropdown: true, index: 1 })
        expect(get(popupData)).toEqual({})
    })

    it("sin_dropdown_edita_el_stream_seleccionado_nombre_y_valor", () => {
        const { container } = montar({}, { id: "audio_stream", data: [{ id: "a" }] })
        const [nombre, valor] = [...container.querySelectorAll("input")]
        expect(nombre.value).toBe("Radio")
        expect(valor.value).toBe("http://radio")
        fireEvent.change(nombre, { target: { value: "Radio 2" } })
        expect(get(audioStreams).a).toEqual({ name: "Radio 2", value: "http://radio" })
    })

    it("un_valor_vacio_no_toca_el_store", () => {
        const { container } = montar({}, { id: "audio_stream", data: [{ id: "a" }] })
        fireEvent.change(container.querySelector("input") as HTMLInputElement, { target: { value: "" } })
        expect(get(audioStreams).a.name).toBe("Radio")
    })

    it("sin_seleccion_crea_un_stream_nuevo_al_escribir", () => {
        const { container } = montar({})
        const antes = Object.keys(get(audioStreams))
        fireEvent.change(container.querySelector("input") as HTMLInputElement, { target: { value: "Nuevo" } })
        const nuevo = Object.entries(get(audioStreams)).find(([id]) => !antes.includes(id))
        expect(nuevo?.[1]).toEqual({ name: "Nuevo", value: "" })
    })

    it("dropdown_elegir_un_stream_guarda_la_accion_audioStream_en_el_slide_con_history", () => {
        vi.useFakeTimers()
        const { container } = montar({ dropdown: true, index: 1 })
        fireEvent.click(container.querySelector(".dropdownElem button") as HTMLElement)
        fireEvent.click(screen.getByText("Radio"))
        act(() => {
            vi.advanceTimersByTime(50)
        })
        expect(history).toHaveBeenCalledWith({ id: "SHOW_LAYOUT", newData: { key: "actions", data: { y: 2, audioStream: "a" }, indexes: [1] }, location: { page: "show", override: "audio_stream" } })
    })
})
