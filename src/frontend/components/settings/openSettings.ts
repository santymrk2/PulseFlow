import type { SettingsTabs } from "../../../types/Tabs"
import { activePopup, settingsOpen, settingsTab } from "../../stores"
import { settingsTabs } from "../../values/tabs"

/**
 * Abre Configuración como modal, opcionalmente en una pestaña.
 * Las pestañas que ya no existen apuntan a lo que las reemplazó:
 * `display_settings` → Pantallas, `styles`/`looks` → Looks.
 */
export function openSettings(tab?: string) {
    if (tab === "display_settings") return activePopup.set("screen_config")
    if (tab === "styles" || tab === "looks") return activePopup.set("looks")

    if (tab && (settingsTabs as string[]).includes(tab)) settingsTab.set(tab as SettingsTabs)
    settingsOpen.set(true)
}
