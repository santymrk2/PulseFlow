import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react"
import { cn } from "../../../shared/core/lib/utils"
import { dictionary } from "../../../shared/core/stores"
import { evaluateArithmetic } from "../../../shared/utils/safeMath"
import { translateText } from "../../../shared/utils/language"
import { Icon } from "../../helpers/Icon"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./NumberField.module.css"

// Port de ui/number-field/number-field.svelte, con la misma lógica de updateValue (evaluateArithmetic, sin eval ni new Function).
// dispatch("input", number) → onInput(number); dispatch("change", number | null) → onChange(number | null) (reset/undo despachan defaultValue o el
// valor previo, que pueden ser null); dispatch("keydown", e) → onKeyDown(e); dispatch("keyframe", number) → onKeyframe(number).
// `change` es el evento NATIVO del input (Enter/blur), como `on:change` de Svelte; `input` (por tecla) sólo actualiza el texto.
export interface NumberFieldProps {
    value?: number
    defaultValue?: number | null
    label: string
    id?: string
    placeholder?: string
    center?: boolean
    disabled?: boolean
    autofocus?: boolean
    hideWhenZero?: boolean
    showSlider?: boolean
    sliderValues?: { min?: number; max?: number; step?: number }
    currentProgress?: number | null
    step?: number
    min?: number | null
    max?: number | null
    maxDecimals?: number
    padLength?: number
    enableKeyframe?: boolean
    hasTimelineAction?: boolean
    style?: CSSProperties
    onInput?: (value: number) => void
    onChange?: (value: number | null) => void
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
    onKeyframe?: (value: number) => void
}

