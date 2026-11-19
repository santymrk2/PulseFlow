import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../shared/core/ipc/main"
import { spellcheck } from "../../shared/core/stores"
import { closeContextMenu } from "../../app/wiring/shortcuts"
import { translateText } from "../../shared/utils/language"
import { triggerClickOnEnterSpace } from "../../shared/utils/clickable"
import { useStore } from "../hooks/useStore"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import styles from "./SpellCheckMenu.module.css"

export function SpellCheckMenu() {
    const state = useStore(spellcheck) as { misspelled?: string; suggestions?: string[] } | null
    const misspelled = state?.misspelled || ""
    const suggestions = state?.suggestions || []

    function addToDictionary() {
        sendMain(Main.SPELLCHECK, { addToDictionary: misspelled })
        closeContextMenu()
    }

    function fixSpelling(word: string) {
        sendMain(Main.SPELLCHECK, { fixSpelling: word })
        closeContextMenu()
    }

    if (!misspelled || !suggestions.length) return null

    return (
        <>
            {suggestions.map((suggestion) => (
                <div key={suggestion} className={styles.item} onClick={() => fixSpelling(suggestion)} onKeyDown={(e) => triggerClickOnEnterSpace(e.nativeEvent)} tabIndex={0} role="button" data-title={translateText("context.correct")}>
                    <span className={styles.inner}>
                        <Icon id="fix_misspelling" />
                        <p className={styles.bold}>
                            {suggestion}
                        </p>
                    </span>
                </div>
            ))}

            <hr className={styles.hr} />

            <div className={styles.item} onClick={addToDictionary} onKeyDown={(e) => triggerClickOnEnterSpace(e.nativeEvent)} tabIndex={0} role="button">
                <span className={styles.inner}>
                    <Icon id="dictionary" />
                    <p className={styles.row}>
                        <T id="context.to_dictionary" />: <span className={styles.bold}>{misspelled}</span>
                    </p>
                </span>
            </div>

            <hr className={styles.hr} />
        </>
    )
}
