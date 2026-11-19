import { get } from "../../shared/core/lib/store"
import { Main } from "../../../types/IPC/Main"
import type { Popups } from "../../../types/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { activePopup, dataPath, popupData, settingsTab } from "../../shared/core/stores"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Button } from "../../shared/ui/kit/button/Button"
import styles from "./SettingsTools.module.css"

// Port de components/settings/SettingsTools.svelte (F24.12)
const generalPopups: { popup: Popups; icon: string }[] = [
    { popup: "manage_metadata", icon: "info" },
    { popup: "manage_dynamic_values", icon: "dynamic" },
    { popup: "manage_emitters", icon: "emitter" },
    { popup: "manage_fonts", icon: "text" },
    { popup: "manage_icons", icon: "star" },
    { popup: "manage_colors", icon: "color" }
]

function open(id: Popups) {
    popupData.set({})
    activePopup.set(id)
}

export function SettingsTools() {
    const openedTab = useStore(settingsTab)

    if (openedTab === "general") {
        return (
            <div className={styles.bottom}>
                {generalPopups.map(({ popup, icon }) => (
                    <Button key={popup} variant="outline" icon={icon} onClick={() => open(popup)} size="xs">
                        <T id={`popup.${popup}`} />
                    </Button>
                ))}
            </div>
        )
    }

    if (openedTab === "other") {
        return (
            <div className={styles.bottom}>
                <Button variant="outline" icon="document" onClick={() => sendMain(Main.OPEN_LOG)} size="xs">
                    <T id="actions.open_error_log" />
                </Button>
                <Button variant="outline" icon="folder" onClick={() => sendMain(Main.OPEN_APPDATA)} size="xs">
                    <T id="actions.open_app_data_folder" />
                </Button>
                {/* in settings>Files we can press "Open in system" on the user data folder, so we don't need this! - but it makes sense to have it next to "Open app data folder" */}
                <Button variant="outline" icon="folder" onClick={() => sendMain(Main.OPEN_FOLDER_PATH, get(dataPath))} size="xs">
                    <T id="actions.open_user_data_folder" />
                </Button>
            </div>
        )
    }

    return null
}
