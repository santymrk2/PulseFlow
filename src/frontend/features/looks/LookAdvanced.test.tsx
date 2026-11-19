// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Look } from "../../../types/Settings"
import { LookAdvanced } from "./LookAdvanced"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/ui/kit/color-field/ColorField", () => ({ ColorField: ({ onInput }: { onInput: (v: string) => void }) => <button data-testid="color" onClick={() => onInput("#abcdef")} /> }))

afterEach(cleanup)

const pantallas = [{ id: "a", name: "Sala", enabled: true, active: true, color: "", bounds: { x: 0, y: 0, width: 1, height: 1 }, screen: null }]
const draft: Look = { name: "L", screens: { a: { layers: { media: true, slide: true, overlays: true }, volume: 50 } } }
const campo = (label: string) => screen.getByText(label).closest(".textfield") as HTMLElement
const escribir = (label: string, v: string) => {
    const i = campo(label).querySelector("input") as HTMLInputElement
    fireEvent.input(i, { target: { value: v } })
    fireEvent.change(i, { target: { value: v } })
}

describe("LookAdvanced", () => {
    it("sin_pantallas_no_dibuja_nada", () => {
        const { container } = render(<LookAdvanced screens={[]} draft={draft} />)
        expect(container.innerHTML).toBe("")
    })

    it("renderiza_lo_principal_colapsado_y_con_el_nombre_de_la_pantalla", () => {
        render(<LookAdvanced screens={pantallas} draft={draft} />)
        expect(screen.getByText("looks.more_options")).toBeTruthy()
        expect(screen.getByText("Sala")).toBeTruthy()
        expect((document.querySelector("details") as HTMLDetailsElement).open).toBe(false)
    })

    it("cada_campo_emite_onCell_con_outputId_y_patch", () => {
        const onCell = vi.fn()
        render(<LookAdvanced screens={pantallas} draft={draft} onCell={onCell} />)
        fireEvent.click(screen.getByTestId("color"))
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { background: "#abcdef" } })
        fireEvent.click(screen.getByText("settings.clear_style_background_on_text").closest('[role="switch"]')!)
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { clearStyleBackgroundOnText: true } })
        fireEvent.click(screen.getByText("looks.show_as_faded").closest('[role="switch"]')!)
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { showAsFaded: true } })
        escribir("media.volume (%)", "70")
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { volume: 70 } })
        escribir("looks.lines", "3")
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { lines: 3 } })
        escribir("looks.blur_amount", "4")
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { blurAmount: 4 } })
        escribir("looks.blur_opacity", "20")
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { blurOpacity: 20 } })
    })

    it("el_volumen_sin_valor_guardado_arranca_en_100", () => {
        render(<LookAdvanced screens={pantallas} draft={{ name: "L", screens: {} }} />)
        expect((campo("media.volume (%)").querySelector("input") as HTMLInputElement).value).toBe("100")
    })
})
