// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runActionId } from "../../components/actions/actions"
import { activeProfile, profiles, selectedProfile, special } from "../../stores"
import { newToast } from "../../utils/common"
import { promptCustom } from "../../utils/popup"
import { encodePassword } from "../../utils/profile"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { ProfilesButtons } from "./ProfilesButtons"

vi.mock("../../utils/common", () => ({ isMainWindow: () => false, newToast: vi.fn() }))
vi.mock("../../utils/popup", () => ({ promptCustom: vi.fn() }))
vi.mock("../../components/actions/actions", () => ({ runActionId: vi.fn() }))

const perfil = (extra = {}) => ({ name: "P", color: "", image: "", access: {}, ...extra })

let restaurar: () => void = () => {}
function preparar(entries: ReturnType<typeof storeEntry>[]) {
    restaurar()
    restaurar = setStoresForTest(entries)
}
beforeEach(() => {
    preparar([storeEntry(profiles, { a: perfil() }), storeEntry(selectedProfile, "a"), storeEntry(activeProfile, null), storeEntry(special, {})])
})
afterEach(() => {
    cleanup()
    restaurar()
    vi.clearAllMocks()
})
const boton = () => screen.getByText("[profile.set_active]")

describe("ProfilesButtons", () => {
    it("renderiza_lo_principal_el_boton_de_activar_el_perfil_elegido", () => {
        render(<ProfilesButtons />)
        expect(boton()).toBeTruthy()
        expect(document.querySelector("svg")).toBeTruthy()
    })

    it("no_se_muestra_si_ese_perfil_ya_esta_activo", () => {
        activeProfile.set("a")
        render(<ProfilesButtons />)
        expect(screen.queryByText("[profile.set_active]")).toBeNull()
    })

    it("no_se_muestra_si_no_hay_perfiles_aparte_del_admin", () => {
        profiles.set({ admin: perfil() })
        render(<ProfilesButtons />)
        expect(screen.queryByText("[profile.set_active]")).toBeNull()
    })

    it("activar_escribe_activeProfile_lastUsedProfile_y_corre_la_accion", () => {
        profiles.set({ a: perfil({ action: "accion1" }) })
        render(<ProfilesButtons />)
        fireEvent.click(boton())
        expect(get(activeProfile)).toBe("a")
        expect(runActionId).toHaveBeenCalledWith("accion1", "profile")
        expect(get(special)).toEqual({ lastUsedProfile: "a" })
    })

    it("sin_accion_no_corre_ninguna", () => {
        render(<ProfilesButtons />)
        fireEvent.click(boton())
        expect(runActionId).not.toHaveBeenCalled()
    })

    it("activar_admin_sin_clave_no_pide_contrasena", () => {
        selectedProfile.set(null)
        render(<ProfilesButtons />)
        fireEvent.click(boton())
        expect(promptCustom).not.toHaveBeenCalled()
        expect(get(activeProfile)).toBe("")
        expect(get(special)).toEqual({ lastUsedProfile: "" })
    })

    it("activar_admin_con_clave_pide_la_contrasena_y_con_la_incorrecta_avisa_y_no_activa", async () => {
        profiles.set({ a: perfil(), admin: perfil({ password: encodePassword("1234") }) })
        selectedProfile.set(null)
        vi.mocked(promptCustom).mockResolvedValue("mala")
        render(<ProfilesButtons />)
        fireEvent.click(boton())
        await waitFor(() => expect(newToast).toHaveBeenCalledWith("remote.wrong_password"))
        expect(promptCustom).toHaveBeenCalledWith("remote.password", "password")
        expect(get(activeProfile)).toBeNull()
        expect(get(special)).toEqual({})
    })

    it("activar_admin_con_la_contrasena_correcta_activa", async () => {
        profiles.set({ a: perfil(), admin: perfil({ password: encodePassword("1234") }) })
        selectedProfile.set(null)
        vi.mocked(promptCustom).mockResolvedValue("1234")
        render(<ProfilesButtons />)
        fireEvent.click(boton())
        await waitFor(() => expect(get(activeProfile)).toBe(""))
        expect(newToast).not.toHaveBeenCalled()
        expect(get(special)).toEqual({ lastUsedProfile: "" })
    })
})
