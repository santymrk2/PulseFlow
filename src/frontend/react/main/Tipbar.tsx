import { useState } from "react"
import { activePopup, guideActive, isDev, special } from "../../shared/core/stores"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Icon } from "../../shared/ui/helpers/Icon"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./Tipbar.module.css"

const ONE_DAY = 1000 * 60 * 60 * 24

const messages = {
    donate: "FreeShow is free because of the generous gifts of our users. Would you consider donating to FreeShow? With your help we can continue to meet the tech needs of the Church."
}

export function Tipbar() {
    const popup = useStore(activePopup)
    const guide = useStore(guideActive)
    const dev = useStore(isDev)
    const specialValue = useStore(special)

    const activeMessage = "donate" as const
    const message = messages[activeMessage]
    const key = `tipbar_${activeMessage}`

    const lastClosed = (specialValue[`${key}_closed`] as number | undefined) || 0
    const lastInteracted = (specialValue[`${key}_interacted`] as number | undefined) || 0
    const now = Date.now()
    const recentlyInteracted = lastInteracted ? now - lastInteracted < ONE_DAY * 14 : now - lastClosed < ONE_DAY * 7
    const initialClosed = recentlyInteracted || Math.random() > 0.3 || new Date().getMonth() !== 11 || new Date().getFullYear() !== 2026

    const [closed, setClosed] = useState(initialClosed)

    const isClosed = closed || popup === "initialize" || guide

    function close() {
        setClosed(true)
        special.update((a) => {
            a[`${key}_closed`] = Date.now()
            return a
        })
    }

    function interact() {
        setClosed(true)
        special.update((a) => {
            a[`${key}_interacted`] = Date.now()
            return a
        })
    }

    function donate() {
        sendMain(Main.URL, "https://churchapps.org/partner#give")
        interact()
    }

    if (isClosed || dev) return null

    return (
        <section className={styles.toolbar}>
            <div className={styles.text}>
                {activeMessage === "donate" ? <Icon id="heart" right size={0.8} white /> : null}
                {message}
                {activeMessage === "donate" ? (
                    <Button variant="outline" style={{ marginLeft: "10px", padding: "2px 10px" }} onClick={() => donate()}>
                        <span style={{ fontWeight: 600 }}>Donate</span>
                        <Icon id="launch" white />
                    </Button>
                ) : null}
            </div>

            <div>
                <Button style={{ padding: "6px" }} title="actions.close" icon="close" onClick={() => close()} />
            </div>
        </section>
    )
}
