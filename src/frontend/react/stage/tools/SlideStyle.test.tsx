// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeStage, outputs, stageShows } from "../../../stores"
import { translateText } from "../../../utils/language"
import { history } from "../../../components/helpers/history"
import { SlideStyle } from "./SlideStyle"

vi.mock("../../../stores", () => {
    function makeStore(initial: unknown) {
        let value = initial
        const listeners = new Set<(next: unknown) => void>()
        return {
            subscribe(run: (next: unknown) => void) {
                listeners.add(run)
                run(value)
                return () => listeners.delete(run)
            },
            set(next: unknown) {
                value = next
                listeners.forEach((run) => run(value))
            }
        }
    }
    return { activeStage: makeStore({ id: "st1", items: [] }), outputs: makeStore({}), stageShows: makeStore({}) }
})
vi.mock("../../../utils/language", () => ({ translateText: vi.fn((id: string) => id) }))
vi.mock("../../../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../ui/select-field/SelectField", () => ({
    SelectField: ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange?: (value: string | null) => void }) => (
        <select data-testid="output" aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)}>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    )
}))
vi.mock("../../ui/text-field/TextField", () => ({
    TextField: ({ label, value, onChange }: { label: string; value: string; onChange?: (value: string | null) => void }) => <input data-testid="password" aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)} />
}))
vi.mock("../../ui/color-field/ColorField", () => ({
    ColorField: ({ label, value, onInput }: { label: string; value: string; onInput?: (value: string) => void }) => <input data-testid="color" aria-label={label} value={value} onChange={(event) => onInput?.(event.target.value)} />
}))
vi.mock("../../ui/checkbox-field/CheckboxField", () => ({
    CheckboxField: ({ label, checked, onChange }: { label: string; checked?: boolean; onChange?: (value: boolean) => void }) => <input data-testid="labels" type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange?.(event.target.checked)} />
}))
vi.mock("./StageItemsList", () => ({ StageItemsList: () => <div data-testid="items-list" /> }))

const stage = { id: "st1", password: "secreto", settings: { output: "out1", color: "#123456", labels: false } }

beforeEach(() => {
    activeStage.set({ id: "st1", items: [] } as never)
    stageShows.set({ st1: stage } as never)
    outputs.set({ out2: { name: "B", enabled: true }, out1: { name: "A", enabled: true }, stageOut: { name: "Stage", stageOutput: true, enabled: true } } as never)
})
afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe("SlideStyle", () => {
    it("muestra las opciones ordenadas, excluyendo la salida de stage", () => {
        const { container } = render(<SlideStyle />)
        const options = [...container.querySelectorAll<HTMLOptionElement>('[data-testid="output"] option')].map((option) => option.value)
        expect(options).toEqual(["out1", "out2"])
        expect((container.querySelector('[data-testid="password"]') as HTMLInputElement).value).toBe("secreto")
        expect((container.querySelector('[data-testid="color"]') as HTMLInputElement).value).toBe("#123456")
        expect(container.querySelector('[data-testid="items-list"]')).toBeTruthy()
        expect(translateText).toHaveBeenCalledWith("edit.style")
    })

    it("guarda la salida de origen y la contraseña", () => {
        const { container } = render(<SlideStyle />)
        fireEvent.change(container.querySelector('[data-testid="output"]')!, { target: { value: "out2" } })
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: "out2", key: "settings", subkey: "output" }, oldData: { id: "st1" }, location: { page: "stage", id: "stage" } })

        fireEvent.change(container.querySelector('[data-testid="password"]')!, { target: { value: "nuevo" } })
        expect(history).toHaveBeenCalledWith({ id: "UPDATE", newData: { data: "nuevo", key: "password" }, oldData: { id: "st1" }, location: { page: "stage", id: "stage" } })
    })

    it("guarda el color de fondo y el de etiquetas al activarlas", () => {
        const { container } = render(<SlideStyle />)
        fireEvent.change(container.querySelector('[data-testid="color"]')!, { target: { value: "#ffffff" } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: "#ffffff", key: "settings", subkey: "color" } }))

        fireEvent.click(container.querySelector('[data-testid="labels"]')!)
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: true, key: "settings", subkey: "labels" } }))
        act(() => stageShows.set({ st1: { ...stage, settings: { ...stage.settings, labels: true } } } as never))

        const labelColors = [...container.querySelectorAll<HTMLInputElement>('[data-testid="color"]')]
        expect(labelColors[1].value).toBe("#ac9c35")
        fireEvent.change(labelColors[1], { target: { value: "#abcdef" } })
        expect(history).toHaveBeenCalledWith(expect.objectContaining({ newData: { data: "#abcdef", key: "settings", subkey: "labelColor" } }))
    })

    it("no escribe en el historial si el valor no cambia", () => {
        const { container } = render(<SlideStyle />)
        fireEvent.change(container.querySelector('[data-testid="output"]')!, { target: { value: "out1" } })
        fireEvent.change(container.querySelector('[data-testid="password"]')!, { target: { value: "secreto" } })
        expect(history).not.toHaveBeenCalled()
    })
})
