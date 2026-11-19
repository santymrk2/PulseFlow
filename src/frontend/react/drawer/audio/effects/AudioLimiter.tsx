import { useEffect, useRef, useState, type CSSProperties } from "react"
import { MAX_DB, MIN_DB } from "../../../../audio/dBUtils"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { getLimiterReduction, type LimiterConfig, updateLimiterConfig } from "../../../../audio/effects/audioLimiter"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import type { AudioEffectProps } from "./AudioDelay"
import { useElementWidth, useLiveLevels } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioLimiter.svelte.
const DEFAULT_CONFIG: LimiterConfig = { enabled: false, ceiling: -3, release: 0.05 }
const CANVAS_H = 200
const RATIO = 20
const ACCENT = { "--accent": "#5284ad" } as CSSProperties

function dbToX(db: number, w: number): number {
    return ((db - MIN_DB) / (MAX_DB - MIN_DB)) * w
}

function dbToY(db: number): number {
    return CANVAS_H - ((db - MIN_DB) / (MAX_DB - MIN_DB)) * CANVAS_H
}

function transferOutput(inputDb: number, ceiling: number): number {
    return inputDb <= ceiling ? inputDb : ceiling + (inputDb - ceiling) / RATIO
}

function buildTransferPath(ceiling: number, width: number): string {
    const steps = 120
    const points: string[] = []
    for (let i = 0; i <= steps; i++) {
        const inputDb = MIN_DB + (i / steps) * (MAX_DB - MIN_DB)
        points.push(`${i === 0 ? "M" : "L"} ${dbToX(inputDb, width)},${dbToY(Math.max(MIN_DB, Math.min(MAX_DB, transferOutput(inputDb, ceiling))))}`)
    }
    return points.join(" ")
}

export function AudioLimiter({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<LimiterConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 200)
    const { inputLevelDb, reduction } = useLiveLevels(channelId, getLimiterReduction)

    useEffect(() => subscribeEffect<LimiterConfig>("limiter", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const transferPath = buildTransferPath(config.ceiling, canvasW)
    const ceilX = dbToX(config.ceiling, canvasW)
    const signalX = dbToX(inputLevelDb, canvasW)
    const signalY = dbToY(Math.max(MIN_DB, Math.min(MAX_DB, transferOutput(inputLevelDb, config.ceiling))))

    function handleChange(key: keyof LimiterConfig, raw: number) {
        updateLimiterConfig({ [key]: raw }, channelId, effectId)
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
                        <rect x={ceilX} y={0} width={Math.max(0, canvasW - ceilX)} height={CANVAS_H} fill="var(--accent)" opacity={0.08} />
                        <line x1={ceilX} y1={0} x2={ceilX} y2={CANVAS_H} stroke="var(--accent)" strokeWidth={1} opacity={0.6} strokeDasharray="4,3" />
                        <text x={ceilX + 3} y={10} fill="var(--accent)" fontSize={9} opacity={0.9}>{`${config.ceiling}dB`}</text>
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
                <NumberField label="audio.ceiling" value={config.ceiling} min={-30} max={0} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: -30, max: 0, step: 0.5 }} onChange={(value) => handleChange("ceiling", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.release" value={Math.round(config.release * 1000)} min={1} max={500} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 500, step: 1 }} onChange={(value) => handleChange("release", (value ?? 0) / 1000)} />
            </InputRow>
        </div>
    )
}
