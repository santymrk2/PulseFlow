import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { cn } from "../../../lib/utils"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { usePropState } from "../../hooks/usePropState"
import styles from "./CheckboxField.module.css"

// Port de ui/checkbox-field/checkbox-field.svelte. dispatch("change", boolean) → onChange(boolean).
export interface CheckboxFieldProps {
    checked?: boolean
    defaultValue?: boolean | null
    label: string
    icon?: string
    title?: string
    data?: ReactNode
    id?: string
    disabled?: boolean
    center?: boolean
    small?: boolean
    style?: CSSProperties
    onChange?: (checked: boolean) => void
}

export function CheckboxField({ checked = false, defaultValue = null, label, icon = "", title = "", data = null, id = "", disabled = false, center = false, small = false, style, onChange }: CheckboxFieldProps) {
    const [checkedValue, setCheckedValue] = usePropState(!!checked)

    function toggle() {
        if (disabled) return
        setCheckedValue(!checkedValue)
        onChange?.(!checkedValue)
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (disabled) return
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            toggle()
        }
    }

    return (
        <div style={style} className={cn("checkboxfield", styles.checkboxfield, center && "centered", center && styles.centered, disabled && "disabled", disabled && styles.disabled, small && styles.small)} data-title={translateText(title || label)} role="checkbox" aria-checked={checkedValue} tabIndex={disabled ? undefined : 0} onClick={toggle} onKeyDown={onKeyDown}>
            <div className={styles.background} />
            <div className={cn(styles.hover, "hover")} />

            <input type="checkbox" checked={checkedValue} readOnly id={id} disabled={disabled} className={styles.hiddenInput} tabIndex={-1} aria-hidden="true" />

            <label htmlFor={id} className={styles.checkboxLabel}>
                <div className={styles.customCheckbox} aria-hidden="true">
                    <svg className={styles.checkmark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4.5 12.5l4 4L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                {icon ? <Icon id={icon} style={{ margin: "0 2px 0 6px" }} white /> : null}

                <span className={styles.labelText} dangerouslySetInnerHTML={{ __html: translateText(label) }} />

                {data ? <span className={styles.data}>{data}</span> : null}

                {defaultValue !== null ? <span className={cn(styles.changed, defaultValue === checkedValue && styles.hidden)}></span> : null}
            </label>

            <span className={styles.underline} />
        </div>
    )
}
