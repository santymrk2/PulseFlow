import { dictionary } from "../../core/stores"
import { useStore } from "../hooks/useStore"

export interface TProps {
    id: string
    index?: number
    lowercase?: boolean
    replace?: string[]
}

// Port de components/helpers/T.svelte: "categoria.clave", marcadores "$:" y ":$" ignorados, $1…$n reemplazados
export function T({ id, index = 0, lowercase = false, replace = [] }: TProps) {
    const dict = useStore(dictionary)
    const hasPeriod = id.includes(".")
    const periodIndex = id.indexOf(".")
    const category = hasPeriod ? id.slice(0, periodIndex).replace("$:", "") : ""
    const key = hasPeriod ? id.slice(periodIndex + 1).replace(":$", "") : ""
    const text = replacePlaceholders(dict[category]?.[key] || "", replace)

    if (text.includes("{}")) return text.split("{}")[index] || `[${id}]`
    if (lowercase) return text.toLowerCase() || `[${id}]`
    return text || `[${id}]`
}

function replacePlaceholders(input: string, values: string[]): string {
    if (!values.length) return input
    return input.replace(/\$(\d+)/g, (_, idx: string) => values[Number(idx) - 1] || "")
}
