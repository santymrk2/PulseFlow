import { Settings } from "./Settings"
import styles from "./SettingsModal.module.css"
import { SettingsTabs } from "./SettingsTabs"
import { SettingsTools } from "./SettingsTools"

// Cuerpo de SettingsModal.svelte (F24.12). El `Modal` (marco, Esc, transiciones) sigue siendo Svelte y necesita un <slot>
// que una isla React no puede llenar; SettingsModal.svelte queda como cascarón y monta este cuerpo con ReactIsland.
// Se retira junto con Modal.svelte cuando éste se migre.
export function SettingsModal() {
    return (
        <>
            <aside className={styles.aside}>
                <SettingsTabs />
                <SettingsTools />
            </aside>

            <section className={styles.section}>
                <Settings />
            </section>
        </>
    )
}
