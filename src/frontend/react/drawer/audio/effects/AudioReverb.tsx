import { useEffect, useRef, useState, type CSSProperties } from "react"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { type ReverbConfig, updateReverbConfig } from "../../../../shared/audio/effects/audioReverb"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import { useElementWidth } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioReverb.svelte.
import type { AudioEffectProps } from "./AudioDelay"

const DEFAULT_CONFIG: ReverbConfig = { enabled: false, roomSize: 0.5, dampening: 0.5, wet: 0.25 }
const CANVAS_H = 100
const ACCENT = { "--accent": "#9952ad" } as CSSProperties

function buildDecayPath(roomSize: number, dampening: number, width: number): string {
    const duration = 0.1 + roomSize * 3.9
    const maxDuration = 4
    const decay = 1 + dampening * 7
    const steps = 100
    const points: string[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const amp = Math.pow(1 - t, decay)
        const x = t * (duration / maxDuration) * width
        const y = CANVAS_H - amp * (CANVAS_H - 8)
        points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`)
    }
    const endX = (duration / maxDuration) * width
    points.push(`L ${endX},${CANVAS_H} L 0,${CANVAS_H} Z`)
    return points.join(" ")
}

export function AudioReverb({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<ReverbConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 200)

    useEffect(() => subscribeEffect<ReverbConfig>("reverb", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const decayPath = buildDecayPath(config.roomSize, config.dampening, canvasW)
    const outlinePath = decayPath.replace(/ L [^L]* L [^L]*$/, "")

    function handleChange(key: keyof ReverbConfig, raw: number) {
        updateReverbConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrap}>
                <div ref={wrapRef} className={styles.svgWrap}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        <path d={decayPath} fill="var(--accent)" opacity={0.18} />
                        <path d={outlinePath} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} />
                        <text x={canvasW - 4} y={12} fill="var(--accent)" fontSize={9} textAnchor="end" opacity={0.85}>{`${(0.1 + config.roomSize * 3.9).toFixed(1)}s`}</text>
                        <text x={4} y={12} fill="var(--text)" fontSize={8} opacity={0.4}>
                            Decay
                        </text>
                        <rect x={canvasW - 6} y={CANVAS_H - config.wet * CANVAS_H} width={4} height={config.wet * CANVAS_H} fill="var(--accent)" opacity={0.5} rx={2} />
                        <text x={canvasW - 10} y={CANVAS_H - 4} fill="var(--accent)" fontSize={8} textAnchor="end" opacity={0.7}>{`${Math.round(config.wet * 100)}%`}</text>
                    </svg>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <NumberField label="audio.room_size" value={Math.round(config.roomSize * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} onChange={(value) => handleChange("roomSize", (value ?? 0) / 100)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.dampening" value={Math.round(config.dampening * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} onChange={(value) => handleChange("dampening", (value ?? 0) / 100)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.wet" value={Math.round(config.wet * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} onChange={(value) => handleChange("wet", (value ?? 0) / 100)} />
            </InputRow>
        </div>
    )
}
