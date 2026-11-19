// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../../types/IPC/Main"
import { ToMain } from "../../../../types/IPC/ToMain"
import { destroyMain, receiveToMain, sendMain } from "../../../shared/core/ipc/main"
import { commonMock } from "../../test/mockCommon"
import { FileField } from "./FileField"
import styles from "./FileField.module.css"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../shared/core/ipc/main", () => ({ sendMain: vi.fn(), receiveToMain: vi.fn(() => "listener-2"), destroyMain: vi.fn() }))
// getFileName vive en helpers/media, que arrastra el módulo de audio (necesita AudioWorkletNode, que no existe en happy-dom)
vi.mock("../../../audio/audioProcessor", () => ({}))
vi.mock("../../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

type Callback = (data: { id: string; channel: string; files?: string[] }) => void
const callback = () => vi.mocked(receiveToMain).mock.calls[0][1] as unknown as Callback
const trigger = () => document.querySelector('[role="button"]') as HTMLElement
const filter = { name: "Imagen", extensions: ["png"] }
const pickedId = () => (vi.mocked(sendMain).mock.calls[0][1] as unknown as { id: string }).id

describe("FileField", () => {
    it("renderiza_lo_principal", () => {
        render(<FileField label="Archivo" value="/carpeta/foto.png" filter={filter} style={{ maxWidth: "70%" }} />)
        expect(trigger().textContent).toBe("foto.png")
        expect(trigger().classList.contains("edit")).toBe(true)
        expect(document.querySelector("label")?.textContent).toBe("Archivo")
        const root = document.querySelector(".textfield") as HTMLElement
        expect(root.getAttribute("data-title")).toBe("/carpeta/foto.png")
        expect(root.style.maxWidth).toBe("70%")
    })

    it("data_URIs_muestran_Embeded_data_y_sin_value_el_titulo_por_defecto", () => {
        const { rerender } = render(<FileField label="x" value="data:image/png;base64,AAA" filter={filter} />)
        expect(trigger().textContent).toBe("Embeded data")
        rerender(<FileField label="x" value={undefined} filter={filter} />)
        expect(document.querySelector(".textfield")?.getAttribute("data-title")).toBe("edit.choose_media")
        rerender(<FileField label="x" value={undefined} filter={filter} title="otro.titulo" />)
        expect(document.querySelector(".textfield")?.getAttribute("data-title")).toBe("otro.titulo")
    })

    it("se_suscribe_a_OPEN_FILE2_y_se_da_de_baja_al_desmontar", () => {
        const { unmount } = render(<FileField label="x" value="" filter={filter} />)
        expect(receiveToMain).toHaveBeenCalledWith(ToMain.OPEN_FILE2, expect.any(Function))
        unmount()
        expect(destroyMain).toHaveBeenCalledWith("listener-2")
    })

    it("click_pide_el_archivo_con_canal_MEDIA_filtro_y_multiple", () => {
        render(<FileField label="x" value="" filter={filter} multiple />)
        fireEvent.click(trigger())
        expect(sendMain).toHaveBeenCalledWith(Main.OPEN_FILE, { channel: "MEDIA", id: expect.any(String), filter, multiple: true })
    })

    it("la_respuesta_con_el_mismo_id_despacha_el_primer_archivo_o_la_lista", () => {
        const onChange = vi.fn()
        const { rerender } = render(<FileField label="x" value="" filter={filter} onChange={onChange} />)
        fireEvent.click(trigger())
        const id = pickedId()
        callback()({ id, channel: "MEDIA", files: ["/a.png", "/b.png"] })
        expect(onChange).toHaveBeenLastCalledWith("/a.png")

        rerender(<FileField label="x" value="" filter={filter} multiple onChange={onChange} />)
        callback()({ id, channel: "MEDIA", files: ["/a.png", "/b.png"] })
        expect(onChange).toHaveBeenLastCalledWith(["/a.png", "/b.png"])
    })

    it("ignora_otro_id_otro_canal_o_sin_archivos", () => {
        const onChange = vi.fn()
        render(<FileField label="x" value="" filter={filter} onChange={onChange} />)
        fireEvent.click(trigger())
        const id = pickedId()
        callback()({ id: "otro", channel: "MEDIA", files: ["/a"] })
        callback()({ id, channel: "OTRO", files: ["/a"] })
        callback()({ id, channel: "MEDIA", files: [] })
        callback()({ id, channel: "MEDIA" })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("Enter_y_espacio_piden_el_archivo_con_preventDefault", () => {
        render(<FileField label="x" value="" filter={filter} />)
        expect(fireEvent.keyDown(trigger(), { key: "Enter" })).toBe(false)
        expect(fireEvent.keyDown(trigger(), { key: " " })).toBe(false)
        expect(sendMain).toHaveBeenCalledTimes(2)
        fireEvent.keyDown(trigger(), { key: "a" })
        expect(sendMain).toHaveBeenCalledTimes(2)
    })

    it("disabled_no_pide_nada", () => {
        render(<FileField label="x" value="" filter={filter} disabled />)
        fireEvent.click(trigger())
        fireEvent.keyDown(trigger(), { key: "Enter" })
        expect(sendMain).not.toHaveBeenCalled()
        expect(trigger().getAttribute("tabindex")).toBeNull()
        expect((document.querySelector(".textfield") as HTMLElement).classList.contains(styles.disabled)).toBe(true)
    })

    it("autoTrigger_pide_el_archivo_al_montar_solo_si_no_hay_value", () => {
        render(<FileField label="x" value="" filter={filter} autoTrigger />)
        expect(sendMain).toHaveBeenCalledTimes(1)
        cleanup()
        vi.clearAllMocks()
        render(<FileField label="x" value="/a.png" filter={filter} autoTrigger />)
        expect(sendMain).not.toHaveBeenCalled()
    })

    it("noLabel_oculta_etiqueta_y_nombre", () => {
        render(<FileField label="x" value="/a/foto.png" filter={filter} noLabel />)
        expect(document.querySelector("label")).toBeNull()
        expect(trigger().textContent).toBe("")
    })

    it("showThumbnail_con_value_muestra_la_miniatura_y_la_icon_reemplaza_al_svg_por_defecto", () => {
        const { rerender, container } = render(<FileField label="x" value="/a.png" filter={filter} showThumbnail icon="image" />)
        const img = container.querySelector("img.thumbnail, img") as HTMLImageElement
        expect(img.getAttribute("src")).toBe("/a.png")
        expect(img.getAttribute("draggable")).toBe("false")
        expect((img.parentElement as HTMLElement).style.height).toBe("40px")
        rerender(<FileField label="x" value="/a.png" filter={filter} icon="image" />)
        expect(container.querySelector("img")).toBeNull()
        expect(trigger().querySelectorAll("svg").length).toBe(1)
    })

    it("allowEmpty_borra_con_cadena_vacia_sin_pedir_archivo", () => {
        const onChange = vi.fn()
        render(<FileField label="x" value="/a.png" filter={filter} allowEmpty onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="clear.general"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("")
        expect(sendMain).not.toHaveBeenCalled()
    })
})
