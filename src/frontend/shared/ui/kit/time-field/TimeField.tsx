import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react"
import { cn } from "../../../core/lib/utils"
import { dictionary } from "../../../core/stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./TimeField.module.css"

// Port de ui/time-field/time-field.svelte. dispatch("input", string | null) → onInput; dispatch("change", string | null) → onChange; `on:keydown` (reenvío
// del DOM) → onKeyDown(event). `change` es el evento NATIVO (como `on:change` de Svelte); `input` es por tecla. reset/undo despachan change y luego input
// (el valor puede ser null: defaultValue o el previo). `use:blurOnEnter` desenfoca en el acto (sin setTimeout), después del reenvío de keydown.
export interface TimeFieldProps {
    label: string
    value: string // formato "12:00" ("YYYY-MM-DD" con isDate)
    defaultValue?: string | null
    id?: string
    title?: string
    disabled?: boolean
    autofocus?: boolean
    isDate?: boolean
    style?: CSSProperties
    onInput?: (value: string | null) => void
    onChange?: (value: string | null) => void
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function TimeField({ label, value: valueProp, defaultValue = null, id = "", title = "", disabled = false, autofocus = false, isDate = false, style, onInput, onChange, onKeyDown }: TimeFieldProps) {
    const dict = useStore(dictionary)
    const input = useRef<HTMLInputElement>(null)
    const [value, setValue] = usePropState(valueProp)
    const [resetFromValue, setResetFromValue] = useState<string | null>(null)

    // `bind:value`: lo escrito se conserva y un cambio de la prop se escribe en el input
    useEffect(() => {
        if (input.current && input.current.value !== value) input.current.value = value
    }, [value])

    // on:change de Svelte es el evento nativo; el onChange de React dispararía por tecla
    useEffect(() => {
        const el = input.current
        if (!el || !onChange) return
        const change = () => onChange(el.value)
        el.addEventListener("change", change)
        return () => el.removeEventListener("change", change)
    }, [onChange])

    function handleInput(event: FormEvent<HTMLInputElement>) {
        const next = event.currentTarget.value
        setValue(next)
        onInput?.(next)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        onKeyDown?.(event)
        if (event.key === "Enter") event.currentTarget.blur()
    }

    // RESET

    function updateValue(next: string | null) {
        onChange?.(next)
        onInput?.(next)
    }

    function reset() {
        setResetFromValue(value)
        updateValue(defaultValue)
        setTimeout(() => setResetFromValue(null), 3000)
    }

    function undoReset() {
        updateValue(resetFromValue)
        setResetFromValue(null)
    }

    return (
        <div className={cn("textfield", "filled", styles.textfield, styles.filled, disabled && "disabled", disabled && styles.disabled)} data-title={translateText(title)} style={style}>
            <div className={styles.background} />

            <input ref={input} type={isDate ? "date" : "time"} id={id} disabled={disabled} autoFocus={autofocus} className={cn("input", "edit", styles.input)} defaultValue={value} onInput={handleInput} onKeyDown={handleKeyDown} />

            <label className={styles.label} htmlFor={id} dangerouslySetInnerHTML={{ __html: translateText(label, dict) }} />

            <span className={styles.underline} />

            {defaultValue !== null ? (
                <div className={cn("remove", styles.remove)}>
                    {value !== defaultValue ? (
                        <Button onClick={reset} title="actions.reset" white>
                            <Icon id="reset" white />
                        </Button>
                    ) : resetFromValue !== null ? (
                        <Button onClick={undoReset} title="actions.undo" white>
                            <Icon id="undo" white />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
