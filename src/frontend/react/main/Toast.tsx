import { useEffect, useRef } from "react"
import { toastMessages } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { useStore } from "../hooks/useStore"
import styles from "./Toast.module.css"

const toastDuration = 4000 // ms

const clearEarly = [
    { if: "toast.saving", when: "toast.saved" },
    { if: "cloud.syncing", when: "cloud.sync_complete" },
    { if: "error.media", when: "toast.media_replaced" },
    { if: "settings.backup_started", when: "settings.backup_finished" },
    { if: "settings.restore_started", when: "settings.restore_finished" },
    { if: "toast.recording_started", when: "toast.recording_stopped" },
    { if: "actions.copied", when: "actions.pasted" }
]

function removeCurrent() {
    toastMessages.update((a) => {
        a.shift()
        return a
    })
}

export function Toast() {
    const messages = useStore(toastMessages)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const first = messages?.[0]

    useEffect(() => {
        if (!messages?.length) return

        if (clearEarly.find((c) => messages[0] === c.if && messages.find((a) => a === c.when))) {
            if (timer.current) clearTimeout(timer.current)
            timer.current = null
            removeCurrent()
            return
        }

        if (timer.current) return
        timer.current = setTimeout(() => {
            timer.current = null
            if (!messages.length) return
            removeCurrent()
        }, toastDuration)
    }, [messages])

    useEffect(() => {
        return () => {
            if (timer.current) clearTimeout(timer.current)
        }
    }, [])

    if (!first) return null

    return <div className={styles.toast}>{translateText(first)}</div>
}
