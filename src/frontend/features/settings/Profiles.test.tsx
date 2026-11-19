// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { actions, actionTags, activePopup, activeProfile, categories, folders, groups, overlayCategories, popupData, profiles, scenes, selectedProfile, stageShows, templateCategories, timerTags, variableTags } from "../../shared/core/stores"
import { encodePassword } from "../../shared/utils/profile"
import { setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { Profiles } from "./Profiles"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

const perfil = (extra = {}) => ({ name: "Ana", color: "", image: "", access: {}, ...extra })
const UPDATE = (access: object, override: string) => ({ id: "UPDATE", newData: { key: "access", data: access }, oldData: { id: "a" }, location: { page: "settings", id: "settings_profile", override } })

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([
        storeEntry(profiles, { a: perfil() }),
        storeEntry(selectedProfile, "a"),
        storeEntry(activeProfile, null),
        storeEntry(folders, {}),
        storeEntry(categories, {}),
        storeEntry(overlayCategories, {}),
        storeEntry(templateCategories, {}),
        storeEntry(actionTags, {}),
        storeEntry(timerTags, {}),
        storeEntry(variableTags, {}),
        storeEntry(scenes, {}),
        storeEntry(stageShows, {}),
        storeEntry(groups, {}),
        storeEntry(actions, {}),
        storeEntry(popupData, {}),
        storeEntry(activePopup, null)
    ] as never)
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})

const seccion = (label: string) => screen.getByText(label).parentElement as HTMLElement
const abrir = (label: string) => fireEvent.click(seccion(label).closest(".row")!.querySelector('[data-title="main.open"]') as HTMLElement)
const switchDe = (label: string) => screen.getByText(label).closest('[role="switch"]') as HTMLElement
const campo = (label: string) => screen.getByText(label).closest(".textfield") as HTMLElement

