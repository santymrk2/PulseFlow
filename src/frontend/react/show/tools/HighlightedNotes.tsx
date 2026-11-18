import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type FocusEvent, type KeyboardEvent, type UIEvent } from "react"
import { groups } from "../../../stores"
import { getGlobalGroup } from "../../../components/helpers/show"
import { translateText } from "../../../utils/language"
import { cn } from "../../../lib/utils"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import styles from "./HighlightedNotes.module.css"

export interface HighlightedNotesProps {
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

// (F24.20a). `{@html highlightedText}` se conserva con el mismo escape.
export function HighlightedNotes({ value: valueProp, placeholder = "", disabled = false, lines = 4, autofocus = false, className, style, onEdit, onChange, onKeydown }: HighlightedNotesProps) {
    const [value, setValue] = usePropState(valueProp)
    const currentGroups = useStore(groups)
    const backdrop = useRef<HTMLDivElement>(null)
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
        const current = event.currentTarget.value
        setTimeout(() => onChange?.(current))
    }

    function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
        const element = event.currentTarget
        if (!backdrop.current) return
        backdrop.current.scrollTop = element.scrollTop
        backdrop.current.scrollLeft = element.scrollLeft
    }

    function getHighlighted(text: string): string {
        if (!text) return ""
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        escaped = escaped.replace(/(\[|\{)([^\]\}]*)(\]|\})/g, (_match, open: string, innerText: string, close: string) => {
            const groupId = getGlobalGroup(innerText)
            const color = groupId ? (currentGroups as unknown as Record<string, { color?: string }>)[groupId]?.color : undefined
            if (color) return `<span class="bracket-symbol">${open}</span><span class="bracket-content" style="color: ${color} !important;">${innerText}</span><span class="bracket-symbol">${close}</span>`
            return `<span class="bracket-symbol">${open}</span><span class="bracket-content">${innerText}</span><span class="bracket-symbol">${close}</span>`
        })
        if (escaped.endsWith("\n")) escaped += " "
        return escaped
    }

    const [highlightedText, setHighlightedText] = useState(() => getHighlighted(valueProp))

    useEffect(() => {
        setHighlightedText(getHighlighted(value))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, currentGroups])

    return (
        <div className={styles.paper}>
            <div className={styles.backdrop}>
                <div className={styles["highlight-overlay"]} style={style} dangerouslySetInnerHTML={{ __html: highlightedText }} />
            </div>
            <textarea placeholder={placeholder || translateText("empty.text...")} className={cn("edit", styles.edit, styles.textarea, className)} rows={lines} style={style} value={value} disabled={disabled} autoFocus={autofocus} onChange={(event) => setValue(event.currentTarget.value)} onInput={input} onBlur={change} onKeyDown={onKeydown} onScroll={handleScroll} />
        </div>
    )
}
