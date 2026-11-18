import { useEffect, useState } from "react"
import { activeProfile, closeAd, currentWindow, loaded, os, profiles, theme, themes } from "../stores"
import { focusArea, logerror, mainClick } from "../utils/common"
import { keydown } from "../utils/shortcuts"
import { startup, startupAppEffects } from "../utils/startup"
import { getContrast } from "../components/helpers/color"
import { useStore } from "./hooks/useStore"
import { SvelteIsland } from "./bridge/SvelteIsland"
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
import SettingsModal from "../components/settings/SettingsModal.svelte"
import { ContextMenu } from "./context/ContextMenu"
import { Pdf } from "./export/Pdf"
import { Guide } from "./guide/Guide"
import { QuickSearch } from "./quicksearch/QuickSearch"
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
        <>
            {isWindows ? <MenuBar /> : null}

            <main style={parseInlineStyle(globalStyle)} className={`${styles.main}${closeAdValue ? ` ${styles.closeAd}` : ""}`}>
                <ContextMenu />
                <TooltipManager />

                {isLoaded ? (
                    <>
                        <SvelteIsland component={SettingsModal} />
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
        </>
    )
}

function parseInlineStyle(style: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const decl of style.split(";")) {
        const idx = decl.indexOf(":")
        if (idx === -1) continue
        const prop = decl.slice(0, idx).trim()
        const value = decl.slice(idx + 1).trim()
        if (!prop) continue
        const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        out[camel] = value
    }
    return out
}