describe("Profiles", () => {
    it("renderiza_lo_principal_las_11_secciones_de_acceso_y_la_accion", () => {
        render(<Profiles />)
        for (const l of ["remote.projects", "tabs.shows", "tabs.overlays", "tabs.templates", "tabs.actions", "tabs.timers", "tabs.variables", "tabs.scenes", "menu.stage", "tools.groups", "menu.settings", "midi.start_action"]) expect(screen.getByText(l)).toBeTruthy()
        expect(screen.queryByText("remote.password")).toBeNull()
    })

    it("cada_seccion_global_ofrece_leer_y_escribir_menos_templates_que_suma_ninguno", () => {
        render(<Profiles />)
        expect(
            within(seccion("remote.projects"))
                .getAllByRole("button")
                .map((b) => b.textContent)
        ).toEqual(["profile.read", "profile.write"])
        expect(
            within(seccion("tabs.templates"))
                .getAllByRole("button")
                .map((b) => b.textContent)
        ).toEqual(["profile.none", "profile.read", "profile.write"])
        expect(within(seccion("tools.groups")).queryAllByRole("button")).toHaveLength(0)
    })

    it("cambiar_el_acceso_global_a_read_escribe_en_history_la_clave_access", () => {
        render(<Profiles />)
        fireEvent.click(within(seccion("remote.projects")).getByText("profile.read"))
        expect(history).toHaveBeenCalledWith(UPDATE({ projects: { global: "read" } }, "profile_projects"))
    })

    it("write_global_borra_la_clave_y_vuelve_a_dejar_el_objeto_vacio", () => {
        profiles.set({ a: perfil({ access: { projects: { global: "read" } } }) })
        render(<Profiles />)
        fireEvent.click(within(seccion("remote.projects")).getByText("profile.write"))
        expect(history).toHaveBeenCalledWith(UPDATE({ projects: {} }, "profile_projects"))
    })

    it("none_global_en_templates_se_escribe_none", () => {
        render(<Profiles />)
        fireEvent.click(within(seccion("tabs.templates")).getByText("profile.none"))
        expect(history).toHaveBeenCalledWith(UPDATE({ templates: { global: "none" } }, "profile_templates"))
    })

    it("sin_ser_admin_los_botones_estan_deshabilitados_y_no_escriben", () => {
        activeProfile.set("a")
        render(<Profiles />)
        const boton = within(seccion("remote.projects")).getByText("profile.read") as HTMLButtonElement
        expect(boton.disabled).toBe(true)
        fireEvent.click(boton)
        expect(history).not.toHaveBeenCalled()
    })

    it("la_flecha_aparece_solo_con_elementos_y_abre_la_lista_de_carpetas_con_nivel_por_elemento", () => {
        folders.set({ f1: { name: "Coros", parent: "/" }, f2: { name: "Hijo", parent: "f1" }, f3: { name: "Banda", parent: "/" } } as never)
        render(<Profiles />)
        expect(seccion("tabs.shows").closest(".row")!.querySelector('[data-title="main.open"]')).toBeNull()
        expect(screen.queryByText("Coros")).toBeNull()
        abrir("remote.projects")
        expect(screen.getByText("Banda")).toBeTruthy()
        expect(screen.getByText("Coros")).toBeTruthy()
        expect(screen.queryByText("Hijo")).toBeNull()
        const item = seccion("Coros")
        fireEvent.click(item.querySelector('[data-title="profile.read"]') as HTMLElement)
        expect(history).toHaveBeenCalledWith(UPDATE({ projects: { f1: "read" } }, "profile_projects"))
    })

    it("con_global_read_el_elemento_no_puede_escribir_y_con_none_no_puede_ni_leer", () => {
        folders.set({ f1: { name: "Coros", parent: "/" } } as never)
        profiles.set({ a: perfil({ access: { templates: { global: "read" } } }) })
        templateCategories.set({ t1: { name: "Plantilla" } } as never)
        render(<Profiles />)
        abrir("tabs.templates")
        const item = seccion("Plantilla")
        expect((item.querySelector('[data-title="profile.write"]') as HTMLButtonElement).disabled).toBe(true)
        expect((item.querySelector('[data-title="profile.read"]') as HTMLButtonElement).disabled).toBe(false)
    })

    it("el_nivel_del_elemento_se_deriva_del_global_y_del_propio", () => {
        profiles.set({ a: perfil({ access: { templates: { global: "none", t1: "write" } } }) })
        templateCategories.set({ t1: { name: "Plantilla" } } as never)
        render(<Profiles />)
        abrir("tabs.templates")
        const activos = [...seccion("Plantilla").querySelectorAll("button")].map((b) => !!b.querySelector('div[class*="active"]'))
        expect(activos).toEqual([true, false, false])
    })

    it("settings_y_groups_ofrecen_ocultar_y_mostrar", () => {
        groups.set({ g1: { name: "Estrofa", color: "#fff" }, g2: { name: "verse", default: true, color: "#000" } } as never)
        render(<Profiles />)
        abrir("tools.groups")
        const item = seccion("Estrofa")
        expect([...item.querySelectorAll("button")].map((b) => b.getAttribute("data-title"))).toEqual(["profile.hide", "profile.show"])
        expect(screen.getByText("groups.verse")).toBeTruthy()
        fireEvent.click(item.querySelector('[data-title="profile.hide"]') as HTMLElement)
        expect(history).toHaveBeenCalledWith(UPDATE({ groups: { g1: "none" } }, "profile_groups"))
    })

    it("la_lista_de_settings_sale_de_las_pestanas", () => {
        render(<Profiles />)
        abrir("menu.settings")
        for (const l of ["settings.general", "settings.audio", "settings.connection", "settings.files", "settings.profiles", "settings.other"]) expect(screen.getByText(l)).toBeTruthy()
    })

    it("la_accion_se_elige_y_escribe_action_en_el_perfil_y_el_boton_editar_abre_el_popup", () => {
        actions.set({ x: { name: "Zeta" }, y: { name: "Alfa" } } as never)
        render(<Profiles />)
        expect(screen.queryByText("titlebar.edit")).toBeNull()
        fireEvent.click(campo("midi.start_action").querySelector(".dropdown-trigger") as HTMLElement)
        expect([...document.querySelectorAll(".select-menu li")].map((li) => li.textContent)).toEqual(["main.none", "Alfa", "Zeta"])
        fireEvent.click(screen.getByText("Zeta"))
        expect(get(profiles).a.action).toBe("x")
        fireEvent.click(document.querySelector('[data-title="titlebar.edit"]') as HTMLElement)
        expect(get(popupData)).toEqual({ id: "x" })
        expect(get(activePopup)).toBe("action")
    })

    it("la_lista_de_acciones_se_toma_al_montar_y_no_cambia_despues", () => {
        actions.set({ x: { name: "Zeta" } } as never)
        render(<Profiles />)
        actions.set({ x: { name: "Zeta" }, y: { name: "Alfa" } } as never)
        fireEvent.click(campo("midi.start_action").querySelector(".dropdown-trigger") as HTMLElement)
        expect(screen.queryByText("Alfa")).toBeNull()
    })

    it("sin_perfil_elegido_se_muestran_los_ajustes_del_admin", () => {
        selectedProfile.set(null)
        render(<Profiles />)
        expect(screen.getByText("remote.password")).toBeTruthy()
        expect(screen.getByText("profile.auto_open_last_used")).toBeTruthy()
        expect(screen.queryByText("remote.projects")).toBeNull()
        expect(document.querySelector("svg")).toBeTruthy()
    })

    it("si_el_perfil_elegido_se_borro_tambien_se_muestran_los_ajustes_del_admin", () => {
        selectedProfile.set("borrado")
        render(<Profiles />)
        expect(screen.getByText("remote.password")).toBeTruthy()
    })

    it("la_contrasena_del_admin_se_guarda_codificada_en_profiles_admin_password", () => {
        selectedProfile.set(null)
        render(<Profiles />)
        const input = campo("remote.password").querySelector("input") as HTMLInputElement
        input.value = "secreta"
        fireEvent.change(input)
        expect(get(profiles).admin).toEqual({ name: "", color: "", image: "", access: {}, password: encodePassword("secreta") })
    })

    it("con_contrasena_el_campo_esta_deshabilitado_y_muestra_asteriscos", () => {
        selectedProfile.set(null)
        profiles.set({ a: perfil(), admin: perfil({ password: encodePassword("x") }) })
        render(<Profiles />)
        const input = campo("remote.password").querySelector("input") as HTMLInputElement
        expect(input.disabled).toBe(true)
        expect(input.value).toBe("*****")
    })

    it("auto_open_last_used_escribe_autoOpenLastUsed_en_admin", () => {
        selectedProfile.set(null)
        render(<Profiles />)
        expect(switchDe("profile.auto_open_last_used").getAttribute("aria-checked")).toBe("false")
        fireEvent.click(switchDe("profile.auto_open_last_used"))
        expect(get(profiles).admin.autoOpenLastUsed).toBe(true)
        fireEvent.click(switchDe("profile.auto_open_last_used"))
        expect(get(profiles).admin.autoOpenLastUsed).toBe(false)
    })

    it("sin_ser_admin_no_aparecen_los_ajustes_del_admin_solo_el_icono", () => {
        selectedProfile.set(null)
        activeProfile.set("a")
        render(<Profiles />)
        expect(screen.queryByText("remote.password")).toBeNull()
        expect(document.querySelector("svg")).toBeTruthy()
    })

    it("sin_perfiles_solo_se_muestra_el_icono", () => {
        profiles.set({})
        selectedProfile.set(null)
        render(<Profiles />)
        expect(screen.queryByText("remote.password")).toBeNull()
        expect(screen.queryByText("remote.projects")).toBeNull()
    })
})
