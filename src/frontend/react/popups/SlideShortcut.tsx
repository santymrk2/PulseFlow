// Port de components/main/popups/SlideShortcut.svelte. Lee (una vez, al montar) popupData.index/mode/revert/active/value/trigger/existingShortcuts
// y el layout activo. Escribe: popupData (mode: "" o {}) y activePopup al montar; history SHOW_LAYOUT o trigger(key) al asignar, y activePopup = revert || null.
// Tip usa el port React.
import { useEffect, useState } from "react"
import { get } from "../../shared/core/lib/store"
import { history } from "../../shared/utils/helpers/history"
import { getLayoutRef } from "../../shared/utils/helpers/show"
import { Tip } from "../main/Tip"
import type { Popups } from "../../../types/Main"
import { activePopup, popupData } from "../../shared/core/stores"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./SlideShortcut.module.css"

interface SlideShortcutData {
    index: number
    mode: string
    revert: string | null
    trigger: ((key: string) => void) | null
    existingShortcuts: unknown[]
    slideDataActions: Record<string, unknown>
    currentShortcut: string
}

function initialData(): SlideShortcutData {
    const data = get(popupData)
    const index = data.index as number
    const mode = (data.mode as string) || ""
    const revert = (data.revert as string | null) || null
    const value = (data.active || data.value || "") as string
    const trigger = typeof data.trigger === "function" ? (data.trigger as (key: string) => void) : null
    const existingShortcuts = (data.existingShortcuts || []) as unknown[]

    const layoutRef = mode === "slide_shortcut" ? getLayoutRef() : []
    const slideDataActions = mode === "slide_shortcut" ? ((layoutRef[index]?.data?.actions || {}) as Record<string, unknown>) : {}
    const currentShortcut = mode === "slide_shortcut" ? (slideDataActions.slide_shortcut as { key?: string } | undefined)?.key || "" : value

    return { index, mode, revert, trigger, existingShortcuts, slideDataActions, currentShortcut }
}

export function SlideShortcut() {
    const [data] = useState(initialData)
    const [existing, setExisting] = useState(false)
    const [currentShortcut, setCurrentShortcut] = useState(data.currentShortcut)

    useEffect(() => {
        if (data.mode === "action") popupData.set({ ...get(popupData), mode: "" })
        else popupData.set({})
        if (data.mode !== "slide_shortcut" && data.mode !== "global_group" && data.mode !== "action") activePopup.set(null)
    }, [data])

    function updateValue(key: string) {
        if (data.existingShortcuts.find((a) => String(a).toLowerCase() === key)) {
            setExisting(true)
            return
        }
        setExisting(false)
        setCurrentShortcut(key)

        if (data.mode === "slide_shortcut") {
            data.slideDataActions.slide_shortcut = { key }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: data.slideDataActions, indexes: [data.index] } })
        } else if (data.trigger) {
            data.trigger(key)
        }

        activePopup.set((data.revert || null) as Popups | null)
    }

    function keydown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (!e.key || e.key.trim().length !== 1 || !Number.isNaN(Number(e.key))) return

        const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
        if (isSpecial) return

        updateValue(e.key.toLowerCase())
    }

    useEffect(() => {
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [])

    return (
        <>
            {data.revert ? <Button className="popup-back" icon="back" iconSize={1.3} title="actions.back" onClick={() => activePopup.set(data.revert as unknown as Popups)} /> : null}

            {existing ? <Tip type="warning" value="actions.shortcut_existing" /> : <Tip value="actions.press_to_assign" />}

            {currentShortcut ? <div className={styles.shortcut}>{currentShortcut}</div> : null}
        </>
    )
}
