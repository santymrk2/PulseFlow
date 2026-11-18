import { useEffect, useState } from "react"
import { get } from "../../../lib/store"
import type { Item } from "../../../../types/Show"
import { variableText } from "../../../components/helpers/dynamicItemText"
import { setDrawerTabData } from "../../../components/helpers/historyHelpers"
import { replaceDynamicValues } from "../../../components/helpers/showActions"
import { activeDrawerTab, drawer, variables } from "../../../stores"
import { cn } from "../../../lib/utils"
import { cssTextToStyle } from "../../helpers/cssTextToStyle"
import { useStore } from "../../hooks/useStore"
import styles from "./Variable.module.css"

export interface VariableRef {
    type?: "show" | "stage" | "overlay" | "template"
    showId?: string
    slideId?: string
    layoutId?: string
    id: string
    slideIndex?: number
    mode?: string
}

export interface VariableProps {
    id?: string
    item?: Item | null
    style?: string
    edit?: boolean
    hideText?: boolean
    ref?: VariableRef
}

// Port de components/slide/views/Variable.svelte (F24.18a). Los valores dinámicos (e.g. {time_}) se refrescan
// cada segundo sólo cuando el texto de la variable contiene "{", igual que en el Svelte.
export function Variable({ id = "", item = null, style = "", edit = false, hideText = true, ref = { id: "" } }: VariableProps) {
    const allVariables = useStore(variables)
    const variable = allVariables[id || item?.variable?.id] || {}
    const hasDynamicValues = variable.text?.includes("{") || false
    const [updateDynamic, setUpdateDynamic] = useState(0)

    useEffect(() => {
        if (!hasDynamicValues) return
        const interval = setInterval(() => setUpdateDynamic((value) => value + 1), 1000)
        return () => clearInterval(interval)
    }, [hasDynamicValues])

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("functions", "variables")
        activeDrawerTab.set("functions")

        const current = get(drawer)
        if (current.height <= 40) drawer.set({ height: current.stored || 300, stored: null })
    }

    return (
        <div className={cn(styles.align, "autoFontSize", variable.enabled === false && styles.hidden)} style={cssTextToStyle(`${style}${item?.align || ""}`)} onDoubleClick={openInDrawer}>
            <div className={styles.line}>{variable.type === "number" ? variableText(variable) : variable.type === "text" ? replaceDynamicValues(variableText(variable, hideText), ref, updateDynamic) : null}</div>
        </div>
    )
}
