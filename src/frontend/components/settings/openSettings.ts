import { get } from "svelte/store"
import type { SettingsTabs } from "../../../types/Tabs"
import { activePopup, activeProfile, profiles, settingsOpen, settingsTab } from "../../stores"
import { settingsTabs } from "../../values/tabs"

/** Un perfil con las pestañas de Configuración bloqueadas no puede abrirla. */
export function isSettingsDisabled(): boolean {
    const profile = get(profiles)[get(activeProfile) || ""]
    return Object.keys(profile?.access.settings || {}).length > 7
}

/**
 * Abre Configuración como modal, opcionalmente en una pestaña.
 * Las pestañas que ya no existen apuntan a lo que las reemplazó:
 * `display_settings` → Pantallas, `styles`/`looks` → Looks.
 */
export function openSettings(tab?: string) {
    if (tab === "display_settings") return activePopup.set("screen_config")
    if (tab === "styles" || tab === "looks") return activePopup.set("looks")

    if (isSettingsDisabled()) return
    if (tab && (settingsTabs as string[]).includes(tab)) settingsTab.set(tab as SettingsTabs)
    settingsOpen.set(true)
}
