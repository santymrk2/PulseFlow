import { useEffect, useRef, useState, type CSSProperties } from "react"
import { MAX_DB, MIN_DB } from "../../../../shared/audio/dBUtils"
import { getCompressorReduction, type CompressorConfig, updateCompressorConfig } from "../../../../shared/audio/effects/audioCompressor"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import type { AudioEffectProps } from "./AudioDelay"
import { useElementWidth, useLiveLevels } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioCompressor.svelte.
const DEFAULT_CONFIG: CompressorConfig = { enabled: false, threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }
const CANVAS_H = 200
const ACCENT = { "--accent": "#ad6852" } as CSSProperties

function dbToX(db: number, w: number): number {
    return ((db - MIN_DB) / (MAX_DB - MIN_DB)) * w
}

function dbToY(db: number): number {
    return CANVAS_H - ((db - MIN_DB) / (MAX_DB - MIN_DB)) * CANVAS_H
}

function transferOutput(inputDb: number, threshold: number, knee: number, ratio: number): number {
    const halfKnee = knee / 2
    if (inputDb <= threshold - halfKnee || knee === 0) {
        return inputDb <= threshold ? inputDb : threshold + (inputDb - threshold) / ratio
    }
    if (inputDb >= threshold + halfKnee) return threshold + (inputDb - threshold) / ratio
    return inputDb + ((1 / ratio - 1) * Math.pow(inputDb - threshold + halfKnee, 2)) / (2 * knee)
}

function buildTransferPath(threshold: number, knee: number, ratio: number, width: number): string {
    const steps = 120
    const points: string[] = []
    for (let i = 0; i <= steps; i++) {
        const inputDb = MIN_DB + (i / steps) * (MAX_DB - MIN_DB)
        const outputDb = transferOutput(inputDb, threshold, knee, ratio)
        points.push(`${i === 0 ? "M" : "L"} ${dbToX(inputDb, width)},${dbToY(Math.max(MIN_DB, Math.min(MAX_DB, outputDb)))}`)
    }
    return points.join(" ")
}

export function AudioCompressor({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<CompressorConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 200)
    const { inputLevelDb, reduction } = useLiveLevels(channelId, getCompressorReduction)

    useEffect(() => subscribeEffect<CompressorConfig>("compressor", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const transferPath = buildTransferPath(config.threshold, config.knee, config.ratio, canvasW)
    const kneeX1 = dbToX(config.threshold - config.knee / 2, canvasW)
    const kneeX2 = dbToX(config.threshold + config.knee / 2, canvasW)
    const threshX = dbToX(config.threshold, canvasW)
    const signalX = dbToX(inputLevelDb, canvasW)
    const signalY = dbToY(Math.max(MIN_DB, Math.min(MAX_DB, transferOutput(inputLevelDb, config.threshold, config.knee, config.ratio))))

    function handleChange(key: keyof CompressorConfig, raw: number) {
        updateCompressorConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrapFlex}>
                <div ref={wrapRef} className={styles.svgWrapFlex}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        {[-60, -48, -36, -24, -12, 0].map((db) => (
                            <g key={db}>
                                <line x1={dbToX(db, canvasW)} y1={0} x2={dbToX(db, canvasW)} y2={CANVAS_H} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.25} />
                                <line x1={0} y1={dbToY(db)} x2={canvasW} y2={dbToY(db)} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.25} />
                                <text x={dbToX(db, canvasW) + 2} y={CANVAS_H - 3} fill="var(--text)" fontSize={8} opacity={0.45}>
                                    {db}
                                </text>
                                <text x={2} y={dbToY(db) - 2} fill="var(--text)" fontSize={8} opacity={0.45}>
                                    {db}
                                </text>
                            </g>
                        ))}
                        <line x1={dbToX(MIN_DB, canvasW)} y1={dbToY(MIN_DB)} x2={dbToX(MAX_DB, canvasW)} y2={dbToY(MAX_DB)} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.35} strokeDasharray="4,4" />
                        {config.knee > 0 ? <rect x={kneeX1} y={0} width={Math.max(0, kneeX2 - kneeX1)} height={CANVAS_H} fill="var(--accent)" opacity={0.07} /> : null}
                        <line x1={threshX} y1={0} x2={threshX} y2={CANVAS_H} stroke="var(--accent)" strokeWidth={1} opacity={0.5} strokeDasharray="4,3" />
                        <text x={threshX + 3} y={10} fill="var(--accent)" fontSize={9} opacity={0.85}>{`${config.threshold}dB`}</text>
                        <path d={transferPath} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.9} />
                        <line x1={signalX} y1={0} x2={signalX} y2={CANVAS_H} stroke="#ffffff" strokeWidth={1} opacity={0.2} />
                        <circle cx={signalX} cy={signalY} r={4} fill="#ffffff" opacity={0.85} />
                        <circle cx={signalX} cy={signalY} r={7} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.3} />
                    </svg>
                </div>
                <div className={styles.meter} title="Gain Reduction">
                    <div className={styles.meterBar} style={{ height: `${Math.min(CANVAS_H, Math.abs(reduction) * (CANVAS_H / 60))}px` }} />
                    <span className={styles.meterLabel}>{`${reduction.toFixed(1)} dB`}</span>
                    <span className={styles.meterTitle}>GR</span>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <NumberField label="audio.threshold" value={config.threshold} min={-100} max={0} step={1} maxDecimals={0} showSlider sliderValues={{ min: -60, max: 0, step: 1 }} onChange={(value) => handleChange("threshold", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.ratio" value={config.ratio} min={1} max={20} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: 1, max: 20, step: 0.5 }} onChange={(value) => handleChange("ratio", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.knee" value={config.knee} min={0} max={40} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 40, step: 1 }} onChange={(value) => handleChange("knee", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.attack" value={Math.round(config.attack * 1000)} min={0} max={1000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 500, step: 1 }} onChange={(value) => handleChange("attack", (value ?? 0) / 1000)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.release" value={Math.round(config.release * 1000)} min={1} max={1000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 1000, step: 1 }} onChange={(value) => handleChange("release", (value ?? 0) / 1000)} />
            </InputRow>
        </div>
    )
}
