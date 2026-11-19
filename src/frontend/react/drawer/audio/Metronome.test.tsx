// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toggleMetronome, updateMetronome } from "../../../components/drawer/audio/metronome"
import { dictionary, metronome, outLocked, playingMetronome, special } from "../../../shared/core/stores"
import { commonMock } from "../../test/mockCommon"
import { looseEntry, setStoresForTest } from "../../test/storeTestKit"
import { Metronome } from "./Metronome"

vi.mock("../../../components/drawer/audio/metronome", () => ({ toggleMetronome: vi.fn(), updateMetronome: vi.fn() }))
vi.mock("../../../shared/utils/common", () => commonMock())
vi.mock("../../helpers/Icon", () => ({ Icon: ({ id }: { id: string }) => <span data-icon={id} /> }))
vi.mock("../../ui/button/Button", () => ({
    Button: ({ title, children, onClick, isActive }: { title?: string; children?: ReactNode; onClick?: () => void; isActive?: boolean }) => (
        <button title={title} data-active={isActive} onClick={() => onClick?.()}>
            {children}
        </button>
    )
}))
vi.mock("../../ui/floating-bar/FloatingBar", () => ({ FloatingBar: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("../../ui/input-row/InputRow", () => ({ InputRow: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("../../ui/select-field/SelectField", () => ({
    SelectField: ({ label, value, onChange }: { label: string; value?: string; onChange?: (value: string) => void }) => (
        <div data-testid="select-field" data-label={label}>
            <span>{label}</span>
            <button onClick={() => onChange?.("wood")}>{value}</button>
        </div>
    )
}))
vi.mock("../../ui/file-field/FileField", () => ({ FileField: ({ label }: { label: string }) => <div>{label}</div> }))
vi.mock("../../ui/number-field/NumberField", () => ({
    NumberField: ({ label, onChange }: { label: string; onChange?: (value: number) => void }) => (
        <button data-testid="number-field" data-label={label} onClick={() => onChange?.(200)}>
            {label}
        </button>
    )
}))
vi.mock("../../system/SelectElem", () => ({ SelectElem: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("./MetronomeInputs", () => ({
    MetronomeInputs: ({ onChange }: { onChange?: (values: Record<string, number>) => void }) => (
        <button data-testid="metronome-inputs" onClick={() => onChange?.({ tempo: 140, beats: 4 })}>
            inputs
        </button>
    )
}))
vi.mock("./MetronomeVisualizer", () => ({ MetronomeVisualizer: () => <div data-testid="metronome-visualizer" /> }))

let restaurar: () => void = () => {}

beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(metronome, { tempo: 120, beats: 4, accentVolume: 2, secondaryVolume: 1.75 }), looseEntry(playingMetronome, false), looseEntry(outLocked, false), looseEntry(special, { clickSound: "metal" }), looseEntry(dictionary, {})])
})

afterEach(() => {
    cleanup()
    restaurar()
})

describe("Metronome", () => {
    it("muestra el icono de play cuando está detenido", () => {
        render(<Metronome />)
        expect(document.querySelector("[data-icon='play']")).not.toBeNull()
    })

    it("muestra el icono de stop cuando está sonando", () => {
        playingMetronome.set(true)
        render(<Metronome />)
        expect(document.querySelector("[data-icon='stop']")).not.toBeNull()
    })

    it("alterna el metrónomo al hacer click en play", () => {
        render(<Metronome />)
        fireEvent.click(screen.getByTitle("audio.toggle_metronome"))
        expect(toggleMetronome).toHaveBeenCalled()
    })

    it("muestra las opciones de sonido al abrir el panel", () => {
        render(<Metronome />)
        fireEvent.click(screen.getByTitle("edit.options"))
        expect(screen.getByTestId("select-field")).toBeTruthy()
        expect(screen.getByText("audio.click_sound")).toBeTruthy()
    })

    it("actualiza el metrónomo al cambiar los valores", () => {
        render(<Metronome />)
        fireEvent.click(screen.getByTestId("metronome-inputs"))
        expect(updateMetronome).toHaveBeenCalledWith(expect.objectContaining({ tempo: 140, beats: 4 }))
    })
})
