import { useState } from "react"
import { get } from "svelte/store"
import { activePopup, popupData } from "../../stores"
import { translateText } from "../../utils/language"
import { triggerClickOnEnterSpace } from "../helpers/triggerClickOnEnterSpace"
import { Button } from "../ui/button/Button"
import { HRule } from "../ui/h-rule/HRule"
import { InputRow } from "../ui/input-row/InputRow"
import { NumberField } from "../ui/number-field/NumberField"
import { SelectField } from "../ui/select-field/SelectField"
import { ToggleField } from "../ui/toggle-field/ToggleField"
import styles from "./AspectRatio.module.css"

// Port de components/main/popups/AspectRatio.svelte. Lee: popupData.active (al montar) y popupData.trigger (al elegir).
// Escribe: llama a trigger(valor); si el valor no cambia el active, popupData = {} y activePopup = null.
interface AspectActive {
    width?: number | null
    height?: number | null
    outputResolutionAsRatio?: boolean
    alignPosition?: string | null
    fontSizeRatio?: number | null
}

// https://blog.depositphotos.com/common-aspect-ratios.html
const ratios = [
    // television
    [16, 9],
    [4, 3],
    // widescreen
    [21, 9],
    // square
    [1, 1],
    // photography
    [3, 2],
    // cinematography
    [1.85, 1],
    [2.39, 1]
    // vertical
    // [9, 16],
]

export function AspectRatio() {
    const [active, setActive] = useState<AspectActive>(() => get(popupData).active || { width: 16, height: 9 })
    const [showMore, setShowMore] = useState(false)

    const alignOptions = [
        { value: "center", label: translateText("edit.align_center") },
        { value: "start", label: translateText("edit.align_start") },
        { value: "end", label: translateText("edit.align_end") }
    ]

    function setAspectRatio(value: AspectActive) {
        const trigger = get(popupData).trigger
        if (trigger) trigger(value)

        const previousActive = JSON.stringify(active)
        setActive(value)
        if (previousActive !== JSON.stringify(value)) return
        // if (value.width === 1 || value.height === 1 || value.width === 100 || value.height === 100) return

        popupData.set({})
        activePopup.set(null)
    }

    const isCustomRatio = !active.outputResolutionAsRatio && !ratios.find(([width, height]) => active.width === width && active.height === height)

    return (
        <>
            <Button className={`popup-options ${showMore ? "active" : ""}`} icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} onClick={() => setShowMore(!showMore)} white />

            <div className={styles.grid}>
                {ratios.map(([width, height]) => {
                    const isActive = !active.outputResolutionAsRatio && active.width === width && active.height === height
                    return (
                        <Button key={`${width}:${height}`} disabled={active.outputResolutionAsRatio} showOutline={isActive} isActive={isActive} onClick={() => setAspectRatio({ ...active, width, height })}>
                            <div className={styles.box} style={{ padding: 0, aspectRatio: `${width}/${height}` }}>
                                <p>
                                    {width}:{height}
                                </p>
                            </div>
                        </Button>
                    )
                })}
            </div>

            {showMore || isCustomRatio ? (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                    <div style={{ width: "200px" }} data-title={translateText("actions.custom_key")}>
                        <InputRow>
                            <NumberField disabled={active.outputResolutionAsRatio} label="screen.width" value={active.width || 16} min={1} max={100} onChange={(value) => setAspectRatio({ width: value, height: active.height || 9 })} />
                            <NumberField disabled={active.outputResolutionAsRatio} label="screen.height" value={active.height || 9} min={1} max={100} onChange={(value) => setAspectRatio({ height: value, width: active.width || 16 })} />
                        </InputRow>
                    </div>

                    {isCustomRatio ? (
                        <div className={styles.preview}>
                            <div className={styles.box} role="button" tabIndex={0} style={{ padding: 0, aspectRatio: `${active.width}/${active.height}` }} onClick={() => activePopup.set(null)} onKeyDown={triggerClickOnEnterSpace}>
                                <p>
                                    {active.width}:{active.height}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    <SelectField style={{ width: "200px" }} label="edit.position" disabled={active.outputResolutionAsRatio} options={alignOptions} value={active.alignPosition || "center"} onChange={(value) => setAspectRatio({ ...active, alignPosition: value })} />
                </div>
            ) : null}

            <ToggleField style={{ marginTop: `${showMore ? 10 : 20}px` }} label="settings.output_resolution_ratio" checked={active.outputResolutionAsRatio} defaultValue={false} onChange={(value) => setAspectRatio({ ...active, outputResolutionAsRatio: value })} />

            {showMore ? (
                <>
                    <HRule />

                    <NumberField label="settings.font_size_ratio" value={active.fontSizeRatio ?? 100} min={10} max={500} step={10} onChange={(value) => setAspectRatio({ ...active, fontSizeRatio: value })} />
                </>
            ) : null}
        </>
    )
}
