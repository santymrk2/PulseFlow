import { useEffect } from "react"
import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, popupData, special } from "../../shared/core/stores"
import { setPopupSubmit } from "../../shared/utils/popup"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { HRule } from "../../shared/ui/kit/h-rule/HRule"
import styles from "./NewUpdate.module.css"

// Port de components/main/popups/NewUpdate.svelte. Lee: popupData.changelog (al montar) y special.autoUpdates.
// Escribe: sendMain(Main.URL, releases) y activePopup = null + popupData = {} al descargar (botón o Enter).
export function NewUpdate() {
    const specialValue = useStore(special)
    const changelog = (get(popupData).changelog || "").replaceAll("\r\n", "<br>").replaceAll("-", "•")

    function download() {
        sendMain(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")

        activePopup.set(null)
        popupData.set({})
    }

    useEffect(() => setPopupSubmit(download), [])

    return (
        <>
            {specialValue.autoUpdates ? (
                <>
                    <div className={styles.auto_update}>
                        <T id="about.download_auto" />
                    </div>

                    <HRule title="setup.or" />
                </>
            ) : null}

            <Button variant="default" icon="download" onClick={download}>
                <T id="about.download_latest" />
            </Button>

            <div className={styles.changelog}>
                <h3 style={{ color: "var(--text)", textDecoration: "underline solid var(--secondary)" }}>
                    <T id="about.changes" />
                </h3>
                <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: changelog }} />
            </div>
        </>
    )
}
