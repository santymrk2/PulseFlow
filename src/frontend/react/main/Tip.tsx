import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
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
        <div
            className={`${styles.tip} ${styles[type] || ""}`}
            style={{ marginTop: `${top}px`, marginBottom: `${bottom}px`, cursor: hiddenText ? "help" : undefined, ...(style ? parseInlineStyle(style) : {}) }}
            data-title={hiddenText ? translatedValue : ""}
        >
            <Icon id={type} size={hiddenText ? 1 : 1.2} color={type === "warning" ? "var(--warning)" : ""} white={white || type === "warning"} />
            {!hiddenText ? <p dangerouslySetInnerHTML={{ __html: markedValue }} /> : null}
        </div>
    )
}

function parseInlineStyle(style: string): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    for (const decl of style.split(";")) {
        const idx = decl.indexOf(":")
        if (idx === -1) continue
        const prop = decl.slice(0, idx).trim()
        const value = decl.slice(idx + 1).trim()
        if (!prop) continue
        const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        out[camel] = value
    }
    return out
}
