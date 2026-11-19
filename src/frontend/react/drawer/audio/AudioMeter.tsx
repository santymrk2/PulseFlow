import { useEffect, useRef, useState, type MouseEvent } from "react"
import { dbToLinear, MIN_DB } from "../../../audio/dBUtils"
import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
import { activeDrawerTab, activePage, audioChannelsData, audioRouting, drawer } from "../../../shared/core/stores"
import { DEFAULT_DRAWER_HEIGHT } from "../../../shared/utils/common"
import { useStore } from "../../hooks/useStore"
import { AudioSidechain } from "./effects/AudioSidechain"
import styles from "./AudioMeter.module.css"

// Port de components/drawer/audio/AudioMeter.svelte. Actualiza el DOM directamente (~30 fps) para no re-renderizar React.
export interface AudioMeterProps {
    channelId?: string
    detailed?: boolean
    preview?: boolean
}

const NUMBERS = [-60, -54, -48, -42, -36, -30, -24, -18, -12, -6, 0]
const MIN_DB_VALUE = MIN_DB
const MAX_DB_VALUE = 0

export function AudioMeter({ channelId = "", detailed = false, preview = false }: AudioMeterProps) {
    const channelsData = useStore(audioChannelsData)
    const routing = useStore(audioRouting)
    const drawerValue = useStore(drawer)

    const isMuted = !!channelsData[channelId]?.isMuted
    const hasSidechainConnection = !!routing?.connections.some((c) => c.to === channelId && c.type === "sidechain")
    const vertical = preview

    const [channelIndices, setChannelIndices] = useState<number[]>([0, 1])
    const maskEls = useRef<(HTMLDivElement | null)[]>([])
    const peakEls = useRef<(HTMLDivElement | null)[]>([])
    const dotEls = useRef<(HTMLElement | null)[]>([])
    const smoothedDB = useRef<number[]>([])
    const highestDB = useRef<{ lastTime: number; value: number }[]>([])
    const latest = useRef({ channelId, isMuted, vertical, detailed })
    latest.current = { channelId, isMuted, vertical, detailed }

    function getChannelDbs(): number[] {
        const current = latest.current
        const captured = AudioInputCapture.getInstance().getVisualizerData(current.channelId)
        if (captured && captured.channels?.length) return captured.channels.map((c) => c.db)
        if (captured && typeof captured.db === "number") return [captured.db]

        const data = channelsData[current.channelId]
        if (data && typeof data.dB === "number") return [data.dB, data.dB]
        return [MIN_DB, MIN_DB]
    }

    function updateMeterChannel(rawDb: number, channelIndex: number) {
        if (typeof channelIndex !== "number" || isNaN(channelIndex) || channelIndex < 0) return { dbValue: 0, highestDb: 100 }

        let db = rawDb
        if (latest.current.isMuted) db = MIN_DB

        const target = dbToLinear(db)
        const prevSmoothed = smoothedDB.current[channelIndex] ?? 0
        const newSmoothed = target > prevSmoothed ? target : prevSmoothed + (target - prevSmoothed) * 0.2
        smoothedDB.current[channelIndex] = newSmoothed

        const dBPercentage = newSmoothed * 100
        const now = Date.now()

        let highest = highestDB.current[channelIndex]
        if (!highest) {
            highest = { lastTime: 0, value: 0 }
            highestDB.current[channelIndex] = highest
        }

        if (dBPercentage >= highest.value) {
            highest.value = dBPercentage
            highest.lastTime = now
        } else if (now - highest.lastTime > 2000) {
            highest.value = Math.max(dBPercentage, highest.value - 2)
        }

        return { dbValue: dBPercentage, highestDb: 100 - highest.value }
    }

    function updateDOM() {
        const rawDbs = getChannelDbs()
        const { vertical: isVertical } = latest.current

        if (rawDbs.length !== channelIndices.length) setChannelIndices(Array.from({ length: Math.max(1, rawDbs.length) }, (_, i) => i))

        for (let i = 0; i < rawDbs.length; i++) {
            const { dbValue, highestDb } = updateMeterChannel(rawDbs[i], i)

            const maskEl = maskEls.current[i]
            if (maskEl) {
                const maskPct = 100 - dbValue
                if (isVertical) maskEl.style.height = `${maskPct}%`
                else maskEl.style.width = `${maskPct}%`
            }

            const peakEl = peakEls.current[i]
            if (peakEl) {
                if (highestDb < 100) {
                    peakEl.style.display = "block"
                    if (isVertical) peakEl.style.top = `${highestDb}%`
                    else peakEl.style.right = `${highestDb}%`
                } else {
                    peakEl.style.display = "none"
                }
            }

            const dotEl = dotEls.current[i]
            if (dotEl) {
                if (rawDbs[i] > MIN_DB) dotEl.classList.add("active")
                else dotEl.classList.remove("active")
            }
        }
    }

    useEffect(() => {
        let animationFrame = 0
        let lastTickTime = 0
        function loop(timestamp: number) {
            animationFrame = requestAnimationFrame(loop)
            if (timestamp - lastTickTime < 33) return
            lastTickTime = timestamp
            updateDOM()
        }
        animationFrame = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animationFrame)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function getPercentageFromDB(dB: number) {
        return dbToLinear(dB) * 100
    }

    function openAudioMix() {
        if (!preview) return
        activePage.set("show")
        activeDrawerTab.set("audio")
        if (drawerValue.height <= 40) drawer.set({ height: drawerValue.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    function handleClick(_event: MouseEvent<HTMLDivElement>) {
        openAudioMix()
    }

    return (
        <div className={`${styles.background} ${preview ? styles.preview : ""} ${vertical ? styles.vertical : ""}`} onClick={handleClick} role="none">
            <div className={`${styles.main} ${vertical ? styles.vertical : ""}`}>
                {channelIndices.map((i) => (
                    <div key={i} style={{ display: "contents" }}>
                        {i > 0 && !preview ? <div style={{ height: 1, width: "100%" }} /> : null}
                        <div className={`${styles.channelRow} ${vertical ? styles.vertical : ""}`}>
                            {!vertical ? (
                                <span
                                    ref={(el) => {
                                        dotEls.current[i] = el
                                    }}
                                    className={styles.signalDot}
                                    style={{ height: latest.current.detailed ? 6 : 3 }}
                                />
                            ) : null}

                            <span className={`${styles.meter} ${isMuted ? styles.isMuted : ""} ${vertical ? styles.vertical : ""}`} style={!vertical ? { height: latest.current.detailed ? 6 : 3 } : undefined}>
                                <div
                                    ref={(el) => {
                                        maskEls.current[i] = el
                                    }}
                                    style={vertical ? { width: "100%", top: 0, position: "absolute" } : { height: "inherit", right: 0, position: "absolute" }}
                                />
                                <span className={`${styles.meter} ${isMuted ? styles.isMuted : ""} ${vertical ? styles.vertical : ""}`} style={{ position: "absolute", opacity: 0.08, ...(vertical ? { top: 0, width: "100%", height: "100%" } : { right: 0, height: "inherit", width: "100%" }) }} />
                                <div
                                    ref={(el) => {
                                        peakEls.current[i] = el
                                    }}
                                    className={`${styles.highest} ${vertical ? styles.vertical : ""}`}
                                    style={{ display: "none" }}
                                />
                            </span>

                            {vertical ? (
                                <span
                                    ref={(el) => {
                                        dotEls.current[i] = el
                                    }}
                                    className={`${styles.signalDot} ${styles.vertical}`}
                                />
                            ) : null}
                        </div>
                    </div>
                ))}

                {!preview && hasSidechainConnection ? (
                    <>
                        <div style={{ height: 2, width: "100%" }} />
                        <AudioSidechain channelId={channelId} />
                    </>
                ) : null}

                {detailed ? (
                    <div className={styles.linesContainer}>
                        <div className={styles.lines} style={{ padding: "3px 0" }}>
                            {Array.from({ length: MAX_DB_VALUE - MIN_DB_VALUE + 1 }, (_, i) => {
                                const dB = MIN_DB_VALUE + i
                                const kind = NUMBERS.includes(dB) ? styles.major : dB % 2 === 0 ? styles.sub : styles.micro
                                return <span key={dB} className={`${styles.line} ${kind}`} style={{ left: `${getPercentageFromDB(dB)}%` }} />
                            })}
                        </div>

                        <div className={styles.lines} style={{ padding: "4px 0" }}>
                            <p className={styles.absolute} style={{ position: "initial", opacity: 0 }}>
                                .
                            </p>
                            {NUMBERS.map((dB) => (
                                <p key={dB} className={`${styles.absolute} ${dB === NUMBERS[NUMBERS.length - 1] ? styles.end : ""}`} style={{ left: `${getPercentageFromDB(dB)}%` }}>
                                    {dB}
                                </p>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
