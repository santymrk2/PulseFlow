import { translateText } from "../../../shared/utils/language"
import styles from "./HRule.module.css"

// Línea con un título centrado. Sin título, sólo la línea.
export interface HRuleProps {
    title?: string
}

export function HRule({ title = "" }: HRuleProps) {
    return <div className={styles.title}>{title ? <span className={styles.label}>{translateText(title)}</span> : null}</div>
}
