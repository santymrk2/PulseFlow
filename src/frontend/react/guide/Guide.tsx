import { useEffect, useState } from "react"
import { guideActive, os } from "../../shared/core/stores"
import { wait } from "../../shared/utils/common"
import { translateText } from "../../shared/utils/language"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { guideSteps } from "../../components/guide/guideSteps"
import styles from "./Guide.module.css"

interface GuideStep {
    pre?: () => void
    query: string
    timeout?: number
    title: string
    description?: string
}

export function Guide() {
    const active = useStore(guideActive)
    const currentOs = useStore(os)
    const steps = guideSteps as GuideStep[]

    const [stepIndex, setStepIndex] = useState(0)
    const [currentStyle, setCurrentStyle] = useState("")
    const [currentTextStyle, setCurrentTextStyle] = useState("")
    const [flip, setFlip] = useState(false)

    useEffect(() => {
        if (active) {
            setStepIndex(0)
            setCurrentStyle("")
            setCurrentTextStyle("")
        }
    }, [active])

    const currentStep = steps[stepIndex]

    useEffect(() => {
        let cancelled = false
        async function findElementPos(step: GuideStep | undefined) {
            if (!active || !step) return
            if (step.pre) step.pre()
            const timeIndex = stepIndex
            await wait(step.timeout ?? 10)
            if (cancelled || timeIndex !== stepIndex) return

            const elem = document.querySelector(step.query) as HTMLElement | null
            if (!elem) {
                console.log("Could not find element for step", stepIndex)
                setStepIndex((i) => i + 1)
                return
            }

            const bounds = elem.getBoundingClientRect()
            const width = window.innerWidth
            const shouldFlip = bounds.x > width * 0.7
            setFlip(shouldFlip)

            const isAtTop = bounds.y < 100
            const topOffset = currentOs.platform === "darwin" && isAtTop ? 50 : 0

            let top = ""
            if (bounds.y + bounds.height <= 25 + 40) top = `top: ${bounds.y + bounds.height}px;${currentOs.platform === "win32" ? "transform: translateY(-25px);" : ""}`

            setCurrentStyle(`left: ${bounds.x}px;top: ${Math.max(top ? 0 : 70 + topOffset, bounds.y)}px;width: ${bounds.width}px;height: ${bounds.height}px;`)
            if (shouldFlip) setCurrentTextStyle(`max-width: ${bounds.right}px;${top}`)
            else setCurrentTextStyle(`max-width: ${width - bounds.left}px;${top}`)
        }
        void findElementPos(currentStep)
        return () => {
            cancelled = true
        }
    }, [active, currentStep, stepIndex, currentOs.platform])

    useEffect(() => {
        if (!active) return

        function mousedown(e: MouseEvent) {
            const target = e.target as HTMLElement | null
            if (!active || target?.closest("#guideButtons")) return
            setStepIndex((i) => i + 1)
        }

        function keydown(e: KeyboardEvent) {
            if (!active) return
            if (e.key === "Escape") {
                guideActive.set(false)
            } else if (e.key === "ArrowRight") {
                if (steps[stepIndex + 1]) setStepIndex((i) => i + 1)
                else guideActive.set(false)
            } else if (e.key === "ArrowLeft") {
                if (stepIndex === 0) guideActive.set(false)
                else if (steps[stepIndex + 1]) setStepIndex((i) => i - 1)
            }
        }

        window.addEventListener("mousedown", mousedown)
        window.addEventListener("keydown", keydown)
        return () => {
            window.removeEventListener("mousedown", mousedown)
            window.removeEventListener("keydown", keydown)
        }
    }, [active, stepIndex, steps])

    if (!active || !currentStep || !currentStyle) return null

    return (
        <div className={styles.guide}>
            <div className={styles.focus} style={styleFromString(currentStyle)}>
                <div className={`${styles.text} ${flip ? styles.flip : ""}`.trim()} style={styleFromString(currentTextStyle)}>
                    <p className={styles.title}>
                        <T id={currentStep.title} />
                    </p>
                    {currentStep.description ? (
                        <p>
                            <T id={currentStep.description} />
                        </p>
                    ) : null}
                </div>
            </div>

            <div id="guideButtons" className={styles.guideButtons}>
                {stepIndex === 0 ? (
                    <Button align="start" onClick={() => guideActive.set(false)}>
                        <T id="guide.skip" />
                    </Button>
                ) : steps[stepIndex + 1] ? (
                    <Button align="start" onClick={() => setStepIndex((i) => i - 1)} title={translateText("media.previous")}>
                        <Icon id="back" size={1.5} white />
                    </Button>
                ) : null}
                <Button align="start" onClick={() => (steps[stepIndex + 1] ? setStepIndex((i) => i + 1) : guideActive.set(false))} title={translateText(steps[stepIndex + 1] ? "media.next" : "actions.done")}>
                    <Icon id={steps[stepIndex + 1] ? "arrow_forward" : "check"} size={1.5} white={!!steps[stepIndex + 1]} />
                </Button>
            </div>
        </div>
    )
}

function styleFromString(style: string): React.CSSProperties {
    const out: Record<string, string> = {}
    style.split(";").forEach((part) => {
        const [rawKey, ...rest] = part.split(":")
        if (!rawKey || rest.length === 0) return
        const key = rawKey.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const value = rest.join(":").trim()
        if (key && value) out[key] = value
    })
    return out
}
