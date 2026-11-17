// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { convertText } from "../../converters/txt"
import { history } from "../../components/helpers/history"
import { activePopup, activeProject, activeShow, categories, dictionary, drawerTabsData, formatNewShow, quickTextCache, shows, special, splitLines } from "../../stores"
import { newToast } from "../../utils/common"
import { clearFields, fields, fire } from "../test/kitMocks"
import { clearIslands, emit, islands } from "../test/islandMock"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { customIconsColors } from "../../values/customIcons"
import { CreateShow } from "./CreateShow"

vi.mock("../../utils/shortcuts", () => ({ getNormalizedKey: (e: KeyboardEvent) => e.key }))
vi.mock("uid", () => ({ uid: () => "cat-nueva" }))
vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../converters/txt", () => ({ convertText: vi.fn(), getQuickExample: () => "ejemplo", trimNameFromString: (t: string) => `nombre:${t.slice(0, 3)}` }))
vi.mock("../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../components/helpers/show", () => ({ checkName: (n: string) => `check:${n}` }))
vi.mock("../../classes/Show", () => ({
    ShowObj: class {
        name = ""
        constructor(
            public template: boolean,
            public category: string | null
        ) {}
    }
}))
vi.mock("../bridge/SvelteIsland", async () => ({ SvelteIsland: (await vi.importActual<typeof import("../test/islandMock")>("../test/islandMock")).SvelteIslandMock }))
vi.mock("./WebSearch", () => ({
    WebSearch: (props: { query?: string; onUpdate?: (data: unknown) => void }) => {
        islands.WebSearch = { props: { query: props.query }, events: { update: (e: CustomEvent) => props.onUpdate?.(e.detail) } }
        return <div data-isla="WebSearch" />
    }
}))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/number-field/NumberField", async () => ({ NumberField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/textarea-field/TextareaField", async () => ({ TextareaField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/choice-grid/ChoiceGrid", async () => {
    const { FieldMock } = await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")
    return { ChoiceGrid: (p: object) => <FieldMock {...p} label="choice" /> }
})

const CATS = { song: { name: "Canciones", icon: "song" }, a: { name: "Alfa" }, z: { name: "Zeta", icon: "other" } }
let restaurar: () => void = () => {}
function montar(extra: ReturnType<typeof looseEntry>[] = []) {
    restaurar = setStoresForTest([looseEntry(categories, CATS), looseEntry(drawerTabsData, {}), looseEntry(shows, { s1: { name: "Existe", category: "z" } }), looseEntry(activeShow, null), looseEntry(activeProject, "p1"), looseEntry(quickTextCache, { name: "", text: "" }), looseEntry(special, {}), storeEntry(formatNewShow, false), storeEntry(splitLines, 0), storeEntry(activePopup, "show"), storeEntry(dictionary, {}), ...extra] as never)
    return render(<CreateShow />)
}
const choose = (id: string) => fire("choice", "onClick", id)
const options = () => fields.choice.options as { id: string; name: string; title: string; colored?: boolean; disabled?: boolean }[]
const catId = () => fields["show.category"].value

beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    clearIslands()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("CreateShow", () => {
    it("renderiza_nombre_categoría_y_las_tres_opciones", () => {
        montar()
        expect(fields["show.name"]).toMatchObject({ id: "name", autofocus: true, value: "" })
        expect(options().map((o) => o.id)).toEqual(["text", "web", "empty"])
        expect(options()[1].disabled).toBe(true)
        expect(options()[2].name).toBe("create_show.empty")
    })

    it("categorías_ordenadas_por_nombre_con_ícono_y_color", () => {
        montar()
        expect(fields["show.category"].options).toEqual([
            { label: "Alfa", value: "a", icon: "unlabeled", iconColor: "#FFFFFF" },
            { label: "Canciones", value: "song", icon: "song", iconColor: customIconsColors.song },
            { label: "Zeta", value: "z", icon: "other", iconColor: undefined }
        ])
        expect(fields["show.category"]).toMatchObject({ addNew: "new.category" })
    })

    it("la_categoría_inicial_es_song_si_existe", () => {
        montar()
        expect(catId()).toBe("song")
    })

    it("la_subpestaña_activa_del_cajón_manda_sobre_song", () => {
        montar([looseEntry(drawerTabsData, { shows: { activeSubTab: "z" } })])
        expect(catId()).toBe("z")
    })

    it("sin_subpestaña_usa_la_categoría_del_show_activo", () => {
        montar([looseEntry(activeShow, { id: "s1" })])
        expect(catId()).toBe("z")
    })

    it("sin_song_ni_pistas_usa_la_segunda_categoría_ordenada", () => {
        montar([looseEntry(categories, { a: { name: "Alfa" }, b: { name: "Beta" } })])
        expect(catId()).toBe("b")
    })

    it("escribir_el_nombre_lo_guarda_en_quickTextCache_y_el_autocompletado_sale_del_texto", () => {
        montar()
        fire("show.name", "onInput", "Mi canción")
        expect(get(quickTextCache)).toEqual({ name: "Mi canción", text: "" })
        expect(fields["show.name"].value).toBe("Mi canción")
        expect(fields["show.name"].autofill).toBe("")
    })

    it("elegir_vacío_sin_texto_crea_un_show_con_history_UPDATE_y_cierra", () => {
        montar([looseEntry(activeShow, { id: "s1", index: 2 })])
        fire("show.name", "onInput", "Nuevo")
        choose("empty")
        expect(convertText).not.toHaveBeenCalled()
        expect(history).toHaveBeenCalledWith({
            id: "UPDATE",
            newData: { data: expect.objectContaining({ name: "check:Nuevo", category: "z" }), remember: { project: "p1", index: 3 } },
            location: { page: "show", id: "show" }
        })
        expect(get(quickTextCache)).toEqual({ name: "", text: "" })
        expect(get(activePopup)).toBeNull()
    })

    it("sin_show_activo_el_índice_a_recordar_es_undefined", () => {
        montar()
        choose("empty")
        expect(vi.mocked(history).mock.calls[0][0].newData.remember).toEqual({ project: "p1", index: undefined })
    })

    it("la_opción_vacío_pasa_a_llamarse_show_cuando_hay_texto_y_la_de_texto_se_colorea", () => {
        montar()
        choose("text")
        fire("create_show.quick_lyrics", "onInput", "letra")
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)
        expect(options()[2].name).toBe("new.show")
        expect(options()[0].colored).toBeTruthy()
    })

    it("con_letra_crear_llama_a_convertText_con_nombre_categoría_texto_y_origen", () => {
        montar()
        fire("show.name", "onInput", "Canción")
        choose("text")
        fire("create_show.quick_lyrics", "onInput", "línea 1\n\nlínea 2")
        fireEvent.click(document.querySelector("[data-testid='create.show.popup.new.show']") as HTMLElement)
        expect(convertText).toHaveBeenCalledWith({ name: "Canción", category: "song", text: "línea 1\n\nlínea 2", origin: "" })
        expect(history).not.toHaveBeenCalled()
        expect(get(quickTextCache)).toEqual({ name: "", text: "" })
        expect(get(activePopup)).toBeNull()
    })

    it("el_botón_crear_está_deshabilitado_sin_letra_y_muestra_el_nombre_derivado", () => {
        montar()
        choose("text")
        const boton = () => document.querySelector("[data-testid='create.show.popup.new.show']") as HTMLButtonElement
        expect(boton().disabled).toBe(true)
        expect(boton().textContent).toContain("main.unnamed")
        fire("create_show.quick_lyrics", "onInput", "letra larga")
        expect(boton().disabled).toBe(false)
        expect(boton().textContent).toContain("nombre:let")
    })

    it("elegir_web_avisa_si_ya_existe_un_show_con_ese_nombre_y_monta_la_búsqueda", () => {
        montar()
        fire("show.name", "onInput", "existe")
        choose("web")
        expect(newToast).toHaveBeenCalledWith("create_show.exists")
        expect(islands.WebSearch.props).toEqual({ query: "existe" })
    })

    it("web_con_letra_la_pone_en_el_texto_con_metadatos_y_el_origen", () => {
        montar()
        fire("show.name", "onInput", "mi canción")
        choose("web")
        emit("WebSearch", "update", { title: "Título", artist: "Artista", lyrics: "la letra", source: "Genius" })
        expect(fields["create_show.quick_lyrics"].value).toBe("Title=Título\nArtist=Artista\n\nla letra")
        fire("create_show.quick_lyrics", "onInput", "Title=Título\nArtist=Artista\n\nla letra")
        fireEvent.click(document.querySelector("[data-testid='create.show.popup.new.show']") as HTMLElement)
        expect(convertText).toHaveBeenCalledWith({ name: "Título", category: "song", text: "Title=Título\nArtist=Artista\n\nla letra", origin: "genius" })
    })

    it("web_sin_letra_vuelve_al_inicio", () => {
        montar()
        fire("show.name", "onInput", "x")
        choose("web")
        emit("WebSearch", "update", {})
        expect(fields["show.name"]).toBeDefined()
        expect(document.querySelector("button.popup-back")).toBeNull()
    })

    it("el_botón_volver_regresa_a_la_pantalla_inicial", () => {
        montar()
        choose("text")
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)
        expect(document.querySelector("button.popup-back")).toBeNull()
    })

    it("restaura_el_texto_guardado_si_pasa_de_20_caracteres", () => {
        montar([looseEntry(quickTextCache, { name: "Guardado", text: "x".repeat(25) })])
        expect(fields["show.name"].value).toBe("Guardado")
        choose("text")
        expect(fields["create_show.quick_lyrics"].value).toBe("x".repeat(25))
    })

    it("un_texto_corto_guardado_no_se_restaura", () => {
        montar([looseEntry(quickTextCache, { name: "Guardado", text: "corto" })])
        expect(fields["show.name"].value).toBe("")
    })

    it("fromSearch_restaura_siempre_y_limpia_la_marca", () => {
        montar([looseEntry(quickTextCache, { name: "N", text: "t", fromSearch: true })])
        expect(fields["show.name"].value).toBe("N")
        expect(get(quickTextCache)).toEqual({ name: "N", text: "t" })
    })

    it("más_opciones_guarda_autoGroups_formatNewShow_y_splitLines", () => {
        montar([looseEntry(special, { x: 1 })])
        choose("text")
        fireEvent.click(document.querySelector("button.popup-options") as HTMLElement)
        expect(fields["create_show.auto_groups"].checked).toBe(true)
        fire("create_show.auto_groups", "onChange", false)
        expect(get(special)).toEqual({ x: 1, autoGroups: false })
        fire("create_show.format_new_show", "onChange", true)
        expect(get(formatNewShow)).toBe(true)
        fire("create_show.split_lines", "onChange", 4)
        expect(get(splitLines)).toBe(4)
        expect(fields["create_show.quick_lyrics"].rows).toBe(6)
    })

    it("agregar_categoría_crea_la_categoría_con_history_y_la_selecciona", () => {
        montar()
        fire("show.category", "onNew", "Nueva")
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: { name: "Nueva", icon: "song" } }, oldData: { id: "cat-nueva" }, location: { page: "drawer", id: "category_shows" } })
        expect(catId()).toBe("cat-nueva")
        expect((fields["show.category"].options as { value: string }[]).map((o) => o.value)).toContain("cat-nueva")
    })

    it("cambiar_de_categoría_la_usa_al_crear", () => {
        montar()
        fire("show.category", "onChange", "a")
        choose("empty")
        expect(vi.mocked(history).mock.calls[0][0].newData.data.category).toBe("a")
    })

    it("atajos_Ctrl+F_abre_la_búsqueda_Enter_el_texto_y_Ctrl+Enter_crea", () => {
        montar()
        fire("show.name", "onInput", "Algo")
        fireEvent.keyDown(window, { key: "f", ctrlKey: true })
        expect(islands.WebSearch).toBeDefined()
        fireEvent.click(document.querySelector("button.popup-back") as HTMLElement)

        fireEvent.keyDown(window, { key: "Enter" })
        expect(fields["create_show.quick_lyrics"]).toBeDefined()
        fire("create_show.quick_lyrics", "onInput", "letra")
        fireEvent.keyDown(window, { key: "Enter", ctrlKey: true })
        expect(convertText).toHaveBeenCalledWith({ name: "Algo", category: "song", text: "letra", origin: "" })
        expect(get(activePopup)).toBeNull()
    })

    it("el_listener_de_teclado_se_quita_al_desmontar", () => {
        const { unmount } = montar()
        unmount()
        fireEvent.keyDown(window, { key: "Enter", ctrlKey: true })
        expect(history).not.toHaveBeenCalled()
    })
})
