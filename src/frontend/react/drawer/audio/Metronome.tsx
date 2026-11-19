import { useEffect, useState } from "react"
import type { MetronomeSettings } from "../../../../types/Audio"
import type { DropdownOptions } from "../../../../types/Input"
import { audioExtensions } from "../../../shared/core/values/extensions"
import { toggleMetronome, updateMetronome } from "../../../components/drawer/audio/metronome"
import { clone } from "../../../shared/utils/helpers/array"
import { dictionary, metronome, outLocked, playingMetronome, special } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../../ui/button/Button"
import { FileField } from "../../ui/file-field/FileField"
import { FloatingBar } from "../../ui/floating-bar/FloatingBar"
import { InputRow } from "../../ui/input-row/InputRow"
import { NumberField } from "../../ui/number-field/NumberField"
import { SelectField } from "../../ui/select-field/SelectField"
import { SelectElem } from "../../system/SelectElem"
import { MetronomeInputs, type MetronomeValues } from "./MetronomeInputs"
import { MetronomeVisualizer } from "./MetronomeVisualizer"
import styles from "./Metronome.module.css"

// Port de components/drawer/audio/Metronome.svelte.
export function Metronome() {
    const metronomeValue = useStore(metronome)
    const playing = useStore(playingMetronome)
    const outLockedValue = useStore(outLocked)
    const specialValue = useStore(special)
    useStore(dictionary) // translateText("sort.custom")

    const [values, setValues] = useState<MetronomeValues>(() => clone(metronomeValue))
    const [options, setOptions] = useState(false)
    const paused = !playing

    useEffect(() => setValues(clone(metronomeValue)), [metronomeValue])

    function updateValue(key: string, value: unknown) {
        updateMetronome({ ...values, [key]: value } as MetronomeSettings)
    }

    const clickSounds: DropdownOptions = [
        { value: "metal", label: "Metal" },
        { value: "wood", label: "Wood" },
        { value: "custom", label: translateText("sort.custom") }
    ]

    function updateSpecial(key: string, value: unknown) {
        special.update((a) => ({ ...a, [key]: value }))
    }

    return (
        <>
            {options ? (
                <div className={styles.settings}>
                    <SelectField label="audio.click_sound" disabled={!paused} options={clickSounds} value={specialValue.clickSound || "metal"} onChange={(value) => updateSpecial("clickSound", value)} />
                    {specialValue.clickSound === "custom" ? (
                        <InputRow>
                            <FileField label="tabs.audio (Hi)" icon="music" disabled={!paused} value={specialValue.clickSound_hi || ""} filter={{ name: "Audio files", extensions: audioExtensions }} onChange={(value) => updateSpecial("clickSound_hi", value)} />
                            <FileField label="tabs.audio (Lo)" icon="music" disabled={!paused} value={specialValue.clickSound_lo || ""} filter={{ name: "Audio files", extensions: audioExtensions }} onChange={(value) => updateSpecial("clickSound_lo", value)} />
                        </InputRow>
                    ) : null}
                    <InputRow>
                        <NumberField label="media.volume (Hi)" value={Number(((values.accentVolume ?? 2) * 100).toFixed(0))} min={0} max={500} step={5} defaultValue={200} onChange={(value) => updateValue("accentVolume", (value ?? 0) / 100)} showSlider />
                        <NumberField label="media.volume (Lo)" value={Number(((values.secondaryVolume ?? 1.75) * 100).toFixed(0))} min={0} max={500} step={5} defaultValue={175} onChange={(value) => updateValue("secondaryVolume", (value ?? 0) / 100)} showSlider />
                    </InputRow>
                </div>
            ) : (
                <div className={styles.settings} style={{ display: "flex", gap: 10 }}>
                    <SelectElem id="metronome" data={{ tempo: values.tempo || 120, beats: values.beats || 4 }} draggable>
                        <Button style={{ width: "100%", height: "100%", justifyContent: "center", borderRadius: 6 }} disabled={outLockedValue} title={translateText("audio.toggle_metronome")} onClick={() => toggleMetronome()}>
                            <Icon id={paused ? "play" : "stop"} white={paused} size={5} />
                        </Button>
                    </SelectElem>

                    <div style={{ flex: 1 }}>
                        <MetronomeInputs
                            values={values}
                            onChange={(next) => {
                                setValues(next)
                                updateMetronome(next)
                            }}
                        />
                        <MetronomeVisualizer />
                    </div>
                </div>
            )}

            {/* El original contemplaba presets de últimos valores; se omite porque nunca estuvo implementado. */}
            <FloatingBar round>
                <Button isActive={options} title="edit.options" onClick={() => setOptions(!options)}>
                    <Icon size={1.1} id="options" white={!options} />
                </Button>
            </FloatingBar>
        </>
    )
}
