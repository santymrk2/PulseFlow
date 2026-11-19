// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { activeProfile, activeRename, activeTriggerFunction, profiles, selectedProfile } from "../../shared/core/stores"
import { commonMock } from "../../shared/test/mockCommon"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { ProfilesTabs } from "./ProfilesTabs"

vi.mock("../../shared/utils/common", () => commonMock())
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("uid", () => ({ uid: () => "nuevo-id" }))
vi.mock("../../shared/audio/audioProcessor", () => ({}))
vi.mock("../../shared/audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const perfil = (name: string, extra = {}) => ({ name, color: "#ff0000", image: "", access: {}, ...extra })

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([storeEntry(profiles, { a: perfil("Ana"), b: perfil("Beto") }), storeEntry(selectedProfile, "a"), storeEntry(activeProfile, "b"), storeEntry(activeTriggerFunction, ""), storeEntry(activeRename, null)])
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.useRealTimers()
    vi.clearAllMocks()
})
const pestanas = () => Array.from(document.querySelectorAll("button.tab")) as HTMLButtonElement[]

describe("ProfilesTabs", () => {
    it("renderiza_lo_principal_admin_y_los_perfiles_ordenados_por_nombre", () => {
        profiles.set({ b: perfil("Beto"), a: perfil("Ana"), admin: perfil("x") })
        render(<ProfilesTabs />)
        expect(pestanas().map((t) => t.textContent)).toEqual(["profile.admin", "Ana", "Beto"])
        expect(document.querySelector('[data-title="new.profile"]')).toBeTruthy()
    })

    it("la_pestana_activa_lleva_un_icono_de_mas_el_de_verificado", () => {
        render(<ProfilesTabs />)
        const [admin, ana, beto] = pestanas().map((t) => t.querySelectorAll("svg").length)
        expect([admin, ana, beto]).toEqual([1, 1, 2])
    })

    it("abrir_una_pestana_escribe_selectedProfile_y_la_de_admin_escribe_vacio", () => {
        render(<ProfilesTabs />)
        fireEvent.click(pestanas()[2])
        expect(get(selectedProfile)).toBe("b")
        fireEvent.click(pestanas()[0])
        expect(get(selectedProfile)).toBe("")
    })

    it("conserva_la_clase_de_menu_contextual_sin_perfil_activo_y_la_de_admin", () => {
        activeProfile.set(null)
        render(<ProfilesTabs />)
        const [admin, ana] = pestanas()
        expect(ana.classList.contains("context")).toBe(true)
        expect(ana.classList.contains("#profile_tab")).toBe(true)
        expect(admin.classList.contains("#profile_tab_admin")).toBe(true)
    })

    it("con_un_perfil_activo_no_hay_menu_contextual", () => {
        render(<ProfilesTabs />)
        expect(pestanas().some((t) => t.classList.contains("context"))).toBe(false)
    })

    it("crear_escribe_en_history_el_perfil_nuevo_a_partir_del_actual_y_lo_selecciona", () => {
        render(<ProfilesTabs />)
        fireEvent.click(document.querySelector('[data-title="new.profile"]') as HTMLElement)
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: { name: "example.default", color: "", image: "", access: {} }, replace: { name: "Ana 2", color: expect.any(String) } }, oldData: { id: "nuevo-id" }, location: { page: "settings", id: "settings_profile" } })
        expect(get(selectedProfile)).toBe("nuevo-id")
    })

    it("crear_con_activeProfile_null_lo_pone_en_vacio_como_el_admin", () => {
        activeProfile.set(null)
        render(<ProfilesTabs />)
        fireEvent.click(document.querySelector('[data-title="new.profile"]') as HTMLElement)
        expect(get(activeProfile)).toBe("")
    })

    it("la_funcion_create_profile_crea_el_perfil_en_el_siguiente_tick", () => {
        vi.useFakeTimers()
        render(<ProfilesTabs />)
        act(() => activeTriggerFunction.set("create_profile"))
        expect(history).not.toHaveBeenCalled()
        act(() => void vi.runAllTimers())
        expect(history).toHaveBeenCalledTimes(1)
        expect(get(selectedProfile)).toBe("nuevo-id")
    })

    it("renombrar_escribe_name_en_history_con_el_id_de_la_pestana_y_la_selecciona", () => {
        render(<ProfilesTabs />)
        act(() => activeRename.set("profile_b"))
        const input = document.querySelector("input") as HTMLInputElement
        input.value = "Bruno"
        fireEvent.change(input)
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { key: "name", data: "Bruno" }, oldData: { id: "b" }, location: { page: "settings", id: "settings_profile", override: "profile_name" } })
        expect(get(selectedProfile)).toBe("b")
    })

    it("sin_selectedProfile_el_perfil_actual_es_el_primero_de_la_lista", () => {
        selectedProfile.set(null)
        render(<ProfilesTabs />)
        fireEvent.click(document.querySelector('[data-title="new.profile"]') as HTMLElement)
        expect(vi.mocked(history).mock.calls[0][0].newData.replace.name).toBe("Ana 2")
    })

    it("si_el_perfil_elegido_ya_no_existe_se_toma_el_admin_y_se_usa_el_perfil_por_defecto", () => {
        selectedProfile.set("borrado")
        render(<ProfilesTabs />)
        fireEvent.click(document.querySelector('[data-title="new.profile"]') as HTMLElement)
        expect(vi.mocked(history).mock.calls[0][0].newData.replace.name).toBe("example.default 2")
    })
})
