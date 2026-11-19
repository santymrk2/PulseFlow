import { useEffect, useRef, useState } from "react"
import { uid } from "uid"
import { DEFAULT_EFFECT_CONFIGS, setEffectConfig, subscribeEffect, type EffectKey, type EffectType } from "../../../../audio/effects/audioEffectsHelpers"
import { audioEffectPresets } from "../../../../shared/core/stores"
import { translateText } from "../../../../utils/language"
import { clone, keysToID } from "../../../../components/helpers/array"
import { useStore } from "../../../hooks/useStore"
import { Button } from "../../../ui/button/Button"
import { InputRow } from "../../../ui/input-row/InputRow"
import { SelectField } from "../../../ui/select-field/SelectField"
import { TextField } from "../../../ui/text-field/TextField"

// Port de components/drawer/audio/effects/AudioEffectPresets.svelte.
export interface AudioEffectPresetsProps {
    effectKey?: EffectType
    channelId?: string
    effectId?: string
}

interface PresetEntry {
    name: string
    config: Record<string, unknown>
}
type PresetMap = Record<string, PresetEntry>

interface PresetState {
    selectedPreset: string
    customName: string
    currentConfig: Record<string, unknown> | null
    isCustom: boolean
}

const INITIAL_STATE: PresetState = { selectedPreset: "default", customName: "", currentConfig: null, isCustom: false }

function areConfigsEqual(a: unknown, b: unknown): boolean {
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
    const copyA = clone(a) as Record<string, unknown>
    const copyB = clone(b) as Record<string, unknown>
    delete copyA.enabled
    delete copyB.enabled
    return JSON.stringify(copyA) === JSON.stringify(copyB)
}

function defaultCustomName(presets: PresetMap): string {
    const label = translateText("audio.preset")
    const existing = Object.values(presets)
        .map(({ name }) => {
            const match = name?.match(new RegExp(`^${label} (\\d+)$`))
            return match ? parseInt(match[1], 10) : null
        })
        .filter((num): num is number => num !== null)
    return `${label} ${existing.length + 1}`
}

function checkPresetMatch(cfg: Record<string, unknown>, state: PresetState, presets: PresetMap, effectKey: EffectType): Partial<PresetState> {
    const currentDefault = (DEFAULT_EFFECT_CONFIGS[effectKey] || {}) as Record<string, unknown>
    const selected = state.selectedPreset

    if (selected !== "custom" && selected !== "default" && presets[selected]?.config && areConfigsEqual(cfg, presets[selected].config)) {
        return { isCustom: false }
    }
    if (areConfigsEqual(cfg, currentDefault)) return { selectedPreset: "default", isCustom: false }
    for (const [id, preset] of Object.entries(presets)) {
        if (preset?.config && areConfigsEqual(cfg, preset.config)) return { selectedPreset: id, isCustom: false }
    }
    return { selectedPreset: "custom", isCustom: true, customName: state.customName || defaultCustomName(presets) }
}

export function AudioEffectPresets({ effectKey = "equalizer", channelId = "main", effectId = "" }: AudioEffectPresetsProps) {
    const [state, setState] = useState<PresetState>(INITIAL_STATE)
    const allPresets = useStore(audioEffectPresets) as unknown as Record<string, PresetMap>
    const effectPresets = allPresets[effectKey] ?? {}
    const presetsRef = useRef<PresetMap>(effectPresets)

    useEffect(() => {
        presetsRef.current = effectPresets
    }, [effectPresets])

    useEffect(() => {
        setState(INITIAL_STATE)
        return subscribeEffect(
            effectKey,
            (cfg) => {
                const cloned = clone(cfg) as Record<string, unknown>
                setState((prev) => ({ ...prev, currentConfig: cloned, ...checkPresetMatch(cloned, prev, presetsRef.current, effectKey) }))
            },
            channelId,
            effectId
        )
    }, [effectKey, channelId, effectId])

    const presets: PresetMap = {
        ...effectPresets,
        default: { name: translateText("example.default"), config: (DEFAULT_EFFECT_CONFIGS[effectKey] || {}) as Record<string, unknown> },
        ...(state.isCustom && state.currentConfig ? { custom: { name: translateText("sort.custom"), config: state.currentConfig } } : {})
    }
    const presetOptions = keysToID(presets)
        .map((preset) => ({ label: preset.name, value: preset.id }))
        .sort((a, b) => {
            if (a.value === "default" || a.value === "custom") return -1
            if (b.value === "default" || b.value === "custom") return 1
            return a.label.localeCompare(b.label)
        })

    function selectPreset(value: string) {
        setState((prev) => ({ ...prev, selectedPreset: value, isCustom: value === "custom" }))
        if (value === "custom") return

        const currentDefault = (DEFAULT_EFFECT_CONFIGS[effectKey] || {}) as Record<string, unknown>
        const preset = value === "default" ? { config: currentDefault } : effectPresets[value]
        if (!preset?.config) return
        setEffectConfig(effectKey as EffectKey, clone(preset.config), channelId, effectId)
    }

    function saveCustomPreset() {
        const name = state.customName.trim()
        if (!name || !state.currentConfig) return

        const id = uid(5)
        audioEffectPresets.update((all) => {
            const effects = all[effectKey] ? { ...all[effectKey] } : {}
            effects[id] = { name, config: clone(state.currentConfig) as never }
            return { ...all, [effectKey]: effects }
        })

        setState((prev) => ({ ...prev, isCustom: false, selectedPreset: id, customName: defaultCustomName({ ...effectPresets, [id]: { name, config: state.currentConfig as Record<string, unknown> } }) }))
    }

    function deletePreset() {
        if (state.selectedPreset === "default" || state.selectedPreset === "custom") return

        audioEffectPresets.update((all) => {
            const effects = all[effectKey] ? { ...all[effectKey] } : {}
            delete effects[state.selectedPreset]
            return { ...all, [effectKey]: effects }
        })
        selectPreset("default")
    }

    return (
        <InputRow>
            <SelectField label="audio.preset" value={state.selectedPreset} options={presetOptions} defaultValue="default" onChange={(value) => selectPreset(value ?? "default")} />

            {state.selectedPreset === "custom" ? (
                <>
                    <TextField label="inputs.name" value={state.customName} onChange={(value) => setState((prev) => ({ ...prev, customName: value ?? "" }))} />
                    <Button icon="save" title="actions.save" onClick={saveCustomPreset} />
                </>
            ) : state.selectedPreset !== "default" ? (
                <Button icon="delete" title="actions.delete" onClick={deletePreset} white />
            ) : null}
        </InputRow>
    )
}
