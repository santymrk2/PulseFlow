import { activePopup } from "../../shared/core/stores"
import { save } from "../../app/wiring/save"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { Button } from "../../shared/ui/kit/button/Button"
import { InputRow } from "../../shared/ui/kit/input-row/InputRow"
import styles from "./FilesButtons.module.css"

// Port de components/settings/tabs/FilesButtons.svelte (F24.12)
export function FilesButtons() {
    return (
        <InputRow>
            <Button className={styles.big} title="settings.backup_info" onClick={() => save(false, { backup: true })}>
                <Icon id="export" size={1.3} />
                <p>
                    <T id="settings.backup_all" />
                </p>
            </Button>
            <Button className={styles.big} onClick={() => activePopup.set("restore")}>
                <Icon id="import" size={1.3} />
                <p>
                    <T id="settings.restore" />
                </p>
            </Button>
        </InputRow>
    )
}
