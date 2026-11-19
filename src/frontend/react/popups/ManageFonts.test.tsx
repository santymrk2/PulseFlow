// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadCustomFont } from "../../components/helpers/fonts"
import { customFonts, special } from "../../shared/core/stores"
import { newToast } from "../../utils/common"
import { clearFields, fields, fire } from "../test/kitMocks"
import { looseEntry, setStoresForTest } from "../test/storeTestKit"
import { ManageFonts } from "./ManageFonts"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../components/helpers/fonts", () => ({
    defaultFonts: ["CMGSans", "Arial"],
    getSystemFontsList: vi.fn(async () => [
        { label: "Arial", value: "Arial", style: "font-family: Arial;" },
        { label: "Zapf", value: "Zapf", style: "font-family: Zapf, sans-serif;" }
    ]),
    loadCustomFont: vi.fn()
}))
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/file-field/FileField", async () => ({ FileField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
async function montar(personalizadas: object[] = [], hiddenFonts?: string[]) {
    restaurar = setStoresForTest([looseEntry(customFonts, personalizadas), looseEntry(special, hiddenFonts ? { hiddenFonts } : {})])
    const view = render(<ManageFonts />)
    await act(async () => {})
    return view
}
const agregar = () => fireEvent.click(screen.getByText("[settings.add]").closest("button") as HTMLElement)
const google = () => document.querySelector("button[data-title='Import from Google Fonts']") as HTMLButtonElement
const escribir = (familia: string) => fire("settings.font_family", "onChange", familia)
const abrirFila = (nombre: string) => fireEvent.click(screen.getByText(nombre).closest(".row")?.querySelector("[data-title='main.open']") as HTMLElement)
beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCustomFont).mockResolvedValue(true)
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("ManageFonts", () => {
    it("muestra_integradas_y_del_sistema_con_sus_cantidades_sin_las_integradas_repetidas", async () => {
        await montar()
        expect(screen.getByText("[example.default]").parentElement?.textContent).toContain("2")
        const sistema = screen.getByText("System").parentElement as HTMLElement
        expect(sistema.textContent).toBe("System1")
        expect(screen.getByText("[empty.general]")).toBeTruthy()
    })

    it("el_menu_de_integradas_lista_cada_fuente_con_su_familia", async () => {
        await montar()
        abrirFila("[example.default]")
        const nombre = screen.getByText("CMGSans")
        expect(nombre.style.fontFamily).toBe("CMGSans, sans-serif")
        expect(screen.getByText("Arial")).toBeTruthy()
    })

    it("ocultar_una_fuente_del_sistema_la_guarda_en_hiddenFonts_y_cambia_el_contador", async () => {
        await montar()
        abrirFila("System")
        const zapf = screen.getByText("Zapf")
        expect(zapf.getAttribute("style")).toContain("Zapf")
        fireEvent.click(document.querySelector("[data-title='profile.hide']") as HTMLElement)
        expect(get(special).hiddenFonts).toEqual(["Zapf"])
        expect(screen.getByText("System").parentElement?.textContent).toBe("System1 (0)")
        fireEvent.click(document.querySelector("[data-title='profile.show']") as HTMLElement)
        expect(get(special).hiddenFonts).toEqual([])
    })

    it("respeta_las_fuentes_ocultas_guardadas", async () => {
        await montar([], ["Zapf"])
        expect(screen.getByText("System").parentElement?.textContent).toBe("System1 (0)")
    })

    it("lista_las_personalizadas_y_borrar_saca_la_de_ese_indice", async () => {
        await montar([
            { type: "local", name: "Mia", path: "/m.ttf" },
            { type: "google", name: "Roboto" }
        ])
        expect(screen.queryByText("[empty.general]")).toBeNull()
        expect(screen.getByText("/m.ttf")).toBeTruthy()
        expect(screen.getByText("Google Fonts").parentElement?.getAttribute("data-title")).toBe("Google Fonts")
        fireEvent.click(document.querySelectorAll("[data-title='actions.delete']")[0] as HTMLElement)
        expect(get(customFonts)).toEqual([{ type: "google", name: "Roboto" }])
    })

    describe("agregar", () => {
        it("muestra_el_formulario_y_deshabilita_el_boton_agregar_y_los_campos", async () => {
            await montar()
            expect(screen.queryByText("[empty.general]")).toBeTruthy()
            agregar()
            expect(screen.queryByText("[empty.general]")).toBeNull()
            expect((screen.getByText("[settings.add]").closest("button") as HTMLButtonElement).disabled).toBe(true)
            expect(fields["scripture.local (.woff/.ttf/.otf)"]).toMatchObject({ disabled: true, title: "actions.import", icon: "text", filter: { name: "Font File", extensions: ["woff", "woff2", "ttf", "otf"] } })
            expect(google().disabled).toBe(true)
        })

        it("una_familia_valida_habilita_importar_y_se_guarda_sin_espacios", async () => {
            await montar()
            agregar()
            escribir("  Roboto  ")
            expect(fields["scripture.local (.woff/.ttf/.otf)"].disabled).toBe(false)
            expect(google().disabled).toBe(false)
            expect(newToast).not.toHaveBeenCalled()
        })

        it("vacia_no_avisa_y_deja_todo_deshabilitado", async () => {
            await montar()
            agregar()
            escribir("   ")
            expect(fields["scripture.local (.woff/.ttf/.otf)"].disabled).toBe(true)
            expect(newToast).not.toHaveBeenCalled()
        })

        it("el_nombre_repetido_de_una_personalizada_avisa_sin_importar_mayusculas", async () => {
            await montar([{ type: "google", name: "Roboto" }])
            agregar()
            escribir("roboto")
            expect(vi.mocked(newToast).mock.calls).toEqual([['Font with name "roboto" already exists']])
            expect(fields["scripture.local (.woff/.ttf/.otf)"].disabled).toBe(true)
        })

        it("el_nombre_de_una_fuente_del_sistema_o_integrada_avisa", async () => {
            await montar()
            agregar()
            escribir("zapf")
            escribir("CMGSANS")
            expect(vi.mocked(newToast).mock.calls).toEqual([['Font with name "zapf" already exists as a system font'], ['Font with name "CMGSANS" already exists as a system font']])
        })

        it("google_carga_la_fuente_la_agrega_y_cierra_el_formulario", async () => {
            await montar()
            agregar()
            escribir("Roboto")
            await act(async () => fireEvent.click(google()))
            expect(vi.mocked(loadCustomFont).mock.calls).toEqual([[{ type: "google", name: "Roboto" }]])
            expect(get(customFonts)).toEqual([{ type: "google", name: "Roboto" }])
            expect(document.querySelector("[data-field='settings.font_family']")).toBeNull()
            expect((screen.getByText("[settings.add]").closest("button") as HTMLButtonElement).disabled).toBe(false)
        })

        it("un_archivo_local_se_agrega_con_su_ruta", async () => {
            await montar()
            agregar()
            escribir("Mia")
            await act(async () => fire("scripture.local (.woff/.ttf/.otf)", "onChange", "/m.ttf"))
            expect(vi.mocked(loadCustomFont).mock.calls).toEqual([[{ type: "local", name: "Mia", path: "/m.ttf" }]])
            expect(get(customFonts)).toEqual([{ type: "local", name: "Mia", path: "/m.ttf" }])
        })

        it("si_no_se_puede_cargar_avisa_y_deja_el_formulario_abierto_sin_agregar", async () => {
            vi.mocked(loadCustomFont).mockResolvedValue(false)
            await montar()
            agregar()
            escribir("Rota")
            await act(async () => fireEvent.click(google()))
            expect(vi.mocked(newToast).mock.calls).toEqual([["Could not load font"]])
            expect(get(customFonts)).toEqual([])
            expect(fields["settings.font_family"].value).toBe("Rota")
            expect(google().disabled).toBe(false)
        })

        it("mientras_carga_un_segundo_intento_se_ignora_y_se_bloquea_borrar", async () => {
            let terminar: (ok: boolean) => void = () => {}
            vi.mocked(loadCustomFont).mockReturnValue(new Promise((resolve) => (terminar = resolve)))
            await montar([{ type: "google", name: "Otra" }])
            agregar()
            escribir("Roboto")
            const boton = google()
            fireEvent.click(boton)
            fireEvent.click(boton)
            expect(loadCustomFont).toHaveBeenCalledTimes(1)
            expect((document.querySelector("[data-title='actions.delete']") as HTMLButtonElement).disabled).toBe(true)
            expect(fields["settings.font_family"].disabled).toBe(true)
            await act(async () => terminar(true))
            expect(get(customFonts)).toEqual([
                { type: "google", name: "Otra" },
                { type: "google", name: "Roboto" }
            ])
        })
    })
})
