import { useEffect, useRef, type CSSProperties, type FormEvent, type FocusEvent, type KeyboardEvent } from "react"
import { translateText } from "../../../utils/language"
import { cn } from "../../../shared/core/lib/utils"
import { usePropState } from "../../hooks/usePropState"
import styles from "./Notes.module.css"

export interface NotesProps {
    value: string
    placeholder?: string
    disabled?: boolean
    lines?: number
    autofocus?: boolean
    className?: string
    style?: CSSProperties
    onEdit?: (value: string) => void
    onChange?: (value: string) => void
    onKeydown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

const TIME = 100

// (F24.20a). `dispatch("edit"/"change")` → onEdit/onChange.
export function Notes({ value: valueProp, placeholder = "", disabled = false, lines = 4, autofocus = false, className, style, onEdit, onChange, onKeydown }: NotesProps) {
    const [value, setValue] = usePropState(valueProp)
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(
        () => () => {
            if (timeout.current !== null) clearTimeout(timeout.current)
        },
        []
    )

    function input(event: FormEvent<HTMLTextAreaElement>) {
        const current = event.currentTarget.value
        if (timeout.current !== null) return
        timeout.current = setTimeout(() => {
            onEdit?.(current)
            timeout.current = null
        }, TIME)
    }

    function change(event: FocusEvent<HTMLTextAreaElement>) {
        // El timeout permite que el valor del textarea se actualice antes de pegar desde el menú contextual.
        const current = event.currentTarget.value
        setTimeout(() => onChange?.(current))
    }

    return (
        <div className={styles.paper}>
            <textarea placeholder={placeholder || translateText("empty.text...")} className={cn("edit", styles.edit, styles.textarea, className)} name="" id="" cols={1} rows={lines} style={style} value={value} disabled={disabled} autoFocus={autofocus} onChange={(event) => setValue(event.currentTarget.value)} onInput={input} onBlur={change} onKeyDown={onKeydown} />
        </div>
    )
}
