import { cn } from "../../../lib/utils"
import { dictionary } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import { InputRow } from "../input-row/InputRow"
import styles from "./SegmentedField.module.css"

// Port de ui/segmented-field/segmented-field.svelte. dispatch("click", string) → onClick(string): el `value` de la opción elegida.
export interface SegmentedOption {
    value: string
    label: string
    icon?: string
    disabled?: boolean
}

export interface SegmentedFieldProps {
    label: string
    icon?: string
    iconColor?: string
    value: string
    options: SegmentedOption[]
    noLabels?: boolean
    onClick?: (value: string) => void
}

export function SegmentedField({ label, icon = "", iconColor = "", value, options, noLabels = false, onClick }: SegmentedFieldProps) {
    useStore(dictionary)

    return (
        <div className={styles.toggles}>
            <label className={cn(styles.label, value && "selected")}>
                {icon ? <Icon id={icon} color={iconColor} boxed={!!iconColor} white /> : null}
                {translateText(label)}
            </label>

            <InputRow>
                {options.map((option, i) => (
                    <Button key={i} style={{ minWidth: "50px" }} title={option.label} icon={option.icon} disabled={!!option.disabled} onClick={() => onClick?.(option.value)} white={noLabels}>
                        {!noLabels ? translateText(option.label) : null}

                        <div className={cn(styles.highlight, value.includes(option.value) && styles.active)}></div>
                    </Button>
                ))}
            </InputRow>
        </div>
    )
}
