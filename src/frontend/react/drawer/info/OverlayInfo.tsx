import { useStore } from "../../hooks/useStore"
import { drawerTabsData } from "../../../shared/core/stores"
import { EffectsInfo } from "./EffectsInfo"
import styles from "./OverlayInfo.module.css"

// Port de components/drawer/info/OverlayInfo.svelte.
export function OverlayInfo() {
    const tabsData = useStore(drawerTabsData)
    const subTab = tabsData.overlays?.activeSubTab || ""

    if (subTab === "effects") return <EffectsInfo />
    return <div className={styles.scroll} />
}
