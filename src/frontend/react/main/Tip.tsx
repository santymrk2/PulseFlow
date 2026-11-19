import { translateText } from "../../shared/utils/language"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { Icon } from "../../shared/ui/helpers/Icon"
import { markTipString } from "../../components/main/tipWordDictionary"
import styles from "./Tip.module.css"

export interface TipProps {
    value: string
    type?: "tip" | "info" | "warning"
    hiddenText?: boolean
    white?: boolean
    style?: string
    top?: number
    bottom?: number
}

export function Tip({ value, type = "tip", hiddenText = false, white = false, style = "", top = 0, bottom = 0 }: TipProps) {
    const translatedValue = translateText(value)
    const markedValue = markTipString(translatedValue)

    return (
        <div className={`${styles.tip} ${styles[type] || ""}`} style={{ marginTop: `${top}px`, marginBottom: `${bottom}px`, cursor: hiddenText ? "help" : undefined, ...(style ? cssTextToStyle(style) : {}) }} data-title={hiddenText ? translatedValue : ""}>
            <Icon id={type} size={hiddenText ? 1 : 1.2} color={type === "warning" ? "var(--warning)" : ""} white={white || type === "warning"} />
            {!hiddenText ? <p dangerouslySetInnerHTML={{ __html: markedValue }} /> : null}
        </div>
    )
}
