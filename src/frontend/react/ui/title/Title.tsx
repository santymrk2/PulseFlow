import { cn } from "../../../shared/core/lib/utils"
import { dictionary } from "../../../shared/core/stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import styles from "./Title.module.css"

// Título de sección con ícono. `title` es el tooltip (data-title).
export interface TitleProps {
    label: string
    icon: string
    title?: string
    center?: boolean
}

export function Title({ label, icon, title = "", center = false }: TitleProps) {
    const dict = useStore(dictionary)
    return (
        <h3 className={cn(styles.title, center && styles.center)} data-title={translateText(title)}>
            <Icon id={icon} white />
            {translateText(label, dict)}
        </h3>
    )
}
