import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react"
import { cn } from "../../../lib/utils"
import { pasteText } from "../../../components/helpers/caretHelper"
import { dictionary } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./TextField.module.css"

// Port de ui/text-field/text-field.svelte. dispatch("input", string) → onInput(string); dispatch("change", string | null) → onChange(string | null);
// `on:keydown` (reenvío del DOM) → onKeyDown(event). `change` es el evento NATIVO (Enter/blur), como `on:change` de Svelte; `input` es por tecla.
// `reset`, `autofill` y el cambio de `value` por el padre despachan change e input con el valor nuevo (puede ser null).
export interface TextFieldProps {
    value: string
    type?: string
    defaultValue?: string | null
    autofill?: string
    label: string
    id?: string
    title?: string
    placeholder?: string
    center?: boolean
    disabled?: boolean
    autofocus?: boolean
    autoselect?: boolean
    pasteBtn?: boolean
    style?: CSSProperties
    onInput?: (value: string | null) => void
    onChange?: (value: string | null) => void
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function TextField({ value: valueProp, type = "text", defaultValue = null, autofill = "", label, id = "", title = "", placeholder = "", center = false, disabled = false, autofocus = false, autoselect = false, pasteBtn = false, style, onInput, onChange, onKeyDown }: TextFieldProps) {
    useStore(dictionary) // la etiqueta se traduce con `$dictionary` en el Svelte
    const input = useRef<HTMLInputElement>(null)
    const [value, setValue] = usePropState(valueProp)
    const [resetFromValue, setResetFromValue] = useState<string | null>(null)
    const [showText, setShowText] = useState(false)

    // Mismo `value` que el DOM: lo escrito se conserva y un cambio de la prop se escribe en el input (como `bind:value`)
    useEffect(() => {
        if (input.current && input.current.value !== value) input.current.value = value
    }, [value])

    // Equivale a `use:select`: sólo al montar
    useEffect(() => {
        if (autoselect) input.current?.select()
    }, [])

    // Listener nativo y no el onChange de React (que dispara por tecla): en Svelte on:change es el nativo.
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

    // `use:blurOnEnter` + `on:keydown`
    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter") {
            const el = event.currentTarget
            setTimeout(() => el.blur())
        }
        onKeyDown?.(event)
    }

    function updateValue(next: string | null) {
        onChange?.(next)
        onInput?.(next)
    }

    // RESET

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
        <div className={cn("textfield", styles.textfield, center && "centered", center && styles.centered, disabled && "disabled", disabled && styles.disabled)} data-title={translateText(title)} style={style}>
            <div className={styles.background} />

            <input ref={input} type={type === "password" && !showText ? "password" : "text"} id={id} placeholder={placeholder} disabled={disabled} autoFocus={autofocus} className={cn("input", "edit", styles.input)} defaultValue={value} onInput={handleInput} onKeyDown={handleKeyDown} />

            <label className={styles.label} htmlFor={id} dangerouslySetInnerHTML={{ __html: translateText(label) }} />

            <span className={styles.underline} />

            <div className={cn("remove", styles.remove)}>
                {autofill ? (
                    <Button onClick={() => updateValue(autofill)} title="meta.autofill" white>
                        <Icon id="autofill" white />
                    </Button>
                ) : null}

                {defaultValue !== null ? (
                    value !== defaultValue ? (
                        <Button onClick={reset} title="actions.reset" white>
                            <Icon id="reset" white />
                        </Button>
                    ) : resetFromValue !== null ? (
                        <Button onClick={undoReset} title="actions.undo" white>
                            <Icon id="undo" white />
                        </Button>
                    ) : null
                ) : null}

                {type === "password" && (!pasteBtn || value) ? (
                    <Button
                        onClick={() => {
                            setShowText(!showText)
                            input.current?.focus()
                        }}
                        title=""
                        white
                    >
                        <Icon id={showText ? "eye" : "hide"} white />
                    </Button>
                ) : pasteBtn && !value && !disabled ? (
                    <Button
                        onClick={() => {
                            pasteText(input.current)
                            input.current?.focus()
                        }}
                        title="actions.paste"
                        white
                    >
                        <Icon id="paste" white />
                    </Button>
                ) : null}
            </div>
        </div>
    )
}
