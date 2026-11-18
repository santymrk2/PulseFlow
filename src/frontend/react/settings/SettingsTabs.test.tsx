// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../lib/store"
import { afterEach, describe, expect, it, vi } from "vitest"
import { activeProfile, profiles, settingsTab } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { SettingsTabs } from "./SettingsTabs"
import styles from "./SettingsTabs.module.css"

vi.mock("../../utils/common", () => commonMock())

let restaurar: () => void = () => {}
afterEach(() => {
    cleanup()
    restaurar()
})
const preparar = (tab: string, perfiles: object = {}, activo: string | null = null) => (restaurar = setStoresForTest([storeEntry(settingsTab, tab as never), storeEntry(profiles, perfiles as never), storeEntry(activeProfile, activo)]))
const botones = () => [...document.querySelectorAll("nav button")] as HTMLElement[]
const tabActiva = () => get(settingsTab)
const flecha = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key, ...init })

describe("SettingsTabs", () => {
    it("renderiza_las_seis_pestanas_con_la_activa_marcada", () => {
        preparar("files")
        render(<SettingsTabs />)
        expect(botones().map((b) => b.textContent)).toEqual(["[settings.general]", "[settings.audio]", "[settings.connection]", "[settings.files]", "[settings.profiles]", "[settings.other]"])
        const activas = botones().filter((b) => b.classList.contains(styles.active))
        expect(activas).toHaveLength(1)
        expect(activas[0].textContent).toBe("[settings.files]")
    })

    it("clic_en_una_pestana_cambia_settingsTab", () => {
        preparar("general")
        render(<SettingsTabs />)
        fireEvent.click(botones()[2])
        expect(tabActiva()).toBe("connection")
    })

    it("un_perfil_oculta_las_pestanas_con_acceso_none", () => {
        preparar("general", { p1: { access: { settings: { audio: "none", other: "none" } } } }, "p1")
        render(<SettingsTabs />)
        expect(botones().map((b) => b.textContent)).toEqual(["[settings.general]", "[settings.connection]", "[settings.files]", "[settings.profiles]"])
    })

    it("un_perfil_activo_sin_datos_muestra_todas", () => {
        preparar("general", {}, "no-existe")
        render(<SettingsTabs />)
        expect(botones()).toHaveLength(6)
    })

    it("flecha_abajo_y_arriba_navegan_y_se_quedan_en_los_bordes", () => {
        preparar("general")
        render(<SettingsTabs />)
        flecha("ArrowDown")
        expect(tabActiva()).toBe("audio")
        flecha("ArrowUp")
        flecha("ArrowUp")
        expect(tabActiva()).toBe("general")
        act(() => settingsTab.set("other"))
        flecha("ArrowDown")
        expect(tabActiva()).toBe("other")
    })

    it("flecha_abajo_hace_preventDefault", () => {
        preparar("general")
        render(<SettingsTabs />)
        const evento = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true })
        act(() => {
            window.dispatchEvent(evento)
        })
        expect(evento.defaultPrevented).toBe(true)
    })

    it("sin_la_pestana_profiles_la_flecha_abajo_en_el_final_va_a_profiles", () => {
        preparar("other", { p1: { access: { settings: { profiles: "none" } } } }, "p1")
        render(<SettingsTabs />)
        flecha("ArrowDown")
        expect(tabActiva()).toBe("profiles")
    })

    it("con_ctrl_o_meta_o_dentro_de_un_campo_edit_no_navega", () => {
        preparar("general")
        render(<SettingsTabs />)
        flecha("ArrowDown", { ctrlKey: true })
        flecha("ArrowDown", { metaKey: true })
        expect(tabActiva()).toBe("general")
        const campo = document.createElement("div")
        campo.className = "edit"
        document.body.append(campo)
        fireEvent.keyDown(campo, { key: "ArrowDown", bubbles: true })
        campo.remove()
        expect(tabActiva()).toBe("general")
    })

    it("otras_teclas_no_hacen_nada_y_al_desmontar_se_quita_el_listener", () => {
        preparar("general")
        const { unmount } = render(<SettingsTabs />)
        flecha("a")
        expect(tabActiva()).toBe("general")
        unmount()
        flecha("ArrowDown")
        expect(tabActiva()).toBe("general")
    })
})
