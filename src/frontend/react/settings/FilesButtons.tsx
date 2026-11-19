import { activePopup } from "../../shared/core/stores"
import { save } from "../../utils/save"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { Button } from "../ui/button/Button"
import { InputRow } from "../ui/input-row/InputRow"
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
