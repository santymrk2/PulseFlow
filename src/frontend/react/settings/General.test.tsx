// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// commonMock tiene que cargarse antes que utils/language, que importa utils/common
import { commonMock } from "../test/mockCommon"
import * as language from "../../utils/language"
import { activePopup, activeProfile, dictionary, fullColors, groups, labelsDisabled, popupData, profiles, special, timeFormat } from "../../stores"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { General } from "./General"

vi.mock("../../utils/common", () => commonMock())
// SelectField llega a helpers/media (getFileName), que arrastra el módulo de audio
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.spyOn(language, "setLanguage").mockImplementation(() => {})
    restaurar = setStoresForTest([storeEntry(special, {}), storeEntry(timeFormat, "24"), storeEntry(labelsDisabled, false), storeEntry(fullColors, false), storeEntry(groups, {}), storeEntry(dictionary, {}), storeEntry(activeProfile, null), storeEntry(profiles, {}), storeEntry(activePopup, null), storeEntry(popupData, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.restoreAllMocks()
})

const toggle = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const pulsar = (label: string) => fireEvent.click(toggle(label))

describe("General", () => {
    it("renderiza_lo_principal", () => {
        render(<General />)
        for (const label of ["settings.language", "settings.use24hClock", "settings.disable_labels", "settings.full_colors", "tools.slide", "popup.manage_groups", "settings.next_item_on_last_slide", "settings.slide_number_keys", "settings.auto_shortcut_first_letter"]) expect(screen.getByText(label)).toBeTruthy()
        expect(document.querySelectorAll('[role="switch"]')).toHaveLength(6)
    })

    it("idioma_llama_a_setLanguage_con_el_valor_elegido", () => {
        render(<General />)
        fireEvent.click(document.querySelector(".dropdown-trigger") as HTMLElement)
        fireEvent.click(screen.getByText("Español"))
        expect(language.setLanguage).toHaveBeenCalledWith("es")
    })

    it("reloj_24h_escribe_timeFormat_24_o_12", () => {
        render(<General />)
        expect(toggle("settings.use24hClock").getAttribute("aria-checked")).toBe("true")
        pulsar("settings.use24hClock")
        expect(get(timeFormat)).toBe("12")
        pulsar("settings.use24hClock")
        expect(get(timeFormat)).toBe("24")
    })

    it("disable_labels_y_full_colors_escriben_su_store", () => {
        render(<General />)
        pulsar("settings.disable_labels")
        expect(get(labelsDisabled)).toBe(true)
        pulsar("settings.full_colors")
        expect(get(fullColors)).toBe(true)
        pulsar("settings.full_colors")
        expect(get(fullColors)).toBe(false)
    })

    it("nextItemOnLastSlide_viene_marcado_por_defecto_y_se_guarda_false_aunque_sea_falsy", () => {
        render(<General />)
        expect(toggle("settings.next_item_on_last_slide").getAttribute("aria-checked")).toBe("true")
        pulsar("settings.next_item_on_last_slide")
        expect(get(special)).toEqual({ nextItemOnLastSlide: false })
        pulsar("settings.next_item_on_last_slide")
        expect(get(special)).toEqual({ nextItemOnLastSlide: true })
    })

    it("numberKeys_y_autoLetterShortcut_guardan_true_y_borran_la_clave_al_apagar", () => {
        render(<General />)
        pulsar("settings.slide_number_keys")
        pulsar("settings.auto_shortcut_first_letter")
        expect(get(special)).toEqual({ numberKeys: true, autoLetterShortcut: true })
        pulsar("settings.slide_number_keys")
        expect(get(special)).toEqual({ autoLetterShortcut: true })
        pulsar("settings.auto_shortcut_first_letter")
        expect(get(special)).toEqual({})
    })

    it("grupos_lista_los_visibles_ordenados_con_su_color_y_traduce_los_default", () => {
        restaurar()
        restaurar = setStoresForTest([
            storeEntry(special, {}),
            storeEntry(activeProfile, "p"),
            storeEntry(profiles, { p: { access: { groups: { oculto: "none" } } } } as never),
            storeEntry(dictionary, { groups: { verse: "Estrofa" } }),
            storeEntry(groups, {
                a: { name: "Zeta", color: "#111111", default: false },
                b: { name: "verse", color: "#222222", default: true },
                oculto: { name: "Oculto", color: "#333333", default: false }
            } as never)
        ])
        render(<General />)
        const campo = screen.getByText("popup.manage_groups").closest(".textfield") as HTMLElement
        expect(campo.querySelector('[role="button"]')?.textContent).toBe("Estrofa | Zeta")
        const colores = [...campo.querySelectorAll("span[style]")].map((s) => (s as HTMLElement).style.color)
        expect(colores.filter(Boolean)).toEqual(["#222222", "#111111"])
    })

    it("el_campo_de_grupos_abre_manage_groups", () => {
        render(<General />)
        fireEvent.click(screen.getByText("popup.manage_groups").closest(".textfield")!.querySelector('[role="button"]') as HTMLElement)
        expect(get(activePopup)).toBe("manage_groups")
    })
})
