import type { CSSProperties } from "react"
import { metronome, metronomeTimer } from "../../../shared/core/stores"
import { useStore } from "../../../shared/ui/hooks/useStore"
import styles from "./MetronomeVisualizer.module.css"

// Port de components/drawer/audio/MetronomeVisualizer.svelte.
export interface MetronomeVisualizerProps {
    isItem?: boolean
}

const PRE_SCHEDULE_TIME = 0.1

export function MetronomeVisualizer({ isItem = false }: MetronomeVisualizerProps) {
    const data = useStore(metronome)
    const timer = useStore(metronomeTimer)

    const beat = timer.beat || 0
    const beats = data?.beats || 4
    const beatsPerSecond = 60 / (data?.tempo || 120)
    const timeUntilNext = timer.timeToNext || 0
    const nextTime = timeUntilNext + beatsPerSecond - PRE_SCHEDULE_TIME

    const indicatorStyle = { transitionDuration: `${nextTime}s`, transform: `translateX(${beat % 2 === 1 ? -50 : 50}%)` } as CSSProperties

    return (
        <section className={isItem ? styles.isItem : undefined}>
            <div className={styles.beats}>
                {Array.from({ length: beats }, (_, currentBeat) => (
                    <div key={currentBeat} className={`${styles.bar} ${beat === currentBeat + 1 ? styles.active : ""}`}>
                        {currentBeat + 1}
                    </div>
                ))}
            </div>

            <div className={styles.overflow}>
                <div className={styles.bar} style={{ marginTop: 5 }}>
                    <div className={styles.indicator} style={indicatorStyle}>
                        <div className={`${styles.dot} ${beat === 1 ? styles.big : ""}`} />
                    </div>
                </div>
            </div>
        </section>
    )
}
