// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../../components/helpers/history"
import { activeProfile, activeRename, categories, dictionary, drawerTabsData, leftSource, profiles, selected, shows } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, type StoreEntry, setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { LibrariesPanel } from "./LibrariesPanel"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const dict = { ui: { libraries: "Bibliotecas", new_library: "Nueva biblioteca" }, category: { unlabeled: "Sin etiqueta" } }
const timestamps = { created: 1700000000000, modified: null, used: null }
const cats = { music: { name: "Z Música" }, video: { name: "A Vídeo", isArchive: true } }
const showsBase = {
    s1: { name: "s1", category: "music", timestamps },
    s2: { name: "s2", category: "music", timestamps },
    s3: { name: "s3", category: "video", timestamps }
}

let restaurar: () => void = () => {}
function montar(extra: StoreEntry[] = []) {
    restaurar = setStoresForTest([storeEntry(activeProfile, null), storeEntry(profiles, {}), storeEntry(categories, { ...cats }), storeEntry(shows, { ...showsBase }), storeEntry(leftSource, null), storeEntry(drawerTabsData, {}), storeEntry(activeRename, null), storeEntry(dictionary, dict), storeEntry(selected, { id: null, data: [] }), ...extra] as never)
    return render(<LibrariesPanel />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
    cleanup()
    restaurar()
})

const filas = () => [...document.querySelectorAll("button.library-row")] as HTMLElement[]
const botonNuevo = () => document.querySelector('[data-title="Nueva biblioteca"]') as HTMLButtonElement

describe("LibrariesPanel", () => {
    it("renderiza_las_bibliotecas_no_archivadas_primero_con_sus_cantidades", () => {
        const { container } = montar()
        expect(screen.getByText("Bibliotecas")).toBeTruthy()
        expect((container.querySelector("header") as HTMLElement).textContent).toContain("2")
        expect(filas().map((f) => f.textContent)).toEqual(["Z Música2", "A Vídeo1"])
    })

    it("conserva_las_clases_de_contexto_y_marca_la_biblioteca_activa", () => {
        montar([storeEntry(leftSource, { type: "library", id: "music" })])
        const fila = filas()[0]
        expect(fila.classList.contains("library-row")).toBe(true)
        expect(fila.classList.contains("context")).toBe(true)
        expect(fila.classList.contains("#category_shows_button")).toBe(true)
        expect(fila.classList.contains("#category_shows_button_readonly")).toBe(false)
        expect(fila.classList.contains("active")).toBe(true)
        expect(fila.getAttribute("aria-current")).toBe("true")
    })

    it("perfil_de_solo_lectura_deshabilita_el_alta_y_marca_las_filas_como_readonly", () => {
        montar([storeEntry(activeProfile, "p"), looseEntry(profiles, { p: { name: "P", access: { shows: { global: "read" } } } })])
        expect(botonNuevo().disabled).toBe(true)
        expect(filas()[0].classList.contains("#category_shows_button_readonly")).toBe(true)
    })

    it("el_boton_nuevo_llama_a_history_con_el_id_de_la_pestaña", () => {
        montar()
        fireEvent.click(botonNuevo())
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    })

    it("elegir_una_biblioteca_escribe_leftSource_y_la_subpestaña_de_shows", () => {
        montar()
        fireEvent.click(filas()[0])
        expect(get(leftSource)).toEqual({ type: "library", id: "music" })
        expect(get(drawerTabsData).shows).toEqual({ enabled: true, activeSubTab: "music" })
    })

    it("renombrar_escribe_el_nombre_en_categories_y_quita_el_default", () => {
        const { container } = montar([storeEntry(activeRename, "category_shows_music"), storeEntry(categories, { music: { name: "Z Música", default: true }, video: { name: "A Vídeo", isArchive: true } })])
        const input = container.querySelector("input.edit") as HTMLInputElement
        expect(input).toBeTruthy()
        fireEvent.change(input, { target: { value: "Renombrada" } })
        expect(get(categories).music.name).toBe("Renombrada")
        expect(get(categories).music.default).toBeUndefined()
    })

    it("muestra_la_fila_de_sin_etiqueta_cuando_hay_shows_sin_biblioteca_y_la_puede_elegir", () => {
        montar([storeEntry(shows, { ...showsBase, s4: { name: "s4", category: "desconocida", timestamps } })])
        const sinEtiqueta = filas().at(-1) as HTMLElement
        expect(sinEtiqueta.textContent).toBe("Sin etiqueta1")
        fireEvent.click(sinEtiqueta)
        expect(get(leftSource)).toEqual({ type: "library", id: "unlabeled" })
    })

    it("oculta_las_bibliotecas_heredadas_vacías_y_la_de_scripture", () => {
        montar([
            storeEntry(categories, {
                ...cats,
                scripture: { name: "Scripture" },
                song: { name: "Songs" },
                presentation: { name: "Presentations" }
            })
        ])
        expect(filas().map((f) => f.textContent)).toEqual(["Z Música2", "A Vídeo1"])
    })
})
