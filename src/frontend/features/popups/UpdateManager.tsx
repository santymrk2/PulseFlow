import { useEffect, useRef, useState } from "react"
import { Loader } from "../../app/main/Loader"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { alertUpdates, special, version } from "../../shared/core/stores"
import { getUpdateData } from "../../shared/utils/checkForUpdates"
import { setPopupSubmit } from "../../shared/utils/popup"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import { ToggleField } from "../../shared/ui/kit/toggle-field/ToggleField"
import styles from "./UpdateManager.module.css"

// Port de components/main/popups/UpdateManager.svelte. Lee: version, special y alertUpdates; escribe special y
// Main.URL al descargar. Loader es el port React. El changelog es el mismo HTML saneado por la fuente del Svelte.
export function UpdateManager() {
    const versionValue = useStore(version)
    const specialValue = useStore(special)
    const alertUpdatesValue = useStore(alertUpdates)

    const [loading, setLoading] = useState(true)
    const [hasError, setHasError] = useState(false)
    const [latestVersion, setLatestVersion] = useState("")
    const [changelog, setChangelog] = useState("")
    const [hasUpdate, setHasUpdate] = useState(false)
    const [updatesOpen, setUpdatesOpen] = useState(true)

    function updateSpecial(value: boolean, key: string) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value
            return a
        })
    }

    async function checkUpdates() {
        setLoading(true)
        setHasError(false)
        setLatestVersion("")
        setChangelog("")
        setHasUpdate(false)

        try {
            const currentVersion = versionValue
            const includeBeta = currentVersion.includes("-beta") || !!specialValue.betaVersionAlert
            const updateData = await getUpdateData(currentVersion, includeBeta)

            setLatestVersion(updateData.latestVersion)
            setChangelog((updateData.changelog || "").replaceAll("\r\n", "<br>").replaceAll("-", "•"))
            setHasUpdate(updateData.hasUpdate)
        } catch (error) {
            console.warn(error)
            setHasError(true)
        }

        setLoading(false)
    }

    function downloadLatest() {
        if (!hasUpdate || !latestVersion) return
        sendMain(Main.URL, "https://github.com/santymrk2/PulseFlow/releases")
    }

    useEffect(() => {
        void checkUpdates()
    }, [])

    // Enter: el registro se hace una vez y la envoltura lee siempre el último estado
    const live = useRef(downloadLatest)
    useEffect(() => {
        live.current = downloadLatest
    })
    useEffect(() => setPopupSubmit(() => live.current()), [])

    const isBeta = versionValue.includes("-beta")
    const versionsMatch = !!latestVersion && versionValue === latestVersion

    return (
        <>
            <div className={styles.settings}>
                <InputRow arrow={true} open={updatesOpen} onOpenChange={setUpdatesOpen} menu={<ToggleField label="settings.alert_updates_beta" disabled={isBeta} checked={isBeta ? !!alertUpdatesValue : !!specialValue.betaVersionAlert} defaultValue={false} onChange={(value) => updateSpecial(value, "betaVersionAlert")} />}>
                    <ToggleField style={{ flex: 1 }} label="settings.alert_updates" checked={!!alertUpdatesValue} defaultValue={true} onChange={(value) => alertUpdates.set(value)} />
                </InputRow>

                <ToggleField label="settings.auto_updates" checked={!!specialValue.autoUpdates} onChange={(value) => updateSpecial(value, "autoUpdates")} />
            </div>

            {!loading && !versionsMatch && latestVersion ? (
                <div className={styles.versions}>
                    <span className={styles.value}>v{versionValue}</span>
                    <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>→</span>
                    <span className={styles.value}>v{latestVersion}</span>
                </div>
            ) : null}

            {hasUpdate ? (
                <Button variant="default" style={{ marginTop: "10px" }} icon="download" onClick={downloadLatest}>
                    <T id="about.download_latest" />
                </Button>
            ) : !loading && !hasError ? (
                <div className={styles.versions}>
                    <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>✓</span>
                    <span className={styles.value}>v{latestVersion}</span>
                </div>
            ) : null}

            {loading ? (
                <div className={styles.loading}>
                    <Loader />
                </div>
            ) : hasError || hasUpdate ? (
                <div className={styles.changelog}>
                    <h3 className={styles.title}>
                        <T id="about.changes" />
                    </h3>

                    {hasError ? <p>Error: Could not check for updates right now.</p> : changelog ? <div className={styles["changelog-content"]} dangerouslySetInnerHTML={{ __html: changelog }} /> : null}
                </div>
            ) : null}
        </>
    )
}
