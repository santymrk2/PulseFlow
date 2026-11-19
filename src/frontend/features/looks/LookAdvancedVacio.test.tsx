// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LookAdvanced } from "./LookAdvanced"

vi.mock("../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../shared/ui/kit/color-field/ColorField", () => ({ ColorField: () => null }))
vi.mock("../../shared/ui/kit/number-field/NumberField", () => ({ NumberField: ({ label, onChange }: { label: string; onChange: (v: number | null) => void }) => <button onClick={() => onChange(null)}>{label}</button> }))

afterEach(cleanup)

describe("LookAdvanced con campo numérico vacío", () => {
    it("conserva_null_como_el_svelte_en_vez_de_convertirlo_en_undefined", () => {
        const onCell = vi.fn()
        const pantalla = { id: "a", name: "S", enabled: true, active: true, color: "", bounds: { x: 0, y: 0, width: 1, height: 1 }, screen: null }
        render(<LookAdvanced screens={[pantalla]} draft={{ name: "L", screens: {} }} onCell={onCell} />)
        fireEvent.click(screen.getByText("media.volume (%)"))
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { volume: null } })
        fireEvent.click(screen.getByText("looks.blur_opacity"))
        expect(onCell).toHaveBeenLastCalledWith({ outputId: "a", patch: { blurOpacity: null } })
    })
})
