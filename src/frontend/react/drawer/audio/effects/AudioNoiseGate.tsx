import { useEffect, useRef, useState, type CSSProperties } from "react"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { type NoiseGateConfig, updateNoiseGateConfig } from "../../../../audio/effects/audioNoiseGate"
import { InputRow } from "../../../ui/input-row/InputRow"
import { NumberField } from "../../../ui/number-field/NumberField"
import type { AudioEffectProps } from "./AudioDelay"
import { useElementWidth, useLiveLevels } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioNoiseGate.svelte.
const DEFAULT_CONFIG: NoiseGateConfig = { enabled: false, threshold: -40, attack: 0.003, release: 0.1, hysteresis: 6 }
const CANVAS_H = 100
const DB_MIN = -80
const DB_MAX = 0
const ACCENT = { "--accent": "#52ad7a" } as CSSProperties

function dbToX(db: number, width: number): number {
    return ((db - DB_MIN) / (DB_MAX - DB_MIN)) * width
}

export function AudioNoiseGate({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<NoiseGateConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 200)
    const { inputLevelDb } = useLiveLevels(channelId, null, DB_MIN, DB_MAX)

    useEffect(() => subscribeEffect<NoiseGateConfig>("noiseGate", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const gateOpen = inputLevelDb > config.threshold
    const signalX = dbToX(inputLevelDb, canvasW)
    const threshX = dbToX(config.threshold, canvasW)
    const hystX = dbToX(config.threshold - config.hysteresis, canvasW)

    function handleChange(key: keyof NoiseGateConfig, raw: number) {
        updateNoiseGateConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrapFlex}>
                <div ref={wrapRef} className={styles.svgWrapFlex}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        <rect x={0} y={0} width={Math.max(0, hystX)} height={CANVAS_H} fill="#cc4444" opacity={0.08} />
                        <rect x={hystX} y={0} width={Math.max(0, threshX - hystX)} height={CANVAS_H} fill="var(--accent)" opacity={0.06} />
                        <rect x={threshX} y={0} width={Math.max(0, canvasW - threshX)} height={CANVAS_H} fill="var(--accent)" opacity={0.1} />
                        {[-80, -60, -40, -20, 0].map((db) => (
                            <g key={db}>
                                <line x1={dbToX(db, canvasW)} y1={0} x2={dbToX(db, canvasW)} y2={CANVAS_H} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.2} />
                                <text x={dbToX(db, canvasW) + 2} y={CANVAS_H - 3} fill="var(--text)" fontSize={8} opacity={0.4}>
                                    {db}
                                </text>
                            </g>
                        ))}
                        <line x1={hystX} y1={0} x2={hystX} y2={CANVAS_H} stroke="var(--accent)" strokeWidth={1} opacity={0.3} strokeDasharray="3,3" />
                        <line x1={threshX} y1={0} x2={threshX} y2={CANVAS_H} stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} strokeDasharray="4,3" />
                        <text x={threshX + 3} y={10} fill="var(--accent)" fontSize={9} opacity={0.9}>{`${config.threshold}dB`}</text>
                        <line x1={signalX} y1={0} x2={signalX} y2={CANVAS_H} stroke="#ffffff" strokeWidth={1} opacity={0.2} />
                        <circle cx={signalX} cy={CANVAS_H / 2} r={4} fill={gateOpen ? "var(--accent)" : "#cc4444"} opacity={0.9} />
                        <circle cx={signalX} cy={CANVAS_H / 2} r={7} fill="none" stroke={gateOpen ? "var(--accent)" : "#cc4444"} strokeWidth={1} opacity={0.35} />
                    </svg>
                </div>
                <div className={`${styles.status} ${gateOpen ? styles.statusOpen : ""}`}>
                    <span>{gateOpen ? "OPEN" : "CLOSED"}</span>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <NumberField label="audio.threshold" value={config.threshold} min={-100} max={0} step={1} maxDecimals={0} showSlider sliderValues={{ min: -80, max: 0, step: 1 }} onChange={(value) => handleChange("threshold", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.hysteresis" value={config.hysteresis} min={0} max={24} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 24, step: 1 }} onChange={(value) => handleChange("hysteresis", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.attack" value={Math.round(config.attack * 1000)} min={0} max={500} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 200, step: 1 }} onChange={(value) => handleChange("attack", (value ?? 0) / 1000)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.release" value={Math.round(config.release * 1000)} min={1} max={2000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 1000, step: 1 }} onChange={(value) => handleChange("release", (value ?? 0) / 1000)} />
            </InputRow>
        </div>
    )
}
