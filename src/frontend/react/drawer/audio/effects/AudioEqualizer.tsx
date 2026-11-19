import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react"
import { AudioEqualizer as AudioEqualizerEngine, type EQBand, EqualizerCalculations, updateEqualizerBands } from "../../../../audio/effects/audioEqualizer"
import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
import { SpectrumAnalyzer } from "../../../../audio/spectrumAnalyzer"
import { clone } from "../../../../shared/utils/helpers/array"
import type { AudioEffectProps } from "./AudioDelay"
import styles from "./AudioEqualizer.module.css"

// Port de components/drawer/audio/effects/AudioEqualizer.svelte.
const MIN_GAIN = -24
const MAX_GAIN = 24
const CANVAS_H = 200
const MIN_FREQ = 20
const MAX_FREQ = 20000
const ACCENT = { "--accent": "#5295ad" } as CSSProperties
const ORIGINAL_BANDS = AudioEqualizerEngine.getDefaultBands()

const BAND_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]

function freqToX(frequency: number, width: number): number {
    return ((Math.log10(frequency) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ))) * width
}

function xToFreq(x: number, width: number): number {
    return Math.pow(10, Math.log10(MIN_FREQ) + (x / width) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)))
}

function gainToY(gain: number): number {
    return CANVAS_H - ((gain - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)) * CANVAS_H
}

