// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Input } from "./Input"
import styles from "./Input.module.css"

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("Input", () => {
    it("renderiza_lo_principal_con_la_clase_edit", () => {
        render(<Input value="hola" placeholder="Nombre" />)
        const input = screen.getByPlaceholderText("Nombre") as HTMLInputElement
        expect(input.value).toBe("hola")
        expect(input.classList.contains("edit")).toBe(true)
    })

    it("onInput_recibe_el_evento_con_el_valor_nuevo", () => {
        const onInput = vi.fn()
        render(<Input value="" onInput={onInput} />)
        fireEvent.input(screen.getByRole("textbox"), { target: { value: "a" } })
        expect(onInput).toHaveBeenCalledTimes(1)
        expect(onInput.mock.calls[0][0].target.value).toBe("a")
    })

    it("onChange_recibe_el_change_nativo_con_el_valor_nuevo", () => {
        // El valor se lee dentro del handler: happy-dom limpia event.target al terminar el dispatch
        const valores: string[] = []
        const onChange = vi.fn((event: Event) => valores.push((event.target as HTMLInputElement).value))
        render(<Input value="" onChange={onChange} />)
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "b" } })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(valores).toEqual(["b"])
    })

    it("tipear_no_llama_onChange_sino_onInput", () => {
        const onInput = vi.fn()
        const onChange = vi.fn()
        render(<Input value="" onInput={onInput} onChange={onChange} />)
        fireEvent.input(screen.getByRole("textbox"), { target: { value: "a" } })
        expect(onInput).toHaveBeenCalledTimes(1)
        expect(onChange).not.toHaveBeenCalled()
    })

    it("al_desmontar_se_quita_el_listener_de_change", () => {
        const onChange = vi.fn()
        const { unmount } = render(<Input value="" onChange={onChange} />)
        const input = screen.getByRole("textbox")
        unmount()
        fireEvent.change(input, { target: { value: "z" } })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("onKeyDown_reenvia_la_tecla", () => {
        const onKeyDown = vi.fn()
        render(<Input value="" onKeyDown={onKeyDown} />)
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })
        expect(onKeyDown.mock.calls[0][0].key).toBe("Escape")
    })

    it("cambiar_value_actualiza_el_texto", () => {
        const { rerender } = render(<Input value="uno" />)
        rerender(<Input value="dos" />)
        expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("dos")
    })

    it("no_pisa_lo_escrito_si_value_no_cambia", () => {
        const { rerender } = render(<Input value="hola" />)
        const input = screen.getByRole("textbox") as HTMLInputElement
        fireEvent.change(input, { target: { value: "escrito" } })
        rerender(<Input value="hola" />)
        expect(input.value).toBe("escrito")
    })

    it("autoselect_selecciona_el_texto_al_montar", () => {
        const select = vi.spyOn(HTMLInputElement.prototype, "select")
        render(<Input value="x" autoselect />)
        expect(select).toHaveBeenCalledTimes(1)
    })

    it("autofocus_enfoca_al_montar", () => {
        render(<Input value="x" autofocus />)
        expect(document.activeElement).toBe(screen.getByRole("textbox"))
    })

    it("variantes_center_y_light", () => {
        const combinaciones = [
            { center: false, light: false },
            { center: true, light: false },
            { center: false, light: true },
            { center: true, light: true }
        ]
        for (const { center, light } of combinaciones) {
            const { unmount } = render(<Input value="" center={center} light={light} />)
            const input = screen.getByRole("textbox")
            expect(input.classList.contains(styles.center)).toBe(center)
            expect(input.classList.contains(styles.light)).toBe(light)
            unmount()
        }
    })
})
