import { useEffect, useRef, useState, type CSSProperties } from "react"
import { type DelayConfig, updateDelayConfig } from "../../../../audio/effects/audioDelay"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { InputRow } from "../../../../shared/ui/kit/input-row/InputRow"
import { NumberField } from "../../../../shared/ui/kit/number-field/NumberField"
import { useElementWidth } from "./hooks"
import styles from "./Visualization.module.css"

// Port de components/drawer/audio/effects/AudioDelay.svelte.
export interface AudioEffectProps {
    effectId?: string
    channelId?: string
}

const DEFAULT_CONFIG: DelayConfig = { enabled: false, delayTime: 0.5, feedback: 0.3, wet: 0.3 }
const CANVAS_H = 100
const MAX_ECHOES = 8
const WINDOW_SEC = 2
const ACCENT = { "--accent": "#adad52" } as CSSProperties

interface EchoBar {
    x: number
    h: number
    opacity: number
}

function buildEchoBars(delayTime: number, feedback: number, wet: number, width: number): EchoBar[] {
    const bars: EchoBar[] = [{ x: 0, h: (CANVAS_H - 8) * 0.9, opacity: 1 - wet * 0.2 }]
    let amp = wet
    for (let i = 1; i <= MAX_ECHOES; i++) {
        const time = delayTime * i
        if (time > WINDOW_SEC) break
        bars.push({ x: (time / WINDOW_SEC) * width, h: (CANVAS_H - 8) * Math.min(1, amp), opacity: 0.85 })
        amp *= feedback
        if (amp < 0.01) break
    }
    return bars
}

export function AudioDelay({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [config, setConfig] = useState<DelayConfig>(DEFAULT_CONFIG)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasW = useElementWidth(wrapRef, 200)

    useEffect(() => subscribeEffect<DelayConfig>("delay", (next) => setConfig({ ...next }), channelId, effectId), [channelId, effectId])

    const echoBars = buildEchoBars(config.delayTime, config.feedback, config.wet, canvasW)

    function handleChange(key: keyof DelayConfig, raw: number) {
        updateDelayConfig({ [key]: raw }, channelId, effectId)
    }

    return (
        <div className={styles.container} style={ACCENT}>
            <div className={styles.vizWrap}>
                <div ref={wrapRef} className={styles.svgWrap}>
                    <svg width={canvasW} height={CANVAS_H} className={styles.svg}>
                        {[0, 0.5, 1, 1.5, 2].map((sec) => (
                            <g key={sec}>
                                <line x1={(sec / 2) * canvasW} y1={0} x2={(sec / 2) * canvasW} y2={CANVAS_H} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.2} />
                                <text x={(sec / 2) * canvasW + 2} y={CANVAS_H - 3} fill="var(--text)" fontSize={8} opacity={0.35}>{`${sec}s`}</text>
                            </g>
                        ))}
                        {echoBars.map((bar, i) => (
                            <rect key={i} x={bar.x - 3} y={CANVAS_H - bar.h - 4} width={6} height={bar.h} fill="var(--accent)" opacity={bar.opacity * (i === 0 ? 0.9 : 0.7)} rx={2} />
                        ))}
                        <text x={4} y={12} fill="var(--text)" fontSize={8} opacity={0.4}>
                            Echo
                        </text>
                        <text x={canvasW - 4} y={12} fill="var(--accent)" fontSize={9} textAnchor="end" opacity={0.85}>{`${Math.round(config.delayTime * 1000)}ms`}</text>
                    </svg>
                </div>
            </div>

            <div style={{ height: 8 }} />

            <InputRow>
                <NumberField label="audio.delay" value={Math.round(config.delayTime * 1000)} min={10} max={2000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 10, max: 2000, step: 1 }} onChange={(value) => handleChange("delayTime", (value ?? 0) / 1000)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.feedback" value={Math.round(config.feedback * 100)} min={0} max={95} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 95, step: 1 }} onChange={(value) => handleChange("feedback", (value ?? 0) / 100)} />
            </InputRow>
            <InputRow>
                <NumberField label="audio.wet" value={Math.round(config.wet * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} onChange={(value) => handleChange("wet", (value ?? 0) / 100)} />
            </InputRow>
        </div>
    )
}
