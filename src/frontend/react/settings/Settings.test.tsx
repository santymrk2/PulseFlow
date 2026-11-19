// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAudioRouting } from "../../audio/routing/audioRoutingInit"
import { activePopup, dictionary, settingsTab } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Settings } from "./Settings"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../audio/routing/audioRoutingInit", () => ({ resetAudioRouting: vi.fn() }))
vi.mock("./General", () => ({ General: () => <div>stub-general</div> }))
vi.mock("./Files", () => ({ Files: () => <div>stub-files</div> }))
vi.mock("./FilesButtons", () => ({ FilesButtons: () => <div>stub-files-buttons</div> }))
vi.mock("./Other", () => ({ Other: () => <div>stub-other</div> }))
vi.mock("./OtherButtons", () => ({ OtherButtons: () => <div>stub-other-buttons</div> }))
// Las pestañas se mockean como islas: acá sólo importa cuál se monta y con qué props.
vi.mock("./audio/AudioRouting", () => ({ AudioRouting: () => <div data-isla="AudioRouting" /> }))
vi.mock("./Connection", () => ({ Connection: () => <div data-isla="Connection" /> }))
vi.mock("./Profiles", () => ({ Profiles: () => <div data-isla="Profiles" /> }))
vi.mock("./ProfilesButtons", () => ({ ProfilesButtons: () => <div data-isla="ProfilesButtons" /> }))
vi.mock("./ProfilesTabs", () => ({ ProfilesTabs: () => <div data-isla="ProfilesTabs" /> }))
vi.mock("../main/Tip", async () => ({ Tip: (await vi.importActual<typeof import("../../shared/test/islandMock")>("../../shared/test/islandMock")).makePortMock("Tip") }))

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(dictionary, { settings: { general: "General", audio: "Audio", ai: "IA" }, ai: { hint: "Pista", privacy_details: "Privacidad" }, profile: { profiles_hint: "Perfiles!" }, screen_config: { configure: "Configurar pantallas" } }), storeEntry(activePopup, null)])
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})
const islas = () => [...document.querySelectorAll("[data-isla]")].map((e) => e.getAttribute("data-isla"))
const mostrar = (tab: string) => settingsTab.set(tab as never)
const scroll = () => document.querySelector("main > div:nth-of-type(2)") as HTMLElement
const titulo = () => document.querySelector("main > div:first-child") as HTMLElement

describe("Settings", () => {
    it("renderiza_lo_principal_en_general", () => {
        mostrar("general")
        render(<Settings />)
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("General")
        expect(screen.getByText("stub-general")).toBeTruthy()
        expect(islas()).toEqual([])
        expect(screen.queryByText("stub-files-buttons")).toBeNull()
    })

    it("general_trae_el_boton_de_configurar_pantallas_que_abre_screen_config", () => {
        mostrar("general")
        render(<Settings />)
        fireEvent.click(screen.getByText("Configurar pantallas"))
        expect(get(activePopup)).toBe("screen_config")
    })

    it("audio_monta_la_isla_de_ruteo_con_padding_20_y_el_boton_de_reset_llama_a_resetAudioRouting", () => {
        mostrar("audio")
        render(<Settings />)
        expect(islas()).toContain("AudioRouting")
        expect(scroll().style.getPropertyValue("--padding")).toBe("20px")
        fireEvent.click(document.querySelector('button[data-title="actions.reset"]') as HTMLElement)
        expect(resetAudioRouting).toHaveBeenCalledTimes(1)
    })

    it("general_no_cambia_el_padding_del_scroll", () => {
        mostrar("general")
        render(<Settings />)
        expect(scroll().style.getPropertyValue("--padding")).toBe("")
    })

    it("connection_monta_Connection", () => {
        mostrar("connection")
        render(<Settings />)
        expect(islas()).toEqual(["Connection"])
    })

    it("files_monta_Files_y_en_la_barra_inferior_FilesButtons", () => {
        mostrar("files")
        render(<Settings />)
        expect(screen.getByText("stub-files")).toBeTruthy()
        expect(screen.getByText("stub-files-buttons")).toBeTruthy()
    })

    it("profiles_monta_Profiles_con_sus_botones_arriba_y_ProfilesTabs_abajo", () => {
        mostrar("profiles")
        render(<Settings />)
        expect(islas()).toEqual(expect.arrayContaining(["Tip", "ProfilesButtons", "Profiles", "ProfilesTabs"]))
        expect(islas()).toHaveLength(4)
    })

    it("other_monta_Other_y_OtherButtons", () => {
        mostrar("other")
        render(<Settings />)
        expect(screen.getByText("stub-other")).toBeTruthy()
        expect(screen.getByText("stub-other-buttons")).toBeTruthy()
    })

    it.each([
        ["audio", "settings.audio_hint"],
        ["profiles", "Perfiles!"],
        ["ai", "Pista<br><br>Privacidad"]
    ])("la_pestana_%s_muestra_la_pista_traducida_en_una_isla_Tip", (tab, valor) => {
        mostrar(tab)
        render(<Settings />)
        const tip = document.querySelector('[data-isla="Tip"]') as HTMLElement
        expect(JSON.parse(tip.getAttribute("data-props")!)).toEqual({ type: "info", value: valor, style: "opacity: 0.7;", hiddenText: true, white: true })
    })

    it("general_no_tiene_pista", () => {
        mostrar("general")
        render(<Settings />)
        expect(islas()).not.toContain("Tip")
    })

    it("el_titulo_gana_sombra_al_scrollear_y_la_pierde_al_volver_arriba", () => {
        mostrar("general")
        render(<Settings />)
        expect(titulo().style.boxShadow).toBe("")
        fireEvent.scroll(scroll(), { target: { scrollTop: 10 } })
        expect(titulo().style.boxShadow).toBe("2px 2px 4px 5px rgb(0 0 0 / 0.1)")
        fireEvent.scroll(scroll(), { target: { scrollTop: 0 } })
        expect(titulo().style.boxShadow).toBe("")
    })

    it("con_settingsTab_null_la_sombra_se_reinicia", () => {
        mostrar("general")
        render(<Settings />)
        fireEvent.scroll(scroll(), { target: { scrollTop: 10 } })
        expect(titulo().style.boxShadow).not.toBe("")
        act(() => settingsTab.set(null as never))
        expect(titulo().style.boxShadow).toBe("")
    })
})