export function NumberField({ value = 0, defaultValue = null, label, id = "", placeholder = "", center = false, disabled = false, autofocus = false, hideWhenZero = false, showSlider = false, sliderValues = {}, currentProgress = null, step = 1, min = 0, max = null, maxDecimals = 2, padLength = 0, enableKeyframe = false, hasTimelineAction = false, style, onInput, onChange, onKeyDown, onKeyframe }: NumberFieldProps) {
    useStore(dictionary)
    const inputElem = useRef<HTMLInputElement>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    // a string might be passed in
    const [numberValue, setNumberValue] = usePropState(Number(value || 0))
    // Texto escrito: manda mientras numberValue, padLength y maxDecimals no cambien (en Svelte, `rawInput` se recalcula al cambiar numberValue)
    const [typed, setTyped] = useState<{ forValue: number; padLength: number; maxDecimals: number; text: string } | null>(null)
    const [resetFromValue, setResetFromValue] = useState<number | null>(null)
    const [keyframeActive, setKeyframeActive] = usePropState(hasTimelineAction)

    const padded = (n: number) => String(n).padStart(padLength, "0")
    const rawInput = typed && typed.forValue === numberValue && typed.padLength === padLength && typed.maxDecimals === maxDecimals ? typed.text : padLength ? padded(numberValue) : String(Number(numberValue.toFixed(maxDecimals)))

    // Slider values and percent for filled track
    const sliderMin = sliderValues?.min ?? min ?? 0
    const sliderMax = sliderValues?.max ?? max ?? 100
    const sliderStep = sliderValues?.step ?? step
    const sliderPercent = sliderMax > sliderMin ? ((Number(numberValue) - Number(sliderMin)) / (Number(sliderMax) - Number(sliderMin))) * 100 : 0

    function updateValue(newVal: number | string) {
        if (disabled) return

        // convert , to .
        const normalizedVal = typeof newVal === "string" ? newVal.replace(/,/g, ".") : newVal

        let calcVal: number | null
        if (!padLength) {
            calcVal = typeof normalizedVal === "string" ? evaluateArithmetic(normalizedVal) : normalizedVal
            // invalid expression
            if (calcVal === null) return
        } else {
            calcVal = Number(normalizedVal)
        }
        // invalid value
        if (isNaN(calcVal)) return

        if (min !== null) calcVal = Math.max(min, calcVal)
        if (max !== null) calcVal = Math.min(max, calcVal)
        calcVal = Number(calcVal.toFixed(maxDecimals))
        setNumberValue(calcVal)

        // set padded value
        setTyped({ forValue: calcVal, padLength, maxDecimals, text: padLength ? padded(calcVal) : String(calcVal) })

        onInput?.(calcVal)
        onChange?.(calcVal)
    }

    function handleInput(e: FormEvent<HTMLInputElement>) {
        setTyped({ forValue: numberValue, padLength, maxDecimals, text: e.currentTarget.value })
    }

    function increment(customStep: number = step) {
        if (max === null || numberValue < max) updateValue(Number((numberValue + customStep).toFixed(3)))
    }

    function decrement(customStep: number = step) {
        if (min === null || numberValue > min) updateValue(Number((numberValue - customStep).toFixed(3)))
    }

    // Listeners nativos (change y wheel no-pasivo) y timers: viven fuera del render, leen siempre lo último
    const latest = useRef({ updateValue, increment, decrement, disabled, step })
    useEffect(() => {
        latest.current = { updateValue, increment, decrement, disabled, step }
    })

    useEffect(() => {
        const el = inputElem.current
        if (!el) return

        // on:change de Svelte es el evento nativo; el onChange de React dispararía por tecla
        const change = () => latest.current.updateValue(el.value)

        function wheel(e: WheelEvent) {
            const l = latest.current
            if (l.disabled || nextScrollTimeout.current) return
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()

            const stepAmount = l.step * (e.shiftKey ? 10 : 1)

            if (e.deltaY < 0) l.increment(stepAmount)
            else l.decrement(stepAmount)

            // don't start timeout if scrolling with mouse
            if (e.deltaY >= 100 || e.deltaY <= -100) return
            nextScrollTimeout.current = setTimeout(() => {
                nextScrollTimeout.current = null
            }, 500)
        }

        el.addEventListener("change", change)
        el.addEventListener("wheel", wheel, { passive: false })
        return () => {
            el.removeEventListener("change", change)
            el.removeEventListener("wheel", wheel)
        }
    }, [])

    // `value={rawInput}` de Svelte: escribe el texto en el DOM cuando cambia
    useEffect(() => {
        if (inputElem.current && inputElem.current.value !== rawInput) inputElem.current.value = rawInput
    }, [rawInput])

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowUp") {
            e.preventDefault()
            increment()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            decrement()
        } else if (e.key === "Enter") {
            e.preventDefault()
            updateValue(rawInput)
        }

        onKeyDown?.(e)
    }

    // RESET

    function reset() {
        setResetFromValue(value)
        onChange?.(defaultValue)
        setTimeout(() => setResetFromValue(null), 3000)
    }

    function undoReset() {
        onChange?.(resetFromValue)
        setResetFromValue(null)
    }

    // KEYFRAME

    function addKeyframe() {
        setKeyframeActive(!keyframeActive)
        onKeyframe?.(numberValue)
    }

    const filled = !hideWhenZero || !!padLength || (numberValue !== null && numberValue !== undefined && numberValue !== 0)

    return (
        <div className={cn("textfield", "numberfield", styles.textfield, center && "centered", center && styles.centered, disabled && "disabled", disabled && styles.disabled)} style={style}>
            <div className={styles.background} />

            <div className={styles.inputWrapper}>
                <input ref={inputElem} defaultValue={rawInput} type="text" id={id} placeholder={placeholder} disabled={disabled} autoFocus={autofocus} step={step} min={min ?? undefined} max={max ?? undefined} className={cn("input", "edit", styles.input, hideWhenZero && !padLength && !numberValue && styles.noValue)} onKeyDown={handleKeyDown} onInput={handleInput} inputMode="decimal" autoComplete="off" />

                <div className={styles.buttons}>
                    <button type="button" className="inc" onClick={(e) => increment(e.shiftKey ? step * 10 : step)} tabIndex={-1} disabled={disabled || (max !== null && numberValue >= max)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button type="button" className="dec" onClick={(e) => decrement(e.shiftKey ? step * 10 : step)} tabIndex={-1} disabled={disabled || (min !== null && numberValue <= min)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            <label htmlFor={id} className={cn(styles.label, filled && styles.valueFilled)} dangerouslySetInnerHTML={{ __html: translateText(label) }} />

            <span className={styles.underline} style={currentProgress ? { width: `${currentProgress}%`, transform: "initial" } : undefined} />

            {showSlider ? (
                <div className={styles.sliderWrapper} style={{ paddingRight: `${defaultValue === null ? 40 : 70}px` }}>
                    <input tabIndex={-1} className={styles.slider} type="range" disabled={disabled} min={sliderMin} max={sliderMax} step={sliderStep} value={numberValue} onChange={(e) => updateValue(Number(e.currentTarget.value))} style={{ "--slider-fill": `${sliderPercent}%` } as CSSProperties} />
                </div>
            ) : null}

            {defaultValue !== null ? (
                <div className={cn("remove", styles.remove)}>
                    {value !== defaultValue ? (
                        <Button disabled={disabled} onClick={reset} title="actions.reset" white>
                            <Icon id="reset" white />
                        </Button>
                    ) : resetFromValue !== null ? (
                        <Button disabled={disabled} onClick={undoReset} title="actions.undo" white>
                            <Icon id="undo" white />
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {enableKeyframe ? (
                <div className={cn("remove", styles.remove)}>
                    <Button style={{ width: "20px", height: "20px", padding: 0 }} onClick={addKeyframe} title="timeline.add_keyframe">
                        {/* diamond */}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L22 12L12 22L2 12L12 2Z" fill={keyframeActive ? "var(--secondary)" : "currentColor"} />
                        </svg>
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
