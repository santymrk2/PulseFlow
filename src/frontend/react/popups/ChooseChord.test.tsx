// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dictionary, popupData, special, storedChordsData } from "../../shared/core/stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ChooseChord } from "./ChooseChord"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../shared/utils/helpers/caretHelper", () => ({ pasteText: vi.fn() }))

let restaurar: () => void = () => {}
function montar(stored: object = {}, sp: object = {}) {
    restaurar = setStoresForTest([storeEntry(storedChordsData, stored), storeEntry(special, sp), storeEntry(popupData, {}), storeEntry(dictionary, { actions: { roman_keys: "Cifrado romano", custom_key: "Acorde propio", chord_key: "Tono", chord_type: "Tipo", chord_tension: "Tensión", chord_bass: "Bajo", select_chord: "Elegir acorde" } })] as never)
    return render(<ChooseChord />)
}
const listas = (c: HTMLElement) => [...c.querySelectorAll("p")].map((p) => p.parentElement as HTMLElement)
const boton = (lista: HTMLElement, texto: string) => [...lista.querySelectorAll("button")].find((b) => b.textContent === texto) as HTMLElement
const resultado = (c: HTMLElement) => c.querySelector("button span[style*='bold']")?.textContent
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ChooseChord", () => {
    it("renderiza_cuatro_listas_y_el_acorde_C_por_defecto", () => {
        const { container } = montar()
        expect(listas(container).length).toBe(4)
        expect(screen.getByText("Cifrado romano")).toBeTruthy()
        expect(resultado(container)).toBe("C")
    })

    it("elegir_tono_tipo_tension_y_bajo_arma_el_acorde_y_el_bajo_sigue_al_tono", () => {
        const { container } = montar()
        fireEvent.click(boton(listas(container)[0], "D"))
        expect(resultado(container)).toBe("D")
        fireEvent.click(boton(listas(container)[1], "m"))
        fireEvent.click(boton(listas(container)[2], "7"))
        expect(resultado(container)).toBe("Dm7")
        fireEvent.click(boton(listas(container)[3], "G"))
        expect(resultado(container)).toBe("Dm7/G")
    })

    it("clic_en_el_tipo_activo_lo_quita", () => {
        const { container } = montar()
        fireEvent.click(boton(listas(container)[1], "m"))
        fireEvent.click(boton(listas(container)[1], "m"))
        expect(resultado(container)).toBe("C")
    })

    it("el_acorde_propio_gana_y_deshabilita_los_botones", () => {
        const { container } = montar()
        fireEvent.input(container.querySelector("input:not([type=checkbox])") as HTMLInputElement, { target: { value: "Fsus" } })
        expect(resultado(container)).toBe("Fsus")
        expect((boton(listas(container)[0], "D") as HTMLButtonElement).disabled).toBe(true)
    })

    it("el_cifrado_romano_cambia_la_lista_y_oculta_el_bajo", () => {
        const { container } = montar()
        fireEvent.click(screen.getByText("Cifrado romano"))
        expect(listas(container).length).toBe(3)
        fireEvent.click(boton(listas(container)[0], "IV"))
        fireEvent.click(boton(listas(container)[1], "m"))
        expect(resultado(container)).toBe("IVm")
    })

    it("carga_lo_guardado_y_cada_cambio_se_guarda_en_storedChordsData", () => {
        const { container } = montar({ key: "E", romanKey: "I", type: "m", tension: "", bass: "E", custom: "", romanKeysActive: false })
        expect(resultado(container)).toBe("Em")
        fireEvent.click(boton(listas(container)[2], "9"))
        expect(get(storedChordsData)).toMatchObject({ key: "E", type: "m", tension: "9" })
        expect(resultado(container)).toBe("Em9")
    })

    it("sin_datos_guardados_no_escribe_el_store_al_montar", () => {
        montar()
        expect(get(storedChordsData)).toEqual({})
    })

    it("solo_romanKeysActive_guardado_arranca_en_romano", () => {
        const { container } = montar({ romanKeysActive: true })
        expect(listas(container).length).toBe(3)
        expect(resultado(container)).toBe("I")
    })

    it("elegir_acorde_deja_el_valor_en_popupData", () => {
        const { container } = montar()
        fireEvent.click(boton(listas(container)[0], "A"))
        fireEvent.click(container.querySelector("button span[style*='bold']")?.closest("button") as HTMLElement)
        expect(get(popupData)).toEqual({ id: "choose_chord", value: "A" })
    })

    it("notacion_alemana_cambia_B_por_H_y_escribe_special", () => {
        const { container } = montar()
        expect(boton(listas(container)[0], "B")).toBeTruthy()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        fireEvent.click(screen.getByText("German notation (H/B)"))
        expect(get(special).germanNotation).toBe(true)
        expect(boton(listas(container)[0], "H")).toBeTruthy()
        expect(boton(listas(container)[0], "B")).toBeTruthy() // B♭ pasa a "B"
    })

    it("el_titulo_de_la_lista_de_tonos_invierte_sostenidos_y_bemoles", () => {
        const { container } = montar()
        fireEvent.mouseDown(container.querySelector("p") as HTMLElement)
        expect(boton(listas(container)[0], "D♭")).toBeTruthy()
    })
})
