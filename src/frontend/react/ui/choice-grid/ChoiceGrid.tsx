import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import { Button } from "../button/Button"
import styles from "./ChoiceGrid.module.css"

// dispatch("click", id: string) → onClick(id); con canDeselect, volver a elegir el activo despacha "".
export interface ChoiceOption {
    id: string
    name: string
    title?: string
    icon: string
    tip?: string
    disabled?: boolean
    colored?: boolean
}

export interface ChoiceGridProps {
    options?: ChoiceOption[]
    value?: string
    highlightFirst?: boolean
    canDeselect?: boolean
    onClick?: (id: string) => void
}

export function ChoiceGrid({ options = [], value = "", highlightFirst = true, canDeselect = false, onClick }: ChoiceGridProps) {
    function click(id: string) {
        if (canDeselect && value === id) onClick?.("")
        else onClick?.(id)
    }

    return (
        <div className={cn(styles.choice, highlightFirst && styles.highlightFirst)}>
            {options.map((option, i) => (
                <Button key={i} title={option.title || option.name} disabled={option.disabled} className={i === 0 ? "first" : i === options.length - 1 ? "last" : ""} variant="outline" isActive={option.id === value} onClick={() => click(option.id)} white>
                    <div className={styles.list}>
                        {option.icon.includes(".webp") ? <img className={styles.logo} src={option.icon} alt={`${option.id}-logo`} draggable={false} /> : <Icon id={option.icon} size={5} white={!option.colored} />}
                        <div className={styles.text}>
                            <p>{option.name}</p>
                            {option.tip ? <p className={styles.tip}>{option.tip}</p> : null}
                        </div>
                    </div>
                </Button>
            ))}
        </div>
    )
}
