import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react"
import { cn } from "../../../lib/utils"
import { translateText } from "../../../utils/language"
import { useDerivedState } from "../../hooks/useDerivedState"
import styles from "./RadialField.module.css"

// Port de ui/radial-field/radial-field.svelte. dispatch("input", number) → onInput(number); dispatch("change", number) → onChange(number): siempre juntos
// (input y luego change) y con el ángulo ya normalizado a 0–360. `on:input` del Svelte es el evento por tecla (el onInput de React también).
// `bind:value={numberValue}` en un input numérico deja `null` si se borra el texto: se conserva (numberValue puede ser null).
// El arrastre usa listeners de window como el original (con la diferencia de que se quitan también al desmontar). La rueda es un listener nativo no pasivo.
export interface RadialFieldProps {
    value?: number
    label: string
    id?: string
    placeholder?: string
    disabled?: boolean
    autofocus?: boolean
    step?: number
    onInput?: (value: number) => void
    onChange?: (value: number) => void
}

const RADIUS = 40
const MINI_RADIUS = 6
const SNAP_POINTS = [0, 90, 180, 270, 360]

function clamp360(v: number) {
    if (isNaN(v)) return 0
    v = v % 360
    if (v < 0) v += 360
    return v
}

function angleFromEvent(e: MouseEvent | TouchEvent | globalThis.MouseEvent | globalThis.TouchEvent, rect: DOMRect) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let clientX, clientY
    if (e instanceof window.MouseEvent) {
        clientX = e.clientX
        clientY = e.clientY
    } else {
        const touch = (e as globalThis.TouchEvent).touches[0]
        clientX = touch.clientX
        clientY = touch.clientY
    }
    const dx = clientX - cx
    const dy = clientY - cy
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90

    angle = Math.round(angle < 0 ? angle + 360 : angle)

    // snapping
    const shouldSnap = SNAP_POINTS.find((a) => Math.abs(angle - a) < 5)
    if (shouldSnap !== undefined) return shouldSnap

    return angle
}

