// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activePopup, dictionary, popupData } from "../../shared/core/stores"
import { clearPopupSubmit, confirmCustom, promptCustom, triggerPopupSubmit } from "../../utils/popup"
import { clearFields, fire } from "../test/kitMocks"
import { commonMock } from "../test/mockCommon"
import { setStoresForTest, storeEntry } from "../test/storeTestKit"
import { Confirm } from "./Confirm"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../ui/text-field/TextField", async () => ({ TextField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
// El popup se abre como en la app: confirmCustom/promptCustom dejan popupData y activePopup("confirm") y esperan la respuesta
function abrir(pedir: () => Promise<unknown>) {
    restaurar = setStoresForTest([storeEntry(activePopup, null), storeEntry(popupData, {}), storeEntry(dictionary, { main: { yes: "Sí", no: "No" }, remote: { submit: "Enviar" } })] as never)
    const respuesta = pedir()
    const view = render(<Confirm />)
    return { respuesta, ...view }
}
// lo que hace el marco Svelte (Esc, clic afuera, X)
const cerrarDesdeElMarco = () => act(() => activePopup.set(null))
const resolver = async () => {
    await vi.advanceTimersByTimeAsync(400)
}

beforeEach(() => {
    vi.useFakeTimers()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
    clearPopupSubmit()
    vi.useRealTimers()
})

describe("Confirm", () => {
    it("renderiza_el_mensaje_como_html_y_los_botones_sí_no", () => {
        abrir(() => confirmCustom("¿Seguro? <b>mucho</b>"))
        expect(document.querySelector("p b")?.textContent).toBe("mucho")
        expect(screen.getByText("Sí")).toBeTruthy()
        expect(screen.getByText("No")).toBeTruthy()
    })

    it("sí_resuelve_true", async () => {
        const { respuesta } = abrir(() => confirmCustom("x"))
        fireEvent.click(screen.getByText("Sí"))
        await resolver()
        await expect(respuesta).resolves.toBe(true)
        expect(get(activePopup)).toBeNull()
    })

    it("no_resuelve_false_y_vacía_popupData", async () => {
        const { respuesta } = abrir(() => confirmCustom("x"))
        fireEvent.click(screen.getByText("No"))
        expect(get(popupData)).toEqual({})
        expect(get(activePopup)).toBeNull()
        await resolver()
        await expect(respuesta).resolves.toBe(false)
    })

    it("Enter_confirma_con_true", async () => {
        const { respuesta } = abrir(() => confirmCustom("x"))
        expect(triggerPopupSubmit()).toBe(true)
        await resolver()
        await expect(respuesta).resolves.toBe(true)
    })

    it("Esc_clic_afuera_o_X_(el_marco_cierra_el_popup)_resuelven_false", async () => {
        const { respuesta } = abrir(() => confirmCustom("x"))
        cerrarDesdeElMarco()
        await resolver()
        await expect(respuesta).resolves.toBe(false)
    })

    it("cerrar_sin_responder_tras_desmontar_resuelve_false", async () => {
        const { respuesta, unmount } = abrir(() => confirmCustom("x"))
        unmount()
        cerrarDesdeElMarco()
        await resolver()
        await expect(respuesta).resolves.toBe(false)
        expect(triggerPopupSubmit()).toBe(false)
    })

    it("prompt_con_texto_resuelve_lo_escrito_con_el_botón", async () => {
        const { respuesta } = abrir(() => promptCustom("Nombre", "text", "msg <i>x</i>"))
        expect(document.querySelector("p i")?.textContent).toBe("x")
        fire("Nombre", "onInput", "hola")
        fireEvent.click(screen.getByText("Enviar"))
        await resolver()
        await expect(respuesta).resolves.toBe("hola")
    })

    it("prompt_con_Enter_resuelve_lo_escrito", async () => {
        const { respuesta } = abrir(() => promptCustom("Nombre"))
        fire("Nombre", "onInput", "chau")
        triggerPopupSubmit()
        await resolver()
        await expect(respuesta).resolves.toBe("chau")
    })

    it("prompt_enviado_sin_escribir_resuelve_vacío", async () => {
        const { respuesta } = abrir(() => promptCustom("Nombre"))
        fireEvent.click(screen.getByText("Enviar"))
        await resolver()
        await expect(respuesta).resolves.toBe("")
    })

    it("prompt_cerrado_sin_responder_resuelve_vacío", async () => {
        const { respuesta } = abrir(() => promptCustom("Nombre"))
        fire("Nombre", "onInput", "algo")
        cerrarDesdeElMarco()
        await resolver()
        await expect(respuesta).resolves.toBe("")
    })

    it("con_trigger_lo_llama_con_el_texto_y_cierra_sin_escribir_el_id", () => {
        const trigger = vi.fn()
        restaurar = setStoresForTest([storeEntry(activePopup, "confirm"), storeEntry(popupData, { prompt: "P", inputType: "text", trigger }), storeEntry(dictionary, { remote: { submit: "Enviar" } })] as never)
        render(<Confirm />)
        fire("P", "onInput", "t")
        fireEvent.click(screen.getByText("Enviar"))
        expect(trigger).toHaveBeenCalledWith("t")
        expect(get(activePopup)).toBeNull()
        expect(get(popupData).id).toBeUndefined()
    })
})
