import { activePopup, settingsOpen } from "../../shared/core/stores"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Modal } from "../../react/main/Modal"
import { Settings } from "./Settings"
import styles from "./SettingsModal.module.css"
import { SettingsTabs } from "./SettingsTabs"
import { SettingsTools } from "./SettingsTools"

// Root completo de Configuración (P11c): el marco React Modal reemplaza a Modal.svelte.
// App condiciona el montaje por `settingsOpen`; acá sólo se arma el diálogo y su cuerpo.
export function SettingsModal() {
    const activePopupValue = useStore(activePopup)

    return (
        <Modal title="menu.settings" width={960} height={620} managesPopup={false} blockEscape={!!activePopupValue} onClose={() => settingsOpen.set(false)}>
            <aside className={styles.aside}>
                <SettingsTabs />
                <SettingsTools />
            </aside>

            <section className={styles.section}>
                <Settings />
            </section>
        </Modal>
    )
}
