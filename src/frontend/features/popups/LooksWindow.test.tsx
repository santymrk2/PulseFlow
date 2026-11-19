// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { get } from "../../shared/core/lib/store"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { history } from "../../shared/utils/helpers/history"
import { applyLook, createLook } from "../../shared/utils/helpers/looks"
import { activeLook, looks, outputs } from "../../shared/core/stores"
import { confirmCustom } from "../../shared/utils/popup"
import { save } from "../../app/wiring/save"
import type { Look, LookScreen } from "../../../types/Settings"
import { commonMock } from "../../shared/test/mockCommon"
import { looseEntry, setStoresForTest, storeEntry } from "../../shared/test/storeTestKit"
import { LooksWindow } from "./LooksWindow"

vi.mock("../../shared/utils/common", () => ({ ...commonMock(), MENU_BAR_HEIGHT: 36 }))
vi.mock("../../shared/utils/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../shared/utils/helpers/looks", () => ({
    applyLook: vi.fn(),
    createLook: vi.fn(() => "l3"),
    isStageOutput: (output?: { stageOutput?: string }) => !!output?.stageOutput
}))
vi.mock("../../shared/utils/popup", () => ({ confirmCustom: vi.fn() }))
vi.mock("../../app/wiring/save", () => ({ save: vi.fn() }))
vi.mock("../../react/looks/LookGrid", () => ({
    LookGrid: ({ onCell }: { onCell?: (detail: { outputId: string; patch: Partial<LookScreen> }) => void }) => (
        <div>
            <span>LookGrid</span>
            <button type="button" onClick={() => onCell?.({ outputId: "a", patch: { layers: { media: false, slide: true, overlays: true } } })}>
                cambiar celda
            </button>
        </div>
    )
}))

const look = (name: string, transitionMs = 1000): Look => ({ name, transitionMs, screens: {} }) as Look

let restaurar: () => void = () => {}
beforeEach(() => {
    restaurar = setStoresForTest([looseEntry(looks, { l1: look("Uno"), l2: look("Dos") }), storeEntry(activeLook, "l1"), looseEntry(outputs, { a: { name: "Audiencia" }, s: { name: "Escenario", stageOutput: "lay" } })] as never)
    vi.clearAllMocks()
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("LooksWindow", () => {
    it("muestra el modal, el look en vivo, los presets y la grilla de la audiencia", () => {
        render(<LooksWindow />)
        expect(screen.getByRole("dialog")).toBeTruthy()
        expect(screen.getByText("looks.window_title")).toBeTruthy()
        expect(screen.getAllByText(/looks.live/).length).toBeGreaterThan(0)
        expect(screen.getAllByText("Uno").length).toBeGreaterThan(0)
        expect(screen.getByText("Dos")).toBeTruthy()
        expect(screen.getByText("LookGrid")).toBeTruthy()
        expect(screen.queryByText("Escenario")).toBeNull()
    })

    it("seleccionar otro preset muestra su nombre y el guardar queda desactivado", () => {
        render(<LooksWindow />)
        fireEvent.click(screen.getByText("Dos"))
        expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Dos")
        expect((screen.getByRole("button", { name: "actions.save" }) as HTMLButtonElement).disabled).toBe(true)
    })

    it("editar el nombre habilita Guardar y escribe en el historial", () => {
        render(<LooksWindow />)
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "Uno nuevo" } })
        const guardar = screen.getByRole("button", { name: "actions.save" }) as HTMLButtonElement
        expect(guardar.disabled).toBe(false)
        fireEvent.click(guardar)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: "UPDATE", oldData: { id: "l1" } }))
        expect(save).toHaveBeenCalled()
    })

    it("cambiar una celda de LookGrid marca el borrador como modificado", () => {
        render(<LooksWindow />)
        fireEvent.click(screen.getByText("cambiar celda"))
        expect((screen.getByRole("button", { name: "actions.save" }) as HTMLButtonElement).disabled).toBe(false)
    })

    it("el slider de transición actualiza el borrador", () => {
        render(<LooksWindow />)
        const slider = screen.getByRole("slider") as HTMLInputElement
        fireEvent.change(slider, { target: { value: "2000" } })
        expect(screen.getByText("2.0 s")).toBeTruthy()
        expect((screen.getByRole("button", { name: "actions.save" }) as HTMLButtonElement).disabled).toBe(false)
    })

    it("crear un preset llama a createLook, guarda y lo selecciona", () => {
        render(<LooksWindow />)
        fireEvent.click(screen.getByRole("button", { name: "+ looks.new" }))
        expect(createLook).toHaveBeenCalledWith("looks.looks 3")
        expect(save).toHaveBeenCalled()
    })

    it("Hacer en vivo aplica el preset seleccionado", () => {
        render(<LooksWindow />)
        fireEvent.click(screen.getByRole("button", { name: "looks.make_live" }))
        expect(applyLook).toHaveBeenCalledWith("l1")
    })

    it("eliminar pide confirmación antes de escribir en el historial", () => {
        vi.mocked(confirmCustom).mockResolvedValue(false)
        render(<LooksWindow />)
        fireEvent.click(screen.getByRole("button", { name: "actions.delete" }))
        expect(confirmCustom).toHaveBeenCalled()
        expect(history).not.toHaveBeenCalled()
    })

    it("el menú contextual renombra con window.prompt", () => {
        const prompt = vi.spyOn(window, "prompt").mockReturnValue("Nuevo nombre")
        render(<LooksWindow />)
        fireEvent.contextMenu(screen.getByText("Dos"))
        expect(prompt).toHaveBeenCalledWith("looks.name", "Dos")
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ oldData: { id: "l2" } }))
        prompt.mockRestore()
    })

    it("sin pantallas de audiencia muestra el aviso", () => {
        outputs.set({})
        render(<LooksWindow />)
        expect(screen.getByText("looks.no_screens")).toBeTruthy()
        expect(get(activeLook)).toBe("l1")
    })
})
