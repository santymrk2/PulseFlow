// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { dictionary } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { setStoresForTest, storeEntry } from "../../test/storeTestKit"
import { TextareaField } from "./TextareaField"
import styles from "./TextareaField.module.css"

vi.mock("../../../shared/utils/common", () => commonMock())

let restaurar: () => void = () => {}

afterEach(() => {
    cleanup()
    restaurar()
    restaurar = () => {}
})

const area = () => document.querySelector("textarea") as HTMLTextAreaElement

describe("TextareaField", () => {
    it("renderiza_lo_principal", () => {
        restaurar = setStoresForTest([storeEntry(dictionary, { inputs: { name: "Nombre" } })])
        const { container } = render(<TextareaField label="inputs.name" value="hola" placeholder="Escribí" id="t" rows={3} className="extra" />)
        expect(area().value).toBe("hola")
        expect(area().getAttribute("rows")).toBe("3")
        expect(area().placeholder).toBe("Escribí")
        expect(area().classList.contains("edit")).toBe(true)
        expect(screen.getByText("Nombre").getAttribute("for")).toBe("t")
        const root = container.firstChild as HTMLElement
        expect(root.classList.contains("textfield")).toBe(true)
        expect(root.classList.contains("extra")).toBe(true)
    })

    it("onInput_por_cada_tecla_y_onChange_solo_con_el_change_nativo", () => {
        const onInput = vi.fn()
        const valores: string[] = []
        const onChange = vi.fn((v: string) => valores.push(v))
        render(<TextareaField label="x" onInput={onInput} onChange={onChange} />)

        fireEvent.input(area(), { target: { value: "a" } })
        expect(onInput).toHaveBeenCalledWith("a")
        expect(onChange).not.toHaveBeenCalled()

        fireEvent.change(area(), { target: { value: "ab" } })
        expect(valores).toEqual(["ab"])
        expect(onInput).toHaveBeenCalledTimes(1)
    })

    it("al_desmontar_se_quita_el_listener_de_change", () => {
        const onChange = vi.fn()
        const { unmount } = render(<TextareaField label="x" onChange={onChange} />)
        const el = area()
        unmount()
        fireEvent.change(el, { target: { value: "z" } })
        expect(onChange).not.toHaveBeenCalled()
    })

    it("cambiar_value_actualiza_y_lo_escrito_se_conserva", () => {
        const { rerender } = render(<TextareaField label="x" value="uno" />)
        fireEvent.input(area(), { target: { value: "escrito" } })
        rerender(<TextareaField label="x" value="uno" />)
        expect(area().value).toBe("escrito")
        rerender(<TextareaField label="x" value="dos" />)
        expect(area().value).toBe("dos")
    })

    it("autoselect_y_autofocus_al_montar", () => {
        const select = vi.spyOn(HTMLTextAreaElement.prototype, "select")
        render(<TextareaField label="x" value="x" autoselect autofocus />)
        expect(select).toHaveBeenCalledTimes(1)
        expect(document.activeElement).toBe(area())
    })

    it("center_y_disabled_aplican_las_clases", () => {
        for (const { center, disabled } of [
            { center: false, disabled: false },
            { center: true, disabled: false },
            { center: false, disabled: true },
            { center: true, disabled: true }
        ]) {
            const { container, unmount } = render(<TextareaField label="x" center={center} disabled={disabled} />)
            const root = container.firstChild as HTMLElement
            expect(root.classList.contains(styles.centered)).toBe(center)
            expect(root.classList.contains(styles.disabled)).toBe(disabled)
            expect(area().disabled).toBe(disabled)
            unmount()
        }
    })
})
