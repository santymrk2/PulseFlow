// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { get } from "svelte/store"
import { activePage, dictionary, selected } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { DropArea } from "./DropArea"
import styles from "./DropArea.module.css"

const { proyecto } = vi.hoisted(() => ({ proyecto: vi.fn() }))
vi.mock("../../components/helpers/dropActions", () => ({ dropActions: { project: proyecto } }))
vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}
const preparar = (sel: { id: any; data: any[] }) => (restaurar = setStoresForTest([storeEntry(selected, sel), storeEntry(dictionary, { main: { drop: "Soltar acá" } }), storeEntry(activePage, "show")]))

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    proyecto.mockReset()
    vi.useRealTimers()
    vi.restoreAllMocks()
})

const area = () => document.querySelector(".droparea") as HTMLElement
const sinArchivos = { items: [], files: [], getData: () => "" }

describe("DropArea", () => {
    it("renderiza_lo_principal_con_las_clases_globales", () => {
        preparar({ id: null, data: [] })
        render(
            <DropArea id="project">
                <b>hijo</b>
            </DropArea>
        )
        expect(screen.getByText("hijo").parentElement?.classList.contains("ParentBlock")).toBe(true)
        expect(area().classList.contains(styles.droparea)).toBe(true)
        expect(screen.queryByText("Soltar acá")).toBeNull()
    })

    it("children_como_funcion_recibe_fileOver", () => {
        preparar({ id: null, data: [] })
        render(
            <DropArea id="project" file>
                {(over) => <i>{over ? "encima" : "libre"}</i>}
            </DropArea>
        )
        expect(screen.getByText("libre")).toBeTruthy()
        fireEvent.dragOver(area(), { dataTransfer: { items: [{ kind: "file" }] } })
        expect(screen.getByText("encima")).toBeTruthy()
    })

    it("al_soltar_un_dato_valido_llama_a_dropActions_con_los_mismos_argumentos", async () => {
        const sel = { id: "media", data: [{ path: "/a.png" }] }
        preparar(sel)
        render(<DropArea id="project" />)
        // happy-dom ignora los modificadores en el init del DragEvent: se fijan sobre el evento
        const evento = new Event("drop", { bubbles: true, cancelable: true })
        for (const [clave, valor] of Object.entries({ dataTransfer: sinArchivos, shiftKey: false, ctrlKey: true, metaKey: false, altKey: false })) Object.defineProperty(evento, clave, { value: valor })
        fireEvent(area(), evento)
        await vi.waitFor(() => expect(proyecto).toHaveBeenCalledTimes(1))
        expect(proyecto).toHaveBeenCalledWith({ drag: sel, drop: { id: "project", data: {}, trigger: undefined, center: false, index: undefined } }, { id: null, location: { page: get(activePage) } }, { shiftKey: false, ctrlKey: true, altKey: false })
    })

    it("al_soltar_un_dato_que_el_area_no_acepta_no_llama_a_dropActions", async () => {
        preparar({ id: "slide", data: [{ index: 0 }] })
        render(<DropArea id="project" />)
        fireEvent.drop(area(), { dataTransfer: sinArchivos })
        await act(async () => {})
        expect(proyecto).not.toHaveBeenCalled()
    })

    it("al_soltar_archivos_locales_selecciona_files_y_llama_a_dropActions", async () => {
        preparar({ id: null, data: [] })
        const archivo = Object.assign(new File(["x"], "a.png", { type: "image/png" }), { path: "/disco/a.png" })
        render(<DropArea id="project" />)
        fireEvent.drop(area(), { dataTransfer: { items: [{ kind: "file", getAsFile: () => archivo }], files: [archivo], getData: () => "" } })
        await vi.waitFor(() => expect(proyecto).toHaveBeenCalledTimes(1))
        expect(proyecto.mock.calls[0][0].drag).toEqual({ id: "files", data: [archivo] })
    })

    it("al_soltar_una_url_de_media_selecciona_media_con_nombre_y_ruta", async () => {
        preparar({ id: null, data: [] })
        render(<DropArea id="project" />)
        const url = "https://sitio.com/fotos/mi%20foto.png?x=1"
        fireEvent.drop(area(), { dataTransfer: { items: [], files: [], getData: (t: string) => (t === "text/uri-list" ? url : "") } })
        await vi.waitFor(() => expect(proyecto).toHaveBeenCalledTimes(1))
        expect(proyecto.mock.calls[0][0].drag).toEqual({ id: "media", data: [{ name: "mi foto.png", path: url }] })
    })

    it("al_soltar_una_url_que_no_es_media_selecciona_urls", async () => {
        preparar({ id: null, data: [] })
        render(<DropArea id="project" />)
        fireEvent.drop(area(), { dataTransfer: { items: [], files: [], getData: (t: string) => (t === "text/plain" ? "https://sitio.com/pagina" : "") } })
        await vi.waitFor(() => expect(proyecto).toHaveBeenCalledTimes(1))
        expect(proyecto.mock.calls[0][0].drag).toEqual({ id: "urls", data: ["https://sitio.com/pagina"] })
    })

    it("dragstart_en_la_ventana_con_un_dato_valido_muestra_el_texto_y_un_clic_lo_oculta", () => {
        preparar({ id: "media", data: [{}] })
        render(<DropArea id="project" />)
        act(() => {
            window.dispatchEvent(new Event("dragstart"))
        })
        expect(area().classList.contains(styles.hover)).toBe(true)
        expect(screen.getByText("Soltar acá")).toBeTruthy()
        act(() => {
            window.dispatchEvent(new Event("click"))
        })
        expect(area().classList.contains(styles.hover)).toBe(false)
    })

    it("dragstart_con_un_dato_invalido_no_muestra_el_texto", () => {
        preparar({ id: "slide", data: [{}] })
        render(<DropArea id="project" />)
        act(() => {
            window.dispatchEvent(new Event("dragstart"))
        })
        expect(screen.queryByText("Soltar acá")).toBeNull()
    })

    it("dragend_en_la_ventana_deselecciona_y_oculta", () => {
        preparar({ id: "media", data: [{}] })
        render(<DropArea id="project" />)
        act(() => {
            window.dispatchEvent(new Event("dragstart"))
            window.dispatchEvent(new Event("dragend"))
        })
        expect(area().classList.contains(styles.hover)).toBe(false)
        expect(get(selected)).toEqual({ id: null, data: [] })
    })

    it("selectChildren_oculta_el_texto_al_entrar_y_lo_muestra_al_salir", () => {
        vi.useFakeTimers()
        preparar({ id: "media", data: [{}] })
        render(<DropArea id="project" selectChildren hoverTimeout={150} />)
        act(() => {
            window.dispatchEvent(new Event("dragstart"))
        })
        fireEvent.dragEnter(area())
        act(() => {
            vi.advanceTimersByTime(150)
        })
        expect(area().classList.contains(styles.hover)).toBe(false)
        fireEvent.dragLeave(area())
        act(() => {
            vi.advanceTimersByTime(10)
        })
        expect(area().classList.contains(styles.hover)).toBe(true)
    })

    it("tactil_touchstart_muestra_y_touchend_suelta_si_el_dato_es_valido", async () => {
        preparar({ id: "media", data: [{ path: "/a" }] })
        render(<DropArea id="project" />)
        fireEvent.touchStart(area())
        expect(area().classList.contains(styles.hover)).toBe(true)
        fireEvent.touchEnd(area())
        await vi.waitFor(() => expect(proyecto).toHaveBeenCalledTimes(1))
        expect(area().classList.contains(styles.hover)).toBe(false)
    })

    it("limpia_los_listeners_de_window_al_desmontar", () => {
        preparar({ id: "media", data: [{}] })
        const { unmount } = render(<DropArea id="project" />)
        unmount()
        window.dispatchEvent(new Event("dragend"))
        expect(get(selected).id).toBe("media")
    })
})
