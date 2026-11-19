// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commonMock } from "../../../shared/test/mockCommon"
import { MetronomeInputs } from "./MetronomeInputs"

vi.mock("../../../shared/utils/common", () => commonMock())

afterEach(() => cleanup())

describe("MetronomeInputs", () => {
    it("muestra el tempo y los beats", () => {
        render(<MetronomeInputs values={{ tempo: 140, beats: 3 }} />)
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[]
        expect(inputs.map((input) => input.value)).toContain("140")
        expect(inputs.map((input) => input.value)).toContain("3")
    })

    it("oculta el tempo cuando se usan metadatos BPM", () => {
        render(<MetronomeInputs values={{ tempo: 140, beats: 4, metadataBPM: true }} />)
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[]
        expect(inputs.map((input) => input.value)).not.toContain("140")
    })

    it("despacha el objeto completo al cambiar un valor", () => {
        const onChange = vi.fn()
        render(<MetronomeInputs values={{ tempo: 120, beats: 4 }} action onChange={onChange} />)
        fireEvent.click(screen.getByRole("switch"))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tempo: 120, beats: 4, metadataBPM: true }))
    })
})
