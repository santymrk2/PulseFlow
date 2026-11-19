import { useEffect } from "react"
import type { SettingsTabs as SettingsTabId } from "../../../types/Tabs"
import { cn } from "../../shared/core/lib/utils"
import { activeProfile, profiles, settingsTab } from "../../shared/core/stores"
import { settingsTabs } from "../../shared/core/values/tabs"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import styles from "./SettingsTabs.module.css"

// Port de components/settings/SettingsTabs.svelte (F24.12)
export function SettingsTabs() {
    const currentTab = useStore(settingsTab)
    const allProfiles = useStore(profiles)
    const activeProfileId = useStore(activeProfile)
    const profile = allProfiles[activeProfileId || ""]
    const activeTabs: SettingsTabId[] = profile ? settingsTabs.filter((tabId) => profile.access.settings?.[tabId] !== "none") : [...settingsTabs]

    // Se vuelve a registrar con cada cambio de pestañas o de pestaña activa: lee siempre lo último, como el `$settingsTab` del Svelte
    useEffect(() => {
        function keydown(e: KeyboardEvent) {
            if ((e.target as Element | null)?.closest?.(".edit") || e.ctrlKey || e.metaKey) return

            let nextTab = -1
            const currentTabIndex = activeTabs.findIndex((tab) => tab === currentTab)

            if (e.key === "ArrowDown") {
                e.preventDefault()

                nextTab = Math.min(activeTabs.length - 1, currentTabIndex + 1)

                if ((currentTabIndex + 1 >= activeTabs.length || currentTab === "profiles") && !activeTabs.includes("profiles")) {
                    settingsTab.set("profiles")
                    return
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault()

                nextTab = Math.max(0, currentTabIndex - 1)
            }

            if (nextTab < 0) return
            settingsTab.set(activeTabs[nextTab] || "profiles")
        }

        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [activeTabs, currentTab])

    return (
        <nav className={styles.nav}>
            {activeTabs.map((tab) => (
                <button key={tab} className={cn(styles.tab, currentTab === tab && styles.active)} onClick={() => settingsTab.set(tab)}>
                    <Icon id={tab} size={1} />
                    <span>
                        <T id={`settings.${tab}`} />
                    </span>
                </button>
            ))}
        </nav>
    )
}
