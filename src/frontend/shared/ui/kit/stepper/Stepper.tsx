import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react"
import { cn } from "../../../core/lib/utils"
import { evaluateArithmetic } from "../../../utils/safeMath"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import { Input } from "../input/Input"
import styles from "./Stepper.module.css"

// Port de ui/stepper/stepper.svelte. dispatch("change", string) → onChange(string): el detail es el número ya con toFixed(decimals).
// `onChange` del Input es el `change` nativo (al confirmar), igual que `on:change` en Svelte.
export interface StepperProps {
    value: number
    title?: string
    visibleTitle?: boolean
    style?: CSSProperties
    inputMultiplier?: number
    decimals?: number
    step?: number
    min?: number
    max?: number
    fixed?: number
    outline?: boolean
    buttons?: boolean
    disabled?: boolean
    disableHold?: boolean
    onChange?: (value: string) => void
}

export function Stepper({ value, title = "", visibleTitle = false, style, inputMultiplier = 1, decimals = 0, step = 1, min = 0, max = 1000, fixed = 0, outline = false, buttons = true, disabled = false, disableHold = false, onChange }: StepperProps) {
    const root = useRef<HTMLSpanElement>(null)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const interval = useRef<ReturnType<typeof setInterval> | null>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    // El mantener apretado y el wheel corren fuera del render: leen siempre el último valor, como las variables vivas de Svelte
    const latest = useRef({ value, step, min, max, decimals, disabled, onChange })
    useEffect(() => {
        latest.current = { value, step, min, max, decimals, disabled, onChange }
    })

    function increment(customStep: number = latest.current.step) {
        const l = latest.current
        l.onChange?.(Math.min(Number(l.value) + customStep, l.max).toFixed(l.decimals))
    }
    function decrement(customStep: number = latest.current.step) {
        const l = latest.current
        l.onChange?.(Math.max(Number(l.value) - customStep, l.min).toFixed(l.decimals))
    }

    function input(e: Event) {
        const target = e.target as HTMLInputElement
        // calculate without eval(); una expresión inválida vuelve al valor anterior
        const inputValue = evaluateArithmetic(String(target.value || 0)) ?? value

        const newValue = Math.max(Math.min(inputValue, max * inputMultiplier), min * inputMultiplier) / inputMultiplier
        onChange?.(newValue !== null ? newValue.toFixed(decimals) : String(value))
    }

    function mousedown(e: MouseEvent<HTMLSpanElement>) {
        const button = e.target instanceof Element ? e.target.closest("button") : null
        if (disableHold || !button) return

        // auto change when holding value
        // slow updates in edit caused this to create infinite loops (value didn't update)
        timeout.current = setTimeout(() => {
            if (!timeout.current) return

            const increase = button.id !== "decrement"

            let loopPrevention = 0
            interval.current = setInterval(() => {
                // stop after 50 updates
                if (loopPrevention > 50) return
                loopPrevention++

                if (increase) increment()
                else decrement()
            }, 100)

            timeout.current = null
        }, 500)
    }

    function release() {
        if (timeout.current) clearTimeout(timeout.current)
        if (interval.current) clearInterval(interval.current)
        timeout.current = null
        interval.current = null
    }

    // <svelte:window on:mouseup> + onDestroy(clearInterval)
    useEffect(() => {
        window.addEventListener("mouseup", release)
        return () => {
            window.removeEventListener("mouseup", release)
            release()
        }
    }, [])

    // Wheel nativo y no-pasivo: el onWheel de React es pasivo y no deja hacer preventDefault
    useEffect(() => {
        const el = root.current
        if (!el) return

        function wheel(e: WheelEvent) {
            if (latest.current.disabled || nextScrollTimeout.current) return
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()

            const stepAmount = latest.current.step * (e.shiftKey ? 10 : 1)

            if (e.deltaY > 0) decrement(stepAmount)
            else increment(stepAmount)

            // don't start timeout if scrolling with mouse
            if (e.deltaY >= 100 || e.deltaY <= -100) return
            nextScrollTimeout.current = setTimeout(() => {
                nextScrollTimeout.current = null
            }, 500)
        }

        el.addEventListener("wheel", wheel, { passive: false })
        return () => el.removeEventListener("wheel", wheel)
    }, [])

    return (
        <span ref={root} className={cn("numberInput", styles.numberInput, disabled && styles.disabled, outline && styles.outline)} style={style} onMouseDown={mousedown}>
            {buttons ? (
                <Button id="decrement" onClick={(detail) => decrement(detail.ctrl ? step * 10 : step)} style={{ flex: 1 }} disabled={disabled || Number(value) <= min}>
                    <Icon id="remove" size={1.2} white />
                </Button>
            ) : null}

            <span className={cn("input", styles.input)} data-title={title}>
                <Input disabled={disabled} value={(value * inputMultiplier).toFixed(fixed)} onChange={input} center />

                {visibleTitle ? <div className={styles.title}>{title}</div> : null}
            </span>

            {buttons ? (
                <Button id="increment" onClick={(detail) => increment(detail.ctrl ? step * 10 : step)} style={{ flex: 1 }} disabled={disabled || Number(value) >= max}>
                    <Icon id="add" size={1.2} white />
                </Button>
            ) : null}
        </span>
    )
}
