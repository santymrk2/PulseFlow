// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getContrast } from "../../shared/utils/helpers/color"
import { activeRename, dictionary, fullColors, templates } from "../../shared/core/stores"
import { getAccess } from "../../shared/utils/profile"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Label } from "./Label"
import styles from "./Label.module.css"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/utils/profile", () => ({ getAccess: vi.fn(() => ({})) }))

let restaurar: () => void = () => {}
const raiz = (container: HTMLElement) => container.firstElementChild as HTMLElement

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([storeEntry(fullColors, false), storeEntry(activeRename, null), storeEntry(dictionary, { main: { unnamed: "Sin nombre" } }), looseEntry(templates, { t1: { name: "Viejo" } })])
})

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

describe("Label", () => {
    it("renderiza_el_titulo_y_el_data_title", () => {
        const { container } = render(<Label label="Mi etiqueta" title="ruta/del/archivo" />)
        expect(screen.getByText("Mi etiqueta")).toBeTruthy()
        expect(raiz(container).getAttribute("data-title")).toBe("ruta/del/archivo")
        expect(raiz(container).classList.contains(styles.label)).toBe(true)
        expect(raiz(container).classList.contains(styles.padding)).toBe(true)
    })

    it("sin_titulo_muestra_unnamed_y_el_count_con_el_estilo", () => {
        const { container } = render(<Label label="" count={7} />)
        expect(screen.getByText("Sin nombre")).toBeTruthy()
        expect(screen.getByText("7")).toBeTruthy()
        const titulo = raiz(container).querySelector(`.${styles.title}`) as HTMLElement
        expect(titulo.style.marginInlineEnd).toBe("14px")
    })

    it("fullColors_pinta_el_fondo_y_el_contraste_del_color", () => {
        restaurar = setStoresForTest([storeEntry(fullColors, true)])
        const { container } = render(<Label label="X" color="#ffffff" />)
        expect(raiz(container).style.backgroundColor).toBe("#ffffff")
        expect(raiz(container).style.color).toBe(getContrast("#ffffff"))
    })

    it("sin_fullColors_en_modo_lista_no_pone_borde_inline_y_si_la_clase_list", () => {
        const { container } = render(<Label label="X" color="var(--primary-lighter)" mode="list" />)
        // El Svelte original deja el estilo vacío ("") en modo lista: el borde no se aplica por inline style.
        expect(raiz(container).style.borderBottom).toBe("")
        expect(raiz(container).getAttribute("style")).toBeNull()
        expect(raiz(container).classList.contains(styles.list)).toBe(true)
        expect(raiz(container).classList.contains(styles.padding)).toBe(true)
    })

    it("icono_protected_es_mas_chico_semitransparente_y_alinea_el_titulo", () => {
        const { container } = render(<Label label="X" icon="protected" />)
        const icono = container.querySelector("svg") as SVGElement
        expect(icono.classList.contains("icon")).toBe(true)
        expect(icono.style.opacity).toBe("0.6")
        expect(icono.getAttribute("width")).toBe("0.6rem")
        expect(raiz(container).classList.contains(styles.alignRight)).toBe(true)
    })

    it("renameId_confirma_el_cambio_y_actualiza_la_plantilla", () => {
        activeRename.set("template_t1")
        render(<Label label="Viejo" renameId="template_t1" />)
        const input = document.querySelector("input") as HTMLInputElement
        expect(input).not.toBeNull()
        input.value = "Nuevo"
        input.dispatchEvent(new Event("change", { bubbles: true }))
        expect(get(templates).t1.name).toBe("Nuevo")
        expect(get(templates).t1.modified).toBeTypeOf("number")
    })

    it("renameId_con_acceso_de_solo_lectura_no_escribe_el_store", () => {
        vi.mocked(getAccess).mockReturnValue({ global: "read" } as never)
        activeRename.set("template_t1")
        render(<Label label="Viejo" renameId="template_t1" />)
        const input = document.querySelector("input") as HTMLInputElement
        input.value = "Nuevo"
        input.dispatchEvent(new Event("change", { bubbles: true }))
        expect(get(templates).t1.name).toBe("Viejo")
    })
})
