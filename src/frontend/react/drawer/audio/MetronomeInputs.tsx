import type { API_metronome } from "../../../components/actions/api"
import type { MetronomeSettings } from "../../../../types/Audio"
import { InputRow } from "../../ui/input-row/InputRow"
import { NumberField } from "../../ui/number-field/NumberField"
import { ToggleField } from "../../ui/toggle-field/ToggleField"

// dispatch("change", values) → onChange(values).
export type MetronomeValues = API_metronome & MetronomeSettings

export interface MetronomeInputsProps {
    values?: MetronomeValues
    action?: boolean
    onChange?: (values: MetronomeValues) => void
}

export function MetronomeInputs({ values = {}, action = false, onChange }: MetronomeInputsProps) {
    function updateValue(key: string, value: number | boolean | undefined) {
        const next = { ...values, [key]: value }
        if (typeof next.tempo === "number") next.tempo = Number(next.tempo.toFixed(3))
        onChange?.(next)
    }

    return (
        <>
            {action ? <ToggleField label="audio.use_metadata_bpm" checked={values.metadataBPM} defaultValue={false} onChange={(checked) => updateValue("metadataBPM", checked)} /> : null}
            <InputRow>
                {!values.metadataBPM ? <NumberField label="audio.tempo <span style='margin-left: 5px;opacity: 0.4;font-size: 0.8em;color: var(--text);'>audio.bpm</span>" value={values.tempo || 120} min={1} max={320} onChange={(value) => updateValue("tempo", value ?? undefined)} /> : null}
                <NumberField label="audio.beats" value={values.beats || 4} min={1} max={16} onChange={(value) => updateValue("beats", value ?? undefined)} />
            </InputRow>
        </>
    )
}
