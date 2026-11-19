// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import { destroyMain, receiveToMain, sendMain } from "../../../shared/core/ipc/main"
import { commonMock } from "../../test/mockCommon"
import { FolderField } from "./FolderField"
import styles from "./FolderField.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener-1"), destroyMain: vi.fn() }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

type Callback = (data: { channel: string; path?: string }) => void
const callback = () => vi.mocked(receiveToMain).mock.calls[0][1] as unknown as Callback
const trigger = () => document.querySelector('[role="button"]') as HTMLElement

describe("FolderField", () => {
    beforeEach(() => vi.clearAllMocks())

    it("renderiza_lo_principal", () => {
        render(<FolderField label="Carpeta" value="/Users/x/Documents/shows" />)
        expect(trigger().textContent).toBe("Documents/shows")
        expect(trigger().classList.contains("edit")).toBe(true)
        expect(document.querySelector("label")?.textContent).toBe("Carpeta")
        expect(document.querySelector(".textfield")?.getAttribute("data-title")).toBe("/Users/x/Documents/shows")
    })

    it("sin_Documents_muestra_el_value_completo_y_sin_value_el_titulo_por_defecto", () => {
        const { rerender } = render(<FolderField label="x" value="/otra/ruta" />)
        expect(trigger().textContent).toBe("/otra/ruta")
        rerender(<FolderField label="x" value={undefined} />)
        expect(document.querySelector(".textfield")?.getAttribute("data-title")).toBe("inputs.change_folder")
    })

    it("se_suscribe_a_OPEN_FOLDER2_y_se_da_de_baja_al_desmontar", () => {
        const { unmount } = render(<FolderField label="x" value="" />)
        expect(receiveToMain).toHaveBeenCalledWith(ToMain.OPEN_FOLDER2, expect.any(Function))
        unmount()
        expect(destroyMain).toHaveBeenCalledWith("listener-1")
    })

    it("click_pide_la_carpeta_con_el_canal_el_titulo_y_la_ruta", () => {
        render(<FolderField label="Carpeta" value="/a/b" PICK_ID="mi-id" />)
        fireEvent.click(trigger())
        expect(sendMain).toHaveBeenCalledWith(Main.OPEN_FOLDER, { channel: "mi-id", title: "Carpeta", path: "/a/b" })
    })

    it("sin_PICK_ID_el_canal_se_genera_y_coincide_con_la_respuesta", () => {
        const onChange = vi.fn()
        render(<FolderField label="x" value="" onChange={onChange} />)
        fireEvent.click(trigger())
        const channel = vi.mocked(sendMain).mock.calls[0][1] as unknown as { channel: string }
        expect(channel.channel).toBeTruthy()
        callback()({ channel: channel.channel, path: "/elegida" })
        expect(onChange).toHaveBeenCalledWith("/elegida")
    })

    it("ignora_respuestas_de_otro_canal_o_sin_ruta", () => {
        const onChange = vi.fn()
        render(<FolderField label="x" value="" PICK_ID="mi-id" onChange={onChange} />)
        callback()({ channel: "otro", path: "/x" })
        callback()({ channel: "mi-id", path: "" })
        callback()({ channel: "mi-id" })
        expect(onChange).not.toHaveBeenCalled()
        callback()({ channel: "mi-id", path: "/ok" })
        expect(onChange).toHaveBeenCalledWith("/ok")
    })

    it("Enter_y_espacio_piden_la_carpeta_con_preventDefault", () => {
        render(<FolderField label="x" value="" PICK_ID="id" />)
        expect(fireEvent.keyDown(trigger(), { key: "Enter" })).toBe(false)
        expect(fireEvent.keyDown(trigger(), { key: " " })).toBe(false)
        expect(sendMain).toHaveBeenCalledTimes(2)
        fireEvent.keyDown(trigger(), { key: "a" })
        expect(sendMain).toHaveBeenCalledTimes(2)
    })

    it("disabled_no_pide_nada_y_aplica_la_clase", () => {
        render(<FolderField label="x" value="/a" disabled />)
        fireEvent.click(trigger())
        fireEvent.keyDown(trigger(), { key: "Enter" })
        expect(sendMain).not.toHaveBeenCalled()
        expect(trigger().getAttribute("tabindex")).toBeNull()
        expect((document.querySelector(".textfield") as HTMLElement).classList.contains(styles.disabled)).toBe(true)
    })

    it("el_boton_abrir_envia_OPEN_FOLDER_PATH_sin_pedir_carpeta", () => {
        render(<FolderField label="x" value="/a/b" />)
        fireEvent.click(document.querySelector('[data-title="main.system_open"]') as HTMLElement)
        expect(sendMain).toHaveBeenCalledTimes(1)
        expect(sendMain).toHaveBeenCalledWith(Main.OPEN_FOLDER_PATH, "/a/b")
    })

    it("openButton_false_o_sin_value_oculta_el_boton_abrir", () => {
        const { rerender } = render(<FolderField label="x" value="/a" openButton={false} />)
        expect(document.querySelector('[data-title="main.system_open"]')).toBeNull()
        rerender(<FolderField label="x" value="" />)
        expect(document.querySelector('[data-title="main.system_open"]')).toBeNull()
    })

    it("allowEmpty_borra_con_cadena_vacia_sin_pedir_carpeta", () => {
        const onChange = vi.fn()
        render(<FolderField label="x" value="/a" allowEmpty onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="clear.general"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("")
        expect(sendMain).not.toHaveBeenCalled()
    })
})
