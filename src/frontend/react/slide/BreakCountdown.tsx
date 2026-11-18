import { useEffect, useRef, useState } from "react"

export interface BreakCountdownProps {
    activeKey?: string
    breakDuration?: number
    ratio?: number
}

const RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Port de components/slide/BreakCountdown.svelte (F24.18b).
export function BreakCountdown({ activeKey = "", breakDuration = 0, ratio = 1 }: BreakCountdownProps) {
    const [remaining, setRemaining] = useState(0)
    const rafRef = useRef<number | null>(null)
    const prevKeyRef = useRef("")

    useEffect(() => {
        if (activeKey !== prevKeyRef.current) {
            prevKeyRef.current = activeKey
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
                setRemaining(0)
            }
            if (activeKey && breakDuration > 0) {
                const startTime = Date.now()
                setRemaining(breakDuration)
                const tick = () => {
                    const next = Math.max(0, breakDuration - (Date.now() - startTime) / 1000)
                    setRemaining(next)
                    rafRef.current = next > 0 ? requestAnimationFrame(tick) : null
                }
                rafRef.current = requestAnimationFrame(tick)
            }
        }
    }, [activeKey, breakDuration])

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        }
    }, [])

    if (!activeKey || remaining <= 0) return null

    const dashOffset = CIRCUMFERENCE * (1 - remaining / breakDuration)
    const svgSize = 50 / ratio

    return (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10, pointerEvents: "none", opacity: 0.9 }}>
            <svg width={svgSize} height={svgSize} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="8" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset} transform="rotate(-90 50 50)" />
            </svg>
        </div>
    )
}
