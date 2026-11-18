import styles from "./AnalogClock.module.css"

export interface AnalogClockProps {
    date: globalThis.Date
    h: number
    m: number
    s: number
    seconds?: boolean
}

// El tweened(1000ms, linear) de Svelte se replica con una transición CSS
// sobre el ángulo de la aguja de segundos.
export function AnalogClock({ date, h, m, s, seconds = true }: AnalogClockProps) {
    const start = date.getTime() / 1000 - ((date.getTime() / 1000) % 60)
    const sweep = Math.trunc(date.getTime() / 1000 - start)

    return (
        <svg viewBox="-50 -50 100 100">
            <circle className={styles.clockFace} r="48" />

            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => (
                <g key={minute}>
                    <line className={styles.major} y1="36" y2="45" transform={`rotate(${30 * minute})`} />
                    {[1, 2, 3, 4].map((offset) => (
                        <line key={offset} className={styles.minor} y1="42" y2="45" transform={`rotate(${6 * (minute + offset)})`} />
                    ))}
                </g>
            ))}

            <line className={styles.hour} y1="6" y2="-28" transform={`rotate(${30 * h + m / 2})`} />
            <line className={styles.minute} y1="6" y2="-42" transform={`rotate(${6 * m + s / 10})`} />

            {seconds ? (
                <g className={styles.secondSweep} transform={`rotate(${6 * sweep + 1})`}>
                    <line className={styles.second} y1="10" y2="-36" />
                </g>
            ) : null}

            <circle className={styles.fulcrum} r="1.25" />
        </svg>
    )
}
