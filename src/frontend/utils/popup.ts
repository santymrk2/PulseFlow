import { get } from "../shared/core/lib/store"
import type { Popups } from "../../types/Main"
import { activePopup, popupData } from "../shared/core/stores"

export function waitForPopupData(popupId: Popups): Promise<any> {
    const promise = new Promise((resolve) => {
        let unsubscribe = () => {}

        // check that popup is still active
        const interval = setInterval(() => {
            if (get(activePopup) !== popupId) finish(undefined)
        }, 300)

        unsubscribe = popupData.subscribe((a) => {
            if (!a || a.id !== popupId) return
            activePopup.set(null)
            finish(a.value)
        })

        function finish(value) {
            if (unsubscribe) unsubscribe()
            clearInterval(interval)
            setTimeout(() => {
                resolve(value)
            }, 50)
        }
    })

    popupData.set({ ...get(popupData), id: "", value: "" })
    activePopup.set(popupId)

    return promise
}

export async function confirmCustom(prompt: string) {
    popupData.set({ prompt })
    const data = await waitForPopupData("confirm")
    return !!data
}

export async function promptCustom(prompt: string, inputType: string = "text", message: string = "") {
    popupData.set({ prompt, inputType, message })
    const data = (await waitForPopupData("confirm")) || ""
    return data as string
}

// Enter to submit

let activeSubmit: (() => void) | null = null

// Para React (sin ciclo de vida de Svelte): devuelve la función que lo desregistra, para la limpieza del efecto.
export function setPopupSubmit(submit: () => void): () => void {
    activeSubmit = submit

    return () => {
        if (activeSubmit === submit) activeSubmit = null
    }
}

export function triggerPopupSubmit(e?: KeyboardEvent): boolean {
    if (!activeSubmit) return false

    const target = e?.target as HTMLElement | null
    if (target?.closest("textarea, [contenteditable='true'], button, [role], .editItem")) return false

    activeSubmit()
    return true
}

export function clearPopupSubmit() {
    activeSubmit = null
}
