import type { CSSProperties } from "react"
import { TimeField } from "../time-field/TimeField"

// Port de ui/date-field/date-field.svelte: un TimeField con isDate. Reenvía sólo input y change (no keydown), como el original.
export interface DateFieldProps {
    label: string
    value: string // formato "YYYY-MM-DD"
    defaultValue?: string | null
    id?: string
    title?: string
    disabled?: boolean
    autofocus?: boolean
    style?: CSSProperties
    onInput?: (value: string | null) => void
    onChange?: (value: string | null) => void
}

export function DateField({ label, value, defaultValue = null, id = "", title = "", disabled = false, autofocus = false, style, onInput, onChange }: DateFieldProps) {
    return <TimeField label={label} value={value} defaultValue={defaultValue} id={id} title={title} disabled={disabled} autofocus={autofocus} style={style} onInput={onInput} onChange={onChange} isDate />
}