function formatFrequency(freq: number): string {
    return freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${freq}`
}

function calculateBandResponsePath(band: EQBand, width: number): string {
    if (!band.gain) return ""

    let minWaveFreq: number
    let maxWaveFreq: number
    if (band.type === "peaking") {
        const octaveRange = Math.max(2, 6 / (band.q ?? 1))
        minWaveFreq = Math.max(MIN_FREQ, band.frequency / Math.pow(2, octaveRange))
        maxWaveFreq = Math.min(MAX_FREQ, band.frequency * Math.pow(2, octaveRange))
    } else {
        minWaveFreq = MIN_FREQ
        maxWaveFreq = MAX_FREQ
    }

    const minWaveX = freqToX(minWaveFreq, width)
    const maxWaveX = freqToX(maxWaveFreq, width)
    const zeroY = gainToY(0)
    const points = [`M ${minWaveX},${zeroY}`]
    for (let i = 0; i <= 100; i++) {
        const x = minWaveX + (i / 100) * (maxWaveX - minWaveX)
        const y = gainToY(EqualizerCalculations.calculateBandResponse(band, xToFreq(x, width)))
        points.push(`L ${x},${y}`)
    }
    points.push(`L ${maxWaveX},${zeroY}`, "Z")
    return points.join(" ")
}

function calculateFrequencyResponsePath(bands: EQBand[], width: number): string {
    const points: string[] = []
    for (let i = 0; i <= 300; i++) {
        const x = (i / 300) * width
        const y = gainToY(EqualizerCalculations.calculateCombinedResponse(bands, xToFreq(x, width)))
        points.push(`${i === 0 ? "M" : "L"} ${x},${y}`)
    }
    return points.join(" ")
}

export function AudioEqualizer({ effectId = "", channelId = "" }: AudioEffectProps) {
    const [bands, setBands] = useState<EQBand[]>(() => clone(ORIGINAL_BANDS))
    const [canvasWidth, setCanvasWidth] = useState(400)
    const [isDragging, setIsDragging] = useState(false)
    const [draggedBandIndex, setDraggedBandIndex] = useState<number | null>(null)
    const [isHovering, setIsHovering] = useState(false)
    const [hoverX, setHoverX] = useState(0)
    const [hoverFrequency, setHoverFrequency] = useState(0)

    const containerRef = useRef<HTMLDivElement>(null)
    const visualRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const bandsRef = useRef(bands)
    const analyzerRef = useRef<SpectrumAnalyzer | null>(null)

    useEffect(() => {
        bandsRef.current = bands
    }, [bands])

    useEffect(() => {
        return subscribeEffect<{ bands?: EQBand[] }>(
            "equalizer",
            (config) => {
                if (!config) return
                const next = config.bands?.length ? clone(config.bands) : clone(ORIGINAL_BANDS)
                bandsRef.current = next
                setBands(next)
            },
            channelId,
            effectId
        )
    }, [channelId, effectId])

    // Ancho dinámico: contenedor, padre y fallback al drawer derecho (igual que el componente Svelte).
    useEffect(() => {
        const measure = () => {
            const container = containerRef.current
            if (container) {
                const rect = container.getBoundingClientRect()
                const parentWidth = container.parentElement?.clientWidth || rect.width
                const next = Math.max(100, Math.floor(Math.max(rect.width, parentWidth) - 16))
                if (next > 100) setCanvasWidth(next)
            } else {
                const drawer = document.querySelector("#rightPanelDrawer")
                if (drawer) setCanvasWidth(Math.max(100, drawer.getBoundingClientRect().width - 20))
            }
        }
        measure()

        const targets: Element[] = []
        if (containerRef.current) {
            targets.push(containerRef.current)
            if (containerRef.current.parentElement) targets.push(containerRef.current.parentElement)
        } else {
            const drawer = document.querySelector("#rightPanelDrawer")
            if (drawer) targets.push(drawer)
        }
        const observer = typeof ResizeObserver !== "undefined" && targets.length ? new ResizeObserver(measure) : null
        if (observer) targets.forEach((target) => observer.observe(target))
        window.addEventListener("resize", measure)

        return () => {
            observer?.disconnect()
            window.removeEventListener("resize", measure)
        }
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        if (!analyzerRef.current) {
            const analyzer = new SpectrumAnalyzer(channelId)
            analyzer.start(canvas)
            analyzerRef.current = analyzer
        } else {
            analyzerRef.current.setChannel(channelId)
        }
    }, [channelId])

    useEffect(
        () => () => {
            analyzerRef.current?.dispose()
            analyzerRef.current = null
        },
        []
    )

    function updateBands(next: EQBand[]) {
        bandsRef.current = next
        setBands(next)
        updateEqualizerBands(next, channelId, effectId)
    }

    function handleBandReset(index: number) {
        const next = clone(bandsRef.current)
        next[index] = { ...ORIGINAL_BANDS[index] }
        updateBands(next)
    }

    function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>, index: number) {
        if (event.button === 1) {
            event.preventDefault()
            handleBandReset(index)
            return
        }
        if (event.button !== 0) return
        setDraggedBandIndex(index)
        setIsDragging(true)
        event.preventDefault()
    }

    // Listeners globales mientras se arrastra, como en el original (con cleanup garantizado).
    useEffect(() => {
        if (!isDragging || draggedBandIndex === null) return

        const handleMove = (event: MouseEvent) => {
            const visual = visualRef.current
            if (!visual) return
            const rect = visual.getBoundingClientRect()
            const y = event.clientY - rect.top
            const gainPercentage = Math.max(0, Math.min(1, (CANVAS_H - y) / CANVAS_H))
            const newGain = MIN_GAIN + gainPercentage * (MAX_GAIN - MIN_GAIN)
            const x = Math.max(0, Math.min(canvasWidth, event.clientX - rect.left))
            const newFreq = xToFreq(x, canvasWidth)

            const next = clone(bandsRef.current)
            const band = next[draggedBandIndex]
            if (!band) return
            band.gain = Math.round(newGain * 10) / 10
            const boundedFreq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, newFreq))
            band.frequency = Math.round(boundedFreq)
            band.label = `${formatFrequency(band.frequency)}Hz`
            updateBands(next)
        }
        const handleUp = () => {
            setIsDragging(false)
            setDraggedBandIndex(null)
        }

        document.addEventListener("mousemove", handleMove)
        document.addEventListener("mouseup", handleUp)
        return () => {
            document.removeEventListener("mousemove", handleMove)
            document.removeEventListener("mouseup", handleUp)
        }
    }, [isDragging, draggedBandIndex, canvasWidth, channelId, effectId])

    // Wheel no pasivo sobre los handles, para poder prevenir el scroll como en Svelte.
    useEffect(() => {
        const visual = visualRef.current
        if (!visual) return
        const handleWheel = (event: WheelEvent) => {
            const target = (event.target as HTMLElement).closest("[data-band-index]")
            if (!target) return
            event.preventDefault()

            const raw = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * CANVAS_H : event.deltaY
            const step = Math.sign(raw) * Math.max(0.01, Math.min(0.5, Math.abs(raw) * 0.02))
            const index = Number(target.getAttribute("data-band-index"))
            const next = clone(bandsRef.current)
            const band = next[index]
            if (!band) return
            band.q = Math.max(0.1, Math.min(30, +((band.q ?? 1) + step).toFixed(2)))
            updateBands(next)
        }
        visual.addEventListener("wheel", handleWheel, { passive: false })
        return () => visual.removeEventListener("wheel", handleWheel)
    }, [channelId, effectId])

    function handleHover(event: ReactMouseEvent<HTMLDivElement>) {
        if (!isHovering || isDragging || !visualRef.current) return
        const rect = visualRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(canvasWidth, event.clientX - rect.left))
        setHoverX(x)
        setHoverFrequency(xToFreq(x, canvasWidth))
    }

    const draggedBand = draggedBandIndex !== null ? bands[draggedBandIndex] : undefined

    return (
        <div ref={containerRef} className={styles.container} style={ACCENT}>
            <div ref={visualRef} className={styles.visual} style={{ height: CANVAS_H }} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} onMouseMove={handleHover}>
                <canvas ref={canvasRef} className={styles.spectrumCanvas} width={canvasWidth} height={CANVAS_H} />

                <svg className={styles.grid} width={canvasWidth} height={CANVAS_H}>
                    {bands.map((band, index) => (
                        <line key={index} x1={freqToX(band.frequency, canvasWidth)} y1={0} x2={freqToX(band.frequency, canvasWidth)} y2={CANVAS_H} stroke={BAND_COLORS[index]} strokeWidth={1} opacity={0.2} strokeDasharray="4,4" />
                    ))}

                    {[24, 18, 12, 6, 0, -6, -12, -18, -24].map((db) => (
                        <g key={db}>
                            <line x1={0} y1={gainToY(db)} x2={canvasWidth} y2={gainToY(db)} stroke="var(--primary-lighter)" strokeWidth={db === 0 ? 2 : 1} opacity={db === 0 ? 0.8 : 0.3} />
                            <text x={5} y={gainToY(db) - 2} fill="var(--text)" fontSize={10} opacity={0.6}>{`${db > 0 ? "+" : ""}${db}dB`}</text>
                        </g>
                    ))}

                    {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((freq) => (
                        <g key={freq}>
                            <line x1={freqToX(freq, canvasWidth)} y1={0} x2={freqToX(freq, canvasWidth)} y2={CANVAS_H} stroke="var(--primary-lighter)" strokeWidth={1} opacity={0.2} />
                            <text x={freqToX(freq, canvasWidth) + 2} y={CANVAS_H - 5} fill="var(--text)" fontSize={9} opacity={0.5}>
                                {formatFrequency(freq)}
                            </text>
                        </g>
                    ))}

                    {bands.map((band, index) => (band.gain ? <path key={`wave_${index}`} d={calculateBandResponsePath(band, canvasWidth)} fill={BAND_COLORS[index]} fillOpacity={0.15} stroke={BAND_COLORS[index]} strokeWidth={1} opacity={0.4} /> : null))}

                    <path d={calculateFrequencyResponsePath(bands, canvasWidth)} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.9} />

                    {isHovering && !isDragging ? (
                        <g>
                            <line x1={hoverX} y1={0} x2={hoverX} y2={CANVAS_H} stroke="#FFFFFF" strokeWidth={1} opacity={0.1} strokeDasharray="8,5" />
                            <rect x={hoverX - 25} y={5} width={50} height={16} fill="var(--primary-darker)" stroke="#FFFFFF" strokeWidth={1} rx={3} opacity={0.6} />
                            <text x={hoverX} y={17} fill="#FFFFFF" fontSize={10} fontWeight="bold" textAnchor="middle">{`${formatFrequency(Math.round(hoverFrequency))}Hz`}</text>
                        </g>
                    ) : null}
                </svg>

                {bands.map((band, index) => (
                    <div key={`control_${index}`} className={styles.bandControl} style={{ left: `${freqToX(band.frequency, canvasWidth) - 15}px` }}>
                        <div className={styles.gainHandle} style={{ top: `${gainToY(band.gain) - 10}px` }} data-band-index={index} role="slider" tabIndex={0} aria-label={`Band ${index + 1} gain control`} aria-valuenow={band.gain} aria-valuemin={MIN_GAIN} aria-valuemax={MAX_GAIN} onMouseDown={(event) => handleMouseDown(event, index)}>
                            <div
                                className={styles.handleInner}
                                style={{
                                    backgroundColor: `${BAND_COLORS[index]}${draggedBandIndex === index ? "90" : "10"}`,
                                    color: BAND_COLORS[index],
                                    border: `2px solid ${BAND_COLORS[index]}90`
                                }}
                            >
                                {index + 1}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.bandInfo} style={{ minHeight: 18 }}>
                {draggedBand ? (
                    <>
                        <div>{`${formatFrequency(draggedBand.frequency)}Hz`}</div>
                        <div>{`${draggedBand.gain > 0 ? "+" : ""}${draggedBand.gain.toFixed(1)}dB`}</div>
                        <div>{`Q: ${(draggedBand.q ?? 1).toFixed(1)}`}</div>
                    </>
                ) : null}
            </div>
        </div>
    )
}
