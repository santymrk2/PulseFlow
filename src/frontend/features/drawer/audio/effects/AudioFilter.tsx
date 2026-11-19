import { useEffect, useRef, useState, type CSSProperties } from "react"
import { subscribeEffect } from "../../../../shared/audio/effects/audioEffectsHelpers"
import { GAIN_FILTER_TYPES, type FilterConfig, type FilterType, updateFilterConfig } from "../../../../shared/audio/effects/audioFilter"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import { SelectField } from "../../../../shared/ui/kit/select-field/SelectField"
import type { AudioEffectProps } from "./AudioDelay"
import { useElementWidth } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioFilter.svelte.
const DEFAULT_CONFIG: FilterConfig = { enabled: false, type: "lowpass", frequency: 1000, q: 1.0, gain: 0 }
const CANVAS_H = 100
const F_MIN = 20
const F_MAX = 20000
const DB_MIN = -24
const DB_MAX = 24
const ACCENT = { "--accent": "#ad8652" } as CSSProperties

const FILTER_TYPE_OPTIONS = [
    { label: "Low Pass", value: "lowpass" },
    { label: "High Pass", value: "highpass" },
    { label: "Band Pass", value: "bandpass" },
    { label: "Notch", value: "notch" },
    { label: "Peaking", value: "peaking" },
    { label: "Low Shelf", value: "lowshelf" },
    { label: "High Shelf", value: "highshelf" }
]

function freqToX(frequency: number, width: number): number {
    const safeF = Math.max(F_MIN, Math.min(F_MAX, frequency || F_MIN))
    return (Math.log10(safeF / F_MIN) / Math.log10(F_MAX / F_MIN)) * (width || 300)
}

function dbToY(db: number): number {
    const safeDb = isNaN(db) ? 0 : Math.max(DB_MIN, Math.min(DB_MAX, db))
    return CANVAS_H - ((safeDb - DB_MIN) / (DB_MAX - DB_MIN)) * CANVAS_H
}

function buildResponsePath(type: FilterType, frequency: number, q: number, gain: number, width: number): string {
    try {
        const ac = new OfflineAudioContext(1, 128, 48000)
        const node = ac.createBiquadFilter()
        node.type = type || "lowpass"
        node.frequency.value = Math.max(20, Math.min(20000, frequency || 1000))
        node.Q.value = Math.max(0.0001, q || 1.0)
        node.gain.value = isNaN(gain) ? 0 : gain

        const count = 200
        const freqs = new Float32Array(count)
        for (let i = 0; i < count; i++) freqs[i] = F_MIN * Math.pow(F_MAX / F_MIN, i / (count - 1))
        const magResp = new Float32Array(count)
        const phaseResp = new Float32Array(count)
        node.getFrequencyResponse(freqs, magResp, phaseResp)

        const path = Array.from(magResp)
            .map((mag, i) => {
                const safeMag = isNaN(mag) || mag <= 0 ? 0.00001 : mag
                const x = (i / (count - 1)) * width
                const y = dbToY(20 * Math.log10(safeMag))
                return isNaN(x) || isNaN(y) ? null : `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`
            })
            .filter(Boolean)
            .join(" ")

        return path || `M 0,${CANVAS_H / 2} L ${width},${CANVAS_H / 2}`
    } catch {
        return `M 0,${CANVAS_H / 2} L ${width},${CANVAS_H / 2}`
    }
}

export function AudioFilter({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<FilterConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 300)

    useEffect(() => subscribeEffect<FilterConfig>("filter", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const responsePath = buildResponsePath(config.type, config.frequency, config.q, config.gain, canvasW)
    const freqX = freqToX(config.frequency, canvasW)
    const zeroY = dbToY(0)
    const freqDisplay = config.frequency >= 1000 ? `${(config.frequency / 1000).toFixed(1)}kHz` : `${Math.round(config.frequency)}Hz`

    function handleChange(key: keyof FilterConfig, raw: number) {
        updateFilterConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrap}>
                <div ref={wrapRef} className={styles.svgWrap}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        {[-24, -12, 0, 12, 24].map((db) => (
                            <g key={db}>
                                <line x1={0} y1={dbToY(db)} x2={canvasW} y2={dbToY(db)} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.2} />
                                <text x={3} y={dbToY(db) - 2} fill="var(--text)" fontSize={8} opacity={0.4}>{`${db}dB`}</text>
                            </g>
                        ))}
                        {[100, 1000, 10000].map((freq) => (
                            <g key={freq}>
                                <line x1={freqToX(freq, canvasW)} y1={0} x2={freqToX(freq, canvasW)} y2={CANVAS_H} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.2} />
                                <text x={freqToX(freq, canvasW) + 2} y={CANVAS_H - 3} fill="var(--text)" fontSize={8} opacity={0.35}>
                                    {freq >= 1000 ? `${freq / 1000}k` : freq}
                                </text>
                            </g>
                        ))}
                        <line x1={0} y1={zeroY} x2={canvasW} y2={zeroY} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.4} strokeDasharray="4,4" />
                        <path d={responsePath} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.9} />
                        <line x1={freqX} y1={0} x2={freqX} y2={CANVAS_H} stroke="var(--accent)" strokeWidth={1} opacity={0.5} strokeDasharray="3,3" />
                        <text x={freqX + 3} y={12} fill="var(--accent)" fontSize={9} opacity={0.9}>
                            {freqDisplay}
                        </text>
                    </svg>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <SelectField label="audio.filter_type" value={config.type} options={FILTER_TYPE_OPTIONS} onChange={(value) => updateFilterConfig({ type: value as FilterType }, channelId, effectId)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.frequency" value={config.frequency} min={20} max={20000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 20, max: 20000, step: 1 }} onChange={(value) => handleChange("frequency", value ?? 0)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.q_factor" value={config.q} min={0.1} max={30} step={0.1} maxDecimals={1} showSlider sliderValues={{ min: 0.1, max: 30, step: 0.1 }} onChange={(value) => handleChange("q", value ?? 0)} />
            </InputRow>
            {GAIN_FILTER_TYPES.includes(config.type) ? (
                <InputRow>
                    <NumberField label="audio.gain" value={config.gain} min={-24} max={24} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: -24, max: 24, step: 0.5 }} onChange={(value) => handleChange("gain", value ?? 0)} />
                </InputRow>
            ) : null}
        </div>
    )
}
