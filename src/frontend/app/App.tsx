import { useEffect, useState } from "react"
import { activeProfile, closeAd, currentWindow, loaded, os, profiles, settingsOpen, theme, themes } from "../shared/core/stores"
import { focusArea, logerror, mainClick } from "../shared/utils/common"
import { keydown } from "./wiring/shortcuts"
import { startup, startupAppEffects } from "./wiring/startup"
import { getContrast } from "../shared/utils/helpers/color"
import { cssTextToStyle } from "../shared/ui/helpers/cssTextToStyle"
import { useStore } from "../shared/ui/hooks/useStore"
import { Loader } from "./main/Loader"
import { MenuBar } from "./main/MenuBar"
import { Popup } from "./main/Popup"
import { ProgressPanel } from "./main/ProgressPanel"
import { ProfileSelector } from "./main/ProfileSelector"
import { Recorder } from "./main/Recorder"
import { StatusIndicator } from "./main/StatusIndicator"
import { Toast } from "./main/Toast"
import { TooltipManager } from "./main/TooltipManager"
import { MainLayout } from "./MainLayout"
import { SettingsModal } from "../features/settings/SettingsModal"
import { ContextMenu } from "../shared/ui/context/ContextMenu"
import { Pdf } from "../features/export/Pdf"
import { Guide } from "./guide/Guide"
import { QuickSearch } from "../features/quicksearch/QuickSearch"
import { ErrorBoundary } from "./ErrorBoundary"
import styles from "./App.module.css"

let startupCalled = false

export function App() {
    const windowType = useStore(currentWindow)
    const osValue = useStore(os)
    const themesValue = useStore(themes)
    const themeId = useStore(theme)
    const isLoaded = useStore(loaded)
    const closeAdValue = useStore(closeAd)
    const profilesValue = useStore(profiles)
    const activeProfileId = useStore(activeProfile)
    const settingsOpenValue = useStore(settingsOpen)

    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (startupCalled) return
        startupCalled = true
        void startup()
        startupAppEffects()
    }, [])

    useEffect(() => {
        window.addEventListener("keydown", keydown)
        window.addEventListener("mousedown", focusArea)
        window.addEventListener("click", mainClick)
        window.addEventListener("error", logerror as EventListener)
        window.addEventListener("unhandledrejection", logerror as EventListener)
        return () => {
            window.removeEventListener("keydown", keydown)
            window.removeEventListener("mousedown", focusArea)
            window.removeEventListener("click", mainClick)
            window.removeEventListener("error", logerror as EventListener)
            window.removeEventListener("unhandledrejection", logerror as EventListener)
        }
    }, [])

    useEffect(() => {
        if (!isLoaded) return
        const timer = setTimeout(() => {
            setReady(true)
        }, 51)
        return () => clearTimeout(timer)
    }, [isLoaded])

    if (windowType === "pdf") {
        return <Pdf />
    }

    const isWindows = !windowType && osValue.platform === "win32"
    const contrastColor = getContrast(themesValue[themeId]?.colors?.secondary || "")
    const secondaryContrast = `--secondary-text: ${contrastColor === "#000000" ? "#131313" : "#f0f0ff"};`
    const globalStyle = `${isWindows ? "height: calc(100% - 25px);" : ""}${secondaryContrast}`

    const profileCount = Object.keys(profilesValue).filter((a) => a !== "admin").length
    const showProfileSelector = ready && profileCount > 0 && activeProfileId === null

    return (
        <ErrorBoundary>
            {isWindows ? <MenuBar /> : null}

            <main style={cssTextToStyle(globalStyle)} className={`${styles.main}${closeAdValue ? ` ${styles.closeAd}` : ""}`}>
                <ContextMenu />
                <TooltipManager />

                {isLoaded ? (
                    <>
                        {settingsOpenValue ? <SettingsModal /> : null}
                        <Popup />
                        <QuickSearch />
                        <Toast />
                        <StatusIndicator />
                        <Recorder />
                        <Guide />
                        <ProgressPanel />

                        <MainLayout />

                        {showProfileSelector ? <ProfileSelector /> : null}
                    </>
                ) : (
                    <div className={styles.center}>
                        <Loader size={2} />
                    </div>
                )}
            </main>
        </ErrorBoundary>
    )
}
