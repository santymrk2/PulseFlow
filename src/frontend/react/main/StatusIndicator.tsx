import { useEffect, useRef, useState } from "react"
import { os, statusIndicator } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { openSettings } from "../../components/settings/openSettings"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import styles from "./StatusIndicator.module.css"

const titles: Record<string, string> = {
    saving: "toast.saving",
    saved: "toast.saved",
    syncing: "cloud.syncing",
    synced: "cloud.sync_complete",
    copied: "actions.copied",
    pasted: "actions.pasted",
    duplicated: "actions.duplicated",
    error: "Error"
}

export function StatusIndicator() {
    const osValue = useStore(os)
    const indicatorValue = useStore(statusIndicator)
    const [indicatorId, setIndicatorId] = useState("")
    const maxTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const indicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const indicatorIdRef = useRef("")

    const isWindows = osValue.platform === "win32"

    function onClick() {
        switch (indicatorId) {
            case "saving":
            case "saved":
            case "syncing":
            case "synced":
                openSettings("files")
                break
        }
    }

    useEffect(() => {
        indicatorIdRef.current = indicatorId
    }, [indicatorId])

    useEffect(() => {
        if (indicatorTimeout.current) {
            if (indicatorValue && indicatorIdRef.current) setIndicatorId(indicatorValue)
            return
        }

        const next = indicatorValue || ""
        setIndicatorId(next)
        indicatorTimeout.current = setTimeout(() => {
            indicatorTimeout.current = null
            if (indicatorValue !== next) {
                // re-run logic on next effect via state update trigger not needed; just sync
                setIndicatorId(indicatorValue || "")
            } else if (maxTimeout.current) {
                clearTimeout(maxTimeout.current)
            }
        }, 301)

        if (maxTimeout.current) clearTimeout(maxTimeout.current)
        maxTimeout.current = setTimeout(() => {
            if (indicatorTimeout.current) clearTimeout(indicatorTimeout.current)
            indicatorTimeout.current = null
            setIndicatorId("")
        }, 10000)
    }, [indicatorValue])

    useEffect(() => {
        return () => {
            if (maxTimeout.current) clearTimeout(maxTimeout.current)
            if (indicatorTimeout.current) clearTimeout(indicatorTimeout.current)
        }
    }, [])

    if (!indicatorId) return null

    return (
        <div className={styles.status} style={isWindows ? { transform: "translateY(25px)" } : undefined} role="none" data-title={translateText(titles[indicatorId] || "")} onClick={onClick}>
            <div className={styles[indicatorId] || indicatorId}>
                {indicatorId === "saving" ? (
                    <Icon id="save" white />
                ) : indicatorId === "saved" ? (
                    <>
                        <Icon id="save" white />
                        <div className={styles.marker}>
                            <Icon id="check" size={0.5} white />
                        </div>
                    </>
                ) : indicatorId === "syncing" ? (
                    <Icon id="loop" white />
                ) : indicatorId === "synced" ? (
                    <Icon id="cloud_done" white />
                ) : indicatorId === "copied" ? (
                    <Icon id="copy" white />
                ) : indicatorId === "pasted" ? (
                    <Icon id="paste" white />
                ) : indicatorId === "duplicated" ? (
                    <Icon id="duplicate" white />
                ) : indicatorId === "error" ? (
                    <Icon id="close" white />
                ) : null}
            </div>
        </div>
    )
}
