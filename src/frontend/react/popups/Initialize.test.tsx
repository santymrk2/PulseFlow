// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { requestMain, sendMain } from "../../IPC/main"
import { activePopup, dataPath, dictionary, guideActive, language, popupData, timeFormat } from "../../stores"
import { createData } from "../../utils/createData"
import { setLanguage } from "../../utils/language"
import { clearFields, fields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Initialize } from "./Initialize"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn(), requestMain: vi.fn() }))
vi.mock("../../utils/createData", () => ({ createData: vi.fn() }))
// el módulo real arrastra un ciclo con common/stores al mockearlo parcialmente: se reemplaza entero con un translateText mínimo
vi.mock("../../utils/language", async () => {
    const { get } = await vi.importActual<typeof import("svelte/store")>("svelte/store")
    const { dictionary: dict } = await vi.importActual<typeof import("../../stores")>("../../stores")
    const translateText = (text: string) => text.replace(/\$?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g, (match, a, b) => get(dict)[a]?.[b] || match)
    return { setLanguage: vi.fn(), getLanguageList: () => [{ value: "en", label: "English" }], translateText }
})
vi.mock("../ui/select-field/SelectField", async () => ({ SelectField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/toggle-field/ToggleField", async () => ({ ToggleField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))
vi.mock("../ui/folder-field/FolderField", async () => ({ FolderField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

const dict = { setup: { good_luck: "Suerte", tips: "Consejos", change_later: "Cambialo luego", get_started: "Empezar" }, settings: { language: "Idioma", data_location: "Carpeta de datos" } }
let restaurar: () => void = () => {}
function montar(ruta = "/vieja") {
    restaurar = setStoresForTest([storeEntry(dataPath, ruta), storeEntry(dictionary, dict), storeEntry(language, "en"), storeEntry(timeFormat, "24"), storeEntry(activePopup, "initialize"), storeEntry(popupData, {}), storeEntry(guideActive, false)] as never)
    return render(<Initialize />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE")
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.restoreAllMocks()
})

describe("Initialize", () => {
    it("renderiza_los_textos_el_selector_de_idioma_y_la_carpeta", () => {
        montar()
        expect(["Suerte", "Consejos", "Empezar"].every((text) => screen.getByText(text))).toBe(true)
        expect(screen.getByText("Cambialo luego:")).toBeTruthy()
        expect(fields["Idioma/Language"].value).toBe("en")
        expect(fields["Idioma/Language"].flags).toBe(true)
        expect(fields["Carpeta de datos"]).toMatchObject({ value: "/vieja", PICK_ID: "DATA_SHOWS", openButton: false })
    })

    it("con_el_idioma_en_ingles_la_etiqueta_no_repite_Language", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { settings: { language: "Language" } }), storeEntry(dataPath, "/x")] as never)
        render(<Initialize />)
        expect(Object.keys(fields)).toContain("Language")
    })

    it("al_montar_pide_la_ruta_de_datos_solo_si_no_hay", () => {
        montar("")
        expect(vi.mocked(sendMain).mock.calls).toEqual([[Main.DATA_PATH]])
        cleanup()
        restaurar()
        vi.clearAllMocks()
        montar("/ya")
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("con_hora_de_12_horas_en_el_navegador_guarda_12", () => {
        vi.spyOn(navigator, "language", "get").mockReturnValue("en-US")
        montar()
        expect(get(timeFormat)).toBe("12")
    })

    it("con_hora_de_24_horas_en_el_navegador_no_toca_timeFormat", () => {
        vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE")
        montar()
        expect(get(timeFormat)).toBe("24")
    })

    it("cambiar_el_idioma_llama_a_setLanguage_con_el_valor", () => {
        montar()
        fire("Idioma/Language", "onChange", "es")
        expect(vi.mocked(setLanguage).mock.calls).toEqual([["es"]])
    })

    it("el_reloj_de_24_horas_escribe_24_o_12", () => {
        montar()
        expect(fields["settings.use24hClock"].checked).toBe(true)
        fire("settings.use24hClock", "onChange", false)
        expect(get(timeFormat)).toBe("12")
        fire("settings.use24hClock", "onChange", true)
        expect(get(timeFormat)).toBe("24")
    })

    it("cambiar_la_carpeta_avisa_al_main_y_guarda_dataPath", () => {
        montar()
        fire("Carpeta de datos", "onChange", "/nueva")
        expect(vi.mocked(sendMain).mock.calls).toEqual([[Main.UPDATE_DATA_PATH, { newPath: "/nueva", oldPath: "/vieja" }]])
        expect(get(dataPath)).toBe("/nueva")
    })

    it("empezar_pide_las_rutas_refresca_shows_activa_la_guia_y_cierra", () => {
        montar()
        fireEvent.click(screen.getByText("Empezar"))
        const [id, valor, callback] = vi.mocked(requestMain).mock.calls[0] as unknown as [string, unknown, (paths?: object) => unknown]
        expect([id, valor]).toEqual([Main.GET_PATHS, undefined])
        expect(vi.mocked(sendMain).mock.calls).toEqual([[Main.REFRESH_SHOWS]])
        expect(get(guideActive)).toBe(true)
        expect(get(activePopup)).toBeNull()

        const paths = { documents: "/docs" }
        callback(paths)
        expect(vi.mocked(createData).mock.calls).toEqual([[paths]])
        vi.mocked(createData).mockClear()
        expect(callback(undefined)).toBeNull()
        expect(createData).not.toHaveBeenCalled()
    })

    it("el_boton_de_restaurar_guarda_back_initialize_y_abre_restore", () => {
        const { container } = montar()
        fireEvent.click(container.querySelector("button.popup-options") as HTMLElement)
        expect(get(popupData)).toEqual({ back: "initialize" })
        expect(get(activePopup)).toBe("restore")
    })
})
