import { translateText } from "../../utils/language"
import styles from "./SystemDisplays.module.css"

// Port de components/screens/SystemDisplays.svelte (F24.14).
export interface SystemDisplaysProps {
    displays?: readonly unknown[]
    onRefresh?: () => void
    onIdentify?: () => void
}

export function SystemDisplays({ displays = [], onRefresh, onIdentify }: SystemDisplaysProps) {
    return (
        <div className={styles.wrap}>
            {!displays.length ? <div className={styles.empty}>{translateText("screen_config.no_monitors")}</div> : null}
            <div className={styles.row}>
                <button className={styles.btn} onClick={() => onRefresh?.()}>
                    {translateText("screen_config.refresh")}
                </button>
                <button className={styles.btn} onClick={() => onIdentify?.()}>
                    {translateText("screen_config.identify")}
                </button>
            </div>
        </div>
    )
}
