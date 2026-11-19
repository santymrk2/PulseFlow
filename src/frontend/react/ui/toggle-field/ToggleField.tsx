import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { cn } from "../../../shared/core/lib/utils"
import { dictionary } from "../../../shared/core/stores"
import { translateText } from "../../../shared/utils/language"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import styles from "./ToggleField.module.css"

// Port de ui/toggle-field/toggle-field.svelte. dispatch("change", boolean) → onChange(boolean).
export interface ToggleFieldProps {
    checked?: boolean
    defaultValue?: boolean | null
    label: string
    title?: string
    data?: ReactNode
    id?: string
    disabled?: boolean
    center?: boolean
    small?: boolean
    style?: CSSProperties
    onChange?: (checked: boolean) => void
}

export function ToggleField({ checked = false, defaultValue = null, label, title = "", data = null, id = "", disabled = false, center = false, small = false, style, onChange }: ToggleFieldProps) {
    const dict = useStore(dictionary)
    // might not be a boolean - maybe undefined
    const [checkedValue, setCheckedValue] = usePropState(!!checked)

    function toggle() {
        if (disabled) return
        setCheckedValue(!checkedValue)
        onChange?.(!checkedValue)
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return
        // WIP space also changes slides...
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            toggle()
        }
    }

    return (
        <div style={style} className={cn("togglefield", styles.togglefield, center && "centered", center && styles.centered, disabled && "disabled", disabled && styles.disabled, small && styles.small)} data-title={translateText(title || label)} role="switch" aria-checked={checkedValue} tabIndex={disabled ? undefined : 0} onClick={toggle} onKeyDown={onKeyDown}>
            <div className={styles.background} />
            <div className={styles.hover} />

            <input type="checkbox" checked={checkedValue} readOnly id={id} disabled={disabled} className={styles.hiddenInput} tabIndex={-1} aria-hidden="true" />

            {label ? (
                <label htmlFor={id} className={styles.toggleLabel}>
                    <span className={styles.labelText}>
                        {translateText(label, dict)}

                        {data ? <span className={styles.data}>{data}</span> : null}
                    </span>

                    {defaultValue !== null ? <span className={cn(styles.changed, defaultValue === checkedValue && styles.hidden)}></span> : null}
                </label>
            ) : null}

            <div className={styles.switch}>
                <div className={styles.thumb} />
            </div>

            <span className={styles.underline} />
        </div>
    )
}
