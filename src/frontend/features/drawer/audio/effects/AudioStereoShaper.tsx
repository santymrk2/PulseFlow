import { useEffect, useRef, useState, type CSSProperties } from "react"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { type StereoShaperConfig, updateStereoShaperConfig } from "../../../../shared/audio/effects/audioStereoShaper"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import type { AudioEffectProps } from "./AudioDelay"
import { useElementWidth } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioStereoShaper.svelte.
const DEFAULT_CONFIG: StereoShaperConfig = { enabled: false, width: 100 }
const CANVAS_H = 110
const ACCENT = { "--accent": "#52adad" } as CSSProperties

function ellipsePath(x: number, y: number, a: number, b: number): string {
    const k = 0.5523 * a
    const kv = 0.5523 * b
    return `M ${x},${y - b} C ${x + k},${y - b} ${x + a},${y - kv} ${x + a},${y} C ${x + a},${y + kv} ${x + k},${y + b} ${x},${y + b} C ${x - k},${y + b} ${x - a},${y + kv} ${x - a},${y} C ${x - a},${y - kv} ${x - k},${y - b} ${x},${y - b} Z`
}

function buildFieldPaths(width: number, canvasW: number) {
    const cx = canvasW / 2
    const cy = CANVAS_H / 2
    const maxRadius = (canvasW / 2) * 0.42
    const spread = (width / 200) * maxRadius
    const rx = maxRadius * 0.55 + spread * 0.45
    const ry = CANVAS_H * 0.38
    return { left: ellipsePath(cx - spread, cy, rx, ry), right: ellipsePath(cx + spread, cy, rx, ry), center: cx }
}

export function AudioStereoShaper({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<StereoShaperConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 300)

    useEffect(() => subscribeEffect<StereoShaperConfig>("stereoShaper", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const field = buildFieldPaths(config.width, canvasW)
    const widthLabel = config.width === 0 ? "Mono" : config.width === 100 ? "Stereo" : config.width < 100 ? `${config.width}% (narrow)` : `${config.width}% (wide)`

    function handleChange(key: keyof StereoShaperConfig, raw: number) {
        updateStereoShaperConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrap}>
                <div ref={wrapRef} className={styles.svgWrap}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        <rect x={0} y={0} width={canvasW} height={CANVAS_H} fill="transparent" />
                        <path d={field.left} fill="var(--accent)" opacity={0.18} />
                        <path d={field.left} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.6} />
                        <path d={field.right} fill="var(--accent)" opacity={0.18} />
                        <path d={field.right} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.6} />
                        <line x1={field.center} y1={4} x2={field.center} y2={CANVAS_H - 4} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.3} strokeDasharray="3,3" />
                        <text x={10} y={CANVAS_H / 2 + 4} fill="var(--accent)" fontSize={11} opacity={0.7} fontWeight="bold">
                            L
                        </text>
                        <text x={canvasW - 16} y={CANVAS_H / 2 + 4} fill="var(--accent)" fontSize={11} opacity={0.7} fontWeight="bold">
                            R
                        </text>
                        <text x={field.center} y={CANVAS_H - 6} fill="var(--accent)" fontSize={9} textAnchor="middle" opacity={0.85}>
                            {widthLabel}
                        </text>
                    </svg>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <NumberField label="audio.width" value={config.width} min={0} max={200} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 200, step: 1 }} onChange={(value) => handleChange("width", value ?? 0)} />
            </InputRow>
        </div>
    )
}
