// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pasteText } from "../../../components/helpers/caretHelper"
import { dictionary } from "../../../stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { TextField } from "./TextField"
import styles from "./TextField.module.css"

vi.mock("../../../utils/common", () => commonMock())
vi.mock("../../../components/helpers/caretHelper", () => ({ pasteText: vi.fn() }))

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
    vi.useRealTimers()
    vi.clearAllMocks()
})

const input = () => document.querySelector("input") as HTMLInputElement
// El valor se lee dentro del handler: happy-dom limpia event.target al terminar el dispatch
const leerChange = () => {
    const valores: (string | null)[] = []
    const onChange = vi.fn((valor: string | null) => valores.push(valor))
    return { onChange, valores }
}

describe("TextField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { name: "Nombre" } })])
        const { container } = render(<TextField label="inputs.name" value="hola" placeholder="Escribí" id="n" title="inputs.name" />)
        expect(input().value).toBe("hola")
        expect(input().placeholder).toBe("Escribí")
        expect(input().classList.contains("edit")).toBe(true)
        expect(screen.getByText("Nombre").getAttribute("for")).toBe("n")
        expect((container.firstChild as HTMLElement).getAttribute("data-title")).toBe("Nombre")
        expect((container.firstChild as HTMLElement).classList.contains("textfield")).toBe(true)
    })

    it("onInput_se_llama_por_cada_tecla_con_el_texto", () => {
        const onInput = vi.fn()
        const { onChange } = leerChange()
        render(<TextField label="x" value="" onInput={onInput} onChange={onChange} />)
        fireEvent.input(input(), { target: { value: "a" } })
        fireEvent.input(input(), { target: { value: "ab" } })
        expect(onInput.mock.calls).toEqual([["a"], ["ab"]])
        expect(onChange).not.toHaveBeenCalled()
    })

    it("onChange_es_el_change_nativo_y_no_dispara_onInput", () => {
        const onInput = vi.fn()
        const { onChange, valores } = leerChange()
        render(<TextField label="x" value="" onInput={onInput} onChange={onChange} />)
        fireEvent.change(input(), { target: { value: "b" } })
        expect(valores).toEqual(["b"])
        expect(onInput).not.toHaveBeenCalled()
    })

    it("al_desmontar_se_quita_el_listener_de_change", () => {
        const { onChange } = leerChange()
        const { unmount } = render(<TextField label="x" value="" onChange={onChange} />)
        const el = input()
        unmount()
        fireEvent.change(el, { target: { value: "z" } })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("onKeyDown_reenvia_la_tecla_y_Enter_desenfoca", () => {
        vi.useFakeTimers()
        const onKeyDown = vi.fn()
        render(<TextField label="x" value="" onKeyDown={onKeyDown} />)
        input().focus()
        fireEvent.keyDown(input(), { key: "Enter" })
        expect(onKeyDown.mock.calls[0][0].key).toBe("Enter")
        expect(document.activeElement).toBe(input())
        act(() => {
            vi.runAllTimers()
        })
        expect(document.activeElement).not.toBe(input())
    })

    it("cambiar_value_desde_el_padre_actualiza_el_texto_y_lo_escrito_se_conserva", () => {
        const { rerender } = render(<TextField label="x" value="uno" />)
        fireEvent.input(input(), { target: { value: "escrito" } })
        rerender(<TextField label="x" value="uno" />)
        expect(input().value).toBe("escrito")
        rerender(<TextField label="x" value="dos" />)
        expect(input().value).toBe("dos")
    })

    it("autoselect_selecciona_y_autofocus_enfoca_al_montar", () => {
        const select = vi.spyOn(HTMLInputElement.prototype, "select")
        render(<TextField label="x" value="x" autoselect autofocus />)
        expect(select).toHaveBeenCalledTimes(1)
        expect(document.activeElement).toBe(input())
    })

    it("center_y_disabled_aplican_las_clases", () => {
        const combinaciones = [
            { center: false, disabled: false },
            { center: true, disabled: false },
            { center: false, disabled: true },
            { center: true, disabled: true }
        ]
        for (const { center, disabled } of combinaciones) {
            const { container, unmount } = render(<TextField label="x" value="" center={center} disabled={disabled} />)
            const root = container.firstChild as HTMLElement
            expect(root.classList.contains(styles.centered)).toBe(center)
            expect(root.classList.contains("centered")).toBe(center)
            expect(root.classList.contains(styles.disabled)).toBe(disabled)
            expect(input().disabled).toBe(disabled)
            unmount()
        }
    })

    it("reset_despacha_change_e_input_con_defaultValue_y_despues_ofrece_deshacer", () => {
        vi.useFakeTimers()
        const onInput = vi.fn()
        const onChange = vi.fn()
        const { rerender } = render(<TextField label="x" value="otro" defaultValue="base" onInput={onInput} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.reset"]') as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("base")
        expect(onInput).toHaveBeenCalledWith("base")
        expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(onInput.mock.invocationCallOrder[0])

        // el padre aplica el valor: aparece deshacer, que devuelve el anterior
        rerender(<TextField label="x" value="base" defaultValue="base" onInput={onInput} onChange={onChange} />)
        fireEvent.click(document.querySelector('[data-title="actions.undo"]') as HTMLElement)
        expect(onChange).toHaveBeenLastCalledWith("otro")

        // tras deshacer, el botón desaparece
        rerender(<TextField label="x" value="base" defaultValue="base" onInput={onInput} onChange={onChange} />)
        expect(document.querySelector("button")).toBeNull()
    })

    it("sin_diferencia_con_defaultValue_no_hay_boton_de_reset", () => {
        render(<TextField label="x" value="base" defaultValue="base" />)
        expect(document.querySelector("button")).toBeNull()
    })

    it("autofill_despacha_change_e_input", () => {
        const onInput = vi.fn()
        const onChange = vi.fn()
        render(<TextField label="x" value="" autofill="auto" onInput={onInput} onChange={onChange} />)
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(onChange).toHaveBeenCalledWith("auto")
        expect(onInput).toHaveBeenCalledWith("auto")
    })

    it("password_alterna_entre_oculto_y_visible_y_enfoca", () => {
        render(<TextField label="x" type="password" value="secreto" />)
        expect(input().type).toBe("password")
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(input().type).toBe("text")
        expect(input().value).toBe("secreto")
        expect(document.activeElement).toBe(input())
    })

    it("pasteBtn_pega_en_el_input_y_lo_enfoca_solo_si_esta_vacio", () => {
        const { rerender } = render(<TextField label="x" value="" pasteBtn />)
        fireEvent.click(document.querySelector("button") as HTMLElement)
        expect(pasteText).toHaveBeenCalledWith(input())
        expect(document.activeElement).toBe(input())

        rerender(<TextField label="x" value="lleno" pasteBtn />)
        expect(document.querySelector("button")).toBeNull()
    })
})
