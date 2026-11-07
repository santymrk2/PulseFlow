import { useEffect, useRef, type FormEvent } from "react"
import { cn } from "../../../lib/utils"
import { translateText } from "../../../utils/language"
import { usePropState } from "../../hooks/usePropState"
import styles from "./TextareaField.module.css"

// Port de ui/textarea-field/textarea-field.svelte. dispatch("input", string) → onInput(string); dispatch("change", string) → onChange(string).
// `change` es el evento NATIVO (al perder el foco), como `on:change` de Svelte; `input` es por tecla. `class` → className.
export interface TextareaFieldProps {
    value?: string
    label: string
    id?: string
    placeholder?: string
    rows?: number
    center?: boolean
    disabled?: boolean
    autofocus?: boolean
    autoselect?: boolean
    className?: string
    onInput?: (value: string) => void
    onChange?: (value: string) => void
}

export function TextareaField({ value: valueProp = "", label, id = "", placeholder = "", rows = 8, center = false, disabled = false, autofocus = false, autoselect = false, className = "", onInput, onChange }: TextareaFieldProps) {
    const textarea = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = usePropState(valueProp)

    useEffect(() => {
        if (textarea.current && textarea.current.value !== value) textarea.current.value = value
    }, [value])

    // Equivale a `use:select`: sólo al montar
    useEffect(() => {
        if (autoselect) textarea.current?.select()
    }, [])

    // Listener nativo y no el onChange de React (que dispara por tecla)
    useEffect(() => {
        const el = textarea.current
        if (!el || !onChange) return
        const change = () => onChange(el.value)
        el.addEventListener("change", change)
        return () => el.removeEventListener("change", change)
    }, [onChange])

    function handleInput(event: FormEvent<HTMLTextAreaElement>) {
        const next = event.currentTarget.value
        setValue(next)
        onInput?.(next)
    }

    return (
        <div className={cn("textfield", styles.textfield, center && "centered", center && styles.centered, disabled && "disabled", disabled && styles.disabled, className)}>
            <div className={styles.background} />
            <textarea ref={textarea} id={id} placeholder={placeholder} disabled={disabled} autoFocus={autofocus} className={cn("input", "edit", styles.input)} defaultValue={value} rows={rows} onInput={handleInput} />
            <label className={styles.label} htmlFor={id}>
                {translateText(label)}
            </label>
            <span className={styles.underline} />
        </div>
    )
}
