// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setEffectConfig, subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { audioEffectPresets } from "../../../../shared/core/stores"
import { looseEntry, setStoresForTest } from "../../../../shared/test/storeTestKit"
import { AudioEffectPresets } from "./AudioEffectPresets"

interface Option {
    label: string
    value: string
}

vi.mock("../../../../shared/audio/effects/audioEffectsHelpers", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../../shared/audio/effects/audioEffectsHelpers")>()
    return {
        ...actual,
        subscribeEffect: vi.fn((key: string, callback: (config: object) => void) => {
            callback(actual.DEFAULT_EFFECT_CONFIGS[key as keyof typeof actual.DEFAULT_EFFECT_CONFIGS])
            return () => {}
        }),
        setEffectConfig: vi.fn()
    }
})
vi.mock("../../../../shared/utils/common", () => ({ isMainWindow: () => false }))
vi.mock("../../../../shared/ui/kit/input-row/InputRow", () => ({ InputRow: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock("../../../../shared/ui/kit/select-field/SelectField", () => ({
    SelectField: ({ options, onChange }: { options?: Option[]; onChange?: (value: string) => void }) => (
        <div>
            {(options ?? []).map((option) => (
                <button key={option.value} data-preset={option.value} onClick={() => onChange?.(option.value)}>
                    {option.label}
                </button>
            ))}
        </div>
    )
}))
vi.mock("../../../../shared/ui/kit/text-field/TextField", () => ({ TextField: ({ onChange }: { onChange?: (value: string) => void }) => <input aria-label="nombre" onChange={(event) => onChange?.(event.target.value)} /> }))
vi.mock("../../../../shared/ui/kit/button/Button", () => ({ Button: ({ title, onClick }: { title?: string; onClick?: () => void }) => <button title={title} onClick={onClick} /> }))

let restaurar: () => void = () => {}
beforeEach(() => {
    vi.clearAllMocks()
    restaurar = setStoresForTest([looseEntry(audioEffectPresets, { reverb: { preset1: { name: "Sala grande", config: { roomSize: 0.9 } } } })])
})
afterEach(() => {
    cleanup()
    restaurar()
})

describe("AudioEffectPresets", () => {
    it("se suscribe al efecto indicado con canal e id", () => {
        render(<AudioEffectPresets effectKey="reverb" channelId="ch1" effectId="r1" />)
        expect(subscribeEffect).toHaveBeenCalledWith("reverb", expect.any(Function), "ch1", "r1")
    })

    it("ofrece el preset por defecto y los guardados", () => {
        render(<AudioEffectPresets effectKey="reverb" />)
        expect(screen.getByText("example.default")).toBeTruthy()
        expect(screen.getByText("Sala grande")).toBeTruthy()
    })

    it("aplica la configuración del preset elegido", () => {
        render(<AudioEffectPresets effectKey="reverb" channelId="ch1" effectId="r1" />)
        fireEvent.click(screen.getByText("Sala grande"))
        expect(setEffectConfig).toHaveBeenCalledWith("reverb", { roomSize: 0.9 }, "ch1", "r1")
    })

    it("el preset por defecto se puede volver a aplicar", () => {
        render(<AudioEffectPresets effectKey="reverb" channelId="ch1" effectId="r1" />)
        fireEvent.click(screen.getByText("Sala grande"))
        vi.mocked(setEffectConfig).mockClear()
        fireEvent.click(screen.getByText("example.default"))
        expect(setEffectConfig).toHaveBeenCalledWith("reverb", expect.objectContaining({ roomSize: 0.7 }), "ch1", "r1")
    })
})