export function RadialField({ value = 0, label, id = "", placeholder = "", disabled = false, autofocus = false, step = 1, onInput, onChange }: RadialFieldProps) {
    const input = useRef<HTMLInputElement>(null)
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stopDrag = useRef<(() => void) | null>(null)
    const [numberValue, setNumberValue] = useDerivedState<number | null, number>(value, (v) => clamp360(Number(v)))
    const [showPopup, setShowPopup] = useState(false)

    function updateValue(newVal: number) {
        if (disabled) return
        const next = clamp360(newVal)
        setNumberValue(next)
        // `bind:value`: el DOM sigue a numberValue aunque el texto escrito (p. ej. 400) no coincida con el normalizado
        if (input.current && input.current.value !== String(next)) input.current.value = String(next)
        onInput?.(next)
        onChange?.(next)
    }

    const current = numberValue ?? 0

    function increment(customStep: number = step) {
        updateValue(current + customStep)
    }

    function decrement(customStep: number = step) {
        updateValue(current - customStep)
    }

    // Listeners nativos y de window: viven fuera del render y leen siempre lo último
    const latest = useRef({ updateValue, increment, decrement, disabled, step })
    useEffect(() => {
        latest.current = { updateValue, increment, decrement, disabled, step }
    })

    // `value={numberValue}` de Svelte: escribe en el DOM cuando cambia
    useEffect(() => {
        if (input.current && input.current.value !== String(numberValue ?? "")) input.current.value = String(numberValue ?? "")
    }, [numberValue])

    useEffect(() => {
        const el = input.current
        if (!el) return

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

        el.addEventListener("wheel", wheel, { passive: false })
        return () => {
            el.removeEventListener("wheel", wheel)
            stopDrag.current?.()
        }
    }, [])

    // `bind:value` (por tecla) y después `on:input`
    function handleInput(e: FormEvent<HTMLInputElement>) {
        const text = e.currentTarget.value
        setNumberValue(text === "" ? null : Number(text))
        const newValue = parseFloat(text)
        if (!isNaN(newValue)) updateValue(newValue)
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowUp") {
            e.preventDefault()
            increment()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            decrement()
        }
    }

    // --- Radial popup ---

    // Close popup when the wrapper loses focus entirely
    function handleFocusOut(e: FocusEvent<HTMLDivElement>) {
        const related = e.relatedTarget as HTMLElement | null
        if (!related || !e.currentTarget.contains(related)) setShowPopup(false)
    }

    function togglePopup(e: FocusEvent<HTMLInputElement>) {
        if (e.target.tagName === "BUTTON") return
        if (!disabled) setShowPopup(!showPopup)
    }

    function startDrag(e: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) {
        const svg = (e.target as Element).closest("svg")
        if (!svg) return

        let dragging = true
        updateValue(angleFromEvent(e.nativeEvent, svg.getBoundingClientRect()))

        const onDrag = (ev: globalThis.MouseEvent | globalThis.TouchEvent) => {
            const picker = document.getElementById("degree-picker")
            if (!dragging || !picker) return
            latest.current.updateValue(angleFromEvent(ev, picker.getBoundingClientRect()))
        }
        const stop = () => {
            dragging = false
            window.removeEventListener("mousemove", onDrag)
            window.removeEventListener("mouseup", stop)
            window.removeEventListener("touchmove", onDrag)
            window.removeEventListener("touchend", stop)
            stopDrag.current = null
        }
        stopDrag.current?.()
        window.addEventListener("mousemove", onDrag)
        window.addEventListener("mouseup", stop)
        window.addEventListener("touchmove", onDrag)
        window.addEventListener("touchend", stop)
        stopDrag.current = stop
    }

    const handleX = Math.cos((current - 90) * (Math.PI / 180)) * RADIUS
    const handleY = Math.sin((current - 90) * (Math.PI / 180)) * RADIUS
    // small indicator
    const miniX = Math.cos((current - 90) * (Math.PI / 180)) * MINI_RADIUS
    const miniY = Math.sin((current - 90) * (Math.PI / 180)) * MINI_RADIUS
    const box = (RADIUS + 10) * 2

    return (
        <div className={cn("textfield", "numberfield", styles.textfield, disabled && "disabled", disabled && styles.disabled)} tabIndex={-1} onBlur={handleFocusOut}>
            <div className={styles.background} />

            <div className={styles.inputWrapper}>
                <input ref={input} defaultValue={String(numberValue ?? "")} type="number" id={id} placeholder={placeholder} disabled={disabled} autoFocus={autofocus} step={step} min="0" max="360" className={cn("input", "edit", styles.input, !numberValue && styles.noValue)} onKeyDown={handleKeyDown} onInput={handleInput} onFocus={togglePopup} />

                <svg className={styles.miniIndicator} viewBox="-8 -8 16 16">
                    <circle r={MINI_RADIUS} stroke="var(--primary-lighter)" strokeWidth="1" fill="none" />
                    <circle cx={miniX} cy={miniY} r="2" fill={disabled ? "var(--primary)" : "var(--secondary)"} />
                </svg>

                <div className={styles.buttons}>
                    <button type="button" className={cn("inc", styles.step)} onClick={(e) => increment(e.shiftKey ? step * 10 : step)} tabIndex={-1} disabled={disabled}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button type="button" className={cn("dec", styles.step)} onClick={(e) => decrement(e.shiftKey ? step * 10 : step)} tabIndex={-1} disabled={disabled}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            <label className={cn(styles.label, numberValue !== 0 && styles.valueFilled)} htmlFor={id}>
                {translateText(label)}
            </label>

            <span className={styles.underline} />

            {/* Radial Popup */}
            {showPopup ? (
                <div className={styles.picker} onClick={(e) => e.stopPropagation()} onMouseDown={startDrag} onTouchStart={startDrag}>
                    <svg id="degree-picker" viewBox={`-${RADIUS + 10} -${RADIUS + 10} ${box} ${box}`} width="100" height="100">
                        <circle r={RADIUS} stroke="var(--primary-lighter)" strokeWidth="1" fill="none" />
                        <line x1="0" y1="0" x2={handleX} y2={handleY} stroke="var(--secondary)" strokeWidth="2" />
                        <circle className={styles.handle} cx={handleX} cy={handleY} r="4" fill="var(--secondary)" />
                    </svg>
                </div>
            ) : null}
        </div>
    )
}
