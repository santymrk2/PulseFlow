import { useEffect, useRef, type CSSProperties, type FormEvent, type KeyboardEvent } from "react"
import { cn } from "../../../lib/utils"
import styles from "./Input.module.css"

// Port de ui/input/input.svelte. Eventos DOM reenviados. `value` es de una vía, como en Svelte:
// el DOM conserva lo escrito mientras la prop no cambie.
export interface InputProps {
    id?: string
    type?: string
    value: string
    placeholder?: string
    style?: CSSProperties
    center?: boolean
    light?: boolean
    disabled?: boolean
    autofocus?: boolean
    autoselect?: boolean
    onInput?: (event: FormEvent<HTMLInputElement>) => void
    // `change` nativo (al confirmar con Enter o al perder el foco), como on:change de Svelte
    onChange?: (event: Event) => void
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function Input({ id = "", type = "text", value, placeholder = "", style, center = false, light = false, disabled = false, autofocus = false, autoselect = false, onInput, onChange, onKeyDown }: InputProps) {
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (input.current && input.current.value !== value) input.current.value = value
    }, [value])

    // Equivale a `use:select` de Svelte: sólo al montar
    useEffect(() => {
        if (autoselect) input.current?.select()
    }, [])

    // Listener nativo y no el onChange de React: React lo dispara por cada tecla, y en Svelte on:change es el nativo.
    useEffect(() => {
        const el = input.current
        if (!el || !onChange) return
        el.addEventListener("change", onChange)
        return () => el.removeEventListener("change", onChange)
    }, [onChange])

    return <input ref={input} id={id} type={type} className={cn("edit", styles.input, center && styles.center, light && styles.light)} defaultValue={value} placeholder={placeholder} style={style} disabled={disabled} autoFocus={autofocus} onInput={onInput} onKeyDown={onKeyDown} />
}
