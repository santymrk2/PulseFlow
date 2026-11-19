import { useEffect, useRef, type CSSProperties, type FormEvent, type MouseEvent } from "react"
import { cn } from "../../../shared/core/lib/utils"
import styles from "./Slider.module.css"

// Port de ui/slider/slider.svelte. Reenvía los eventos DOM: `value` es de una vía y el DOM conserva lo arrastrado
// mientras la prop no cambie (el `bind:value` de Svelte sólo actualizaba el estado local). `onChange` es el `change` nativo
// (al soltar), no el de React.
export interface SliderProps {
    value: number
    min?: number
    max?: number
    invert?: boolean // flip slider if max < min
    step?: number
    title?: string
    disabled?: boolean
    style?: CSSProperties
    onMouseEnter?: (event: MouseEvent<HTMLInputElement>) => void
    onMouseLeave?: (event: MouseEvent<HTMLInputElement>) => void
    onMouseDown?: (event: MouseEvent<HTMLInputElement>) => void
    onMouseMove?: (event: MouseEvent<HTMLInputElement>) => void
    onInput?: (event: FormEvent<HTMLInputElement>) => void
    onChange?: (event: Event) => void
}

export function Slider({ value, min = 0, max = 100, invert = false, step, title, disabled, style, onMouseEnter, onMouseLeave, onMouseDown, onMouseMove, onInput, onChange }: SliderProps) {
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (input.current && input.current.value !== String(value)) input.current.value = String(value)
    }, [value, min, max])

    useEffect(() => {
        const el = input.current
        if (!el || !onChange) return
        el.addEventListener("change", onChange)
        return () => el.removeEventListener("change", onChange)
    }, [onChange])

    return <input ref={input} type="range" className={cn(styles.slider, invert && styles.invert)} defaultValue={value} style={style} min={min} max={max} step={step || 1} data-title={title} disabled={disabled} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onInput={onInput} />
}
