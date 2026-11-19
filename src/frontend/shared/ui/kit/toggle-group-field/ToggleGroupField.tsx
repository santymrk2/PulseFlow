import { cn } from "../../../core/lib/utils"
import { dictionary } from "../../../core/stores"
import { translateText } from "../../../utils/language"
import { usePropState } from "../../hooks/usePropState"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import { InputRow } from "../input-row/InputRow"
import styles from "./ToggleGroupField.module.css"

// dispatch("change", string[]) → onChange(string[]).
// Svelte mutaba el array de la prop con splice; acá se arma un array nuevo (mismo contenido en el detail, sin mutar al padre).
export interface ToggleGroupOption {
    label: string
    value: string
    icon?: string
}

export interface ToggleGroupFieldProps {
    label: string
    value: string[]
    options: ToggleGroupOption[]
    onChange?: (value: string[]) => void
}

export function ToggleGroupField({ label, value: valueProp, options, onChange }: ToggleGroupFieldProps) {
    useStore(dictionary)
    const [value, setValue] = usePropState(valueProp)

    function toggleOption(id: string) {
        let next = [...value]
        if (next.includes(id)) next.splice(next.indexOf(id), 1)
        else next = [...new Set([...next, id])]

        setValue(next)
        onChange?.(next)
    }

    return (
        <div className={styles.toggles}>
            <label className={cn(styles.label, value && "selected")}>{translateText(label)}</label>

            <InputRow>
                {options.map((option, i) => (
                    <Button key={i} icon={option.icon} onClick={() => toggleOption(option.value)}>
                        {translateText(option.label)}

                        <div className={cn(styles.highlight, value.includes(option.value) && styles.active)}></div>
                    </Button>
                ))}
            </InputRow>
        </div>
    )
}
