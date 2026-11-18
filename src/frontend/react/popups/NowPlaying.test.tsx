// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "svelte/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { dictionary, special } from "../../stores"
import { commonMock } from "../test/mockCommon"
import { clearFields, fire } from "../test/kitMocks"
import { looseEntry, setStoresForTest, storeEntry } from "../test/storeTestKit"
import { NowPlaying } from "./NowPlaying"

vi.mock("../../utils/common", () => commonMock())
vi.mock("../../audio/audioProcessor", () => ({}))
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("../../IPC/main", () => ({ sendMain: vi.fn() }))
vi.mock("../../converters/txt", () => ({ similarity: () => 0 }))
vi.mock("../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))
vi.mock("../../components/edit/scripts/edit", () => ({ newDropdown: { "new.timer": vi.fn() } }))
vi.mock("../ui/textarea-field/TextareaField", async () => ({ TextareaField: (await vi.importActual<typeof import("../test/kitMocks")>("../test/kitMocks")).FieldMock }))

let restaurar: () => void = () => {}
function montar(data: object = {}) {
    restaurar = setStoresForTest([looseEntry(special, data), storeEntry(dictionary, { popup: { dynamic_values: "Valores dinámicos" }, main: { system_open: "Abrir sistema", open: "Abrir", close: "Cerrar" } })] as never)
    return render(<NowPlaying />)
}
beforeEach(() => {
    vi.clearAllMocks()
    clearFields()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("NowPlaying", () => {
    it("muestra_el_formato_por_defecto_y_los_valores_dinámicos", () => {
        const { container } = montar()
        expect(screen.getByText("Valores dinámicos")).toBeTruthy()
        expect(screen.getByText("Artist name")).toBeTruthy()
        expect(screen.getByText("{artist}")).toBeTruthy()
        expect(container.querySelector('[data-field="NowPlaying.txt"]')?.getAttribute("data-value")).toBe("{artist} - {title} - {album}")
    })

    it("usa_el_formato_guardado_en_special", () => {
        const { container } = montar({ nowPlayingFormat: "{title}" })
        expect(container.querySelector('[data-field="NowPlaying.txt"]')?.getAttribute("data-value")).toBe("{title}")
    })

    it("el_botón_abre_el_archivo_del_sistema", () => {
        const { container } = montar()
        const btn = container.querySelector("button.popup-options") as HTMLElement
        expect(btn).toBeTruthy()
        fireEvent.click(btn)
        expect(sendMain).toHaveBeenCalledWith(Main.OPEN_NOW_PLAYING)
    })

    it("insertar_un_valor_en_el_caret_actualiza_el_texto_y_special", () => {
        montar({ nowPlayingFormat: "Hola mundo" })
        const textarea = document.createElement("textarea")
        document.body.appendChild(textarea)
        textarea.value = "Hola mundo"
        act(() => {
            // El caret va antes del espacio (índice 4): "Hola{year} mundo"
            textarea.selectionStart = 4
            textarea.selectionEnd = 4
        })
        const token = screen.getByText("{year}")
        fireEvent.click(token)
        expect(get(special).nowPlayingFormat).toBe("Hola{year} mundo")
        expect(textarea.selectionStart).toBe(10)
        document.body.removeChild(textarea)
    })

    it("cambiar_el_texto_guarda_en_special", () => {
        montar()
        fire("NowPlaying.txt", "onChange", "{artist}")
        expect(get(special).nowPlayingFormat).toBe("{artist}")
    })
})
