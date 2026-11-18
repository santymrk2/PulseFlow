import type { Output } from "../../../types/Output"
import { effects, outLocked, overlayCategories, overlays } from "../../stores"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { keysToID, sortByName } from "../../components/helpers/array"
import { toggleEffectOutput, toggleOverlayOutput } from "../../components/helpers/overlayOutput"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import styles from "./ToolsOverlay.module.css"

export interface ToolsOverlayProps {
    currentOutput: Output
}

// Port de components/output/tools/Overlay.svelte (F24.20c).
export function ToolsOverlay({ currentOutput }: ToolsOverlayProps) {
    const currentEffects = useStore(effects)
    const locked = useStore(outLocked)
    const categories = useStore(overlayCategories)
    const currentOverlays = useStore(overlays)
    const profile = getAccess("overlays")

    const activeOverlayIds = currentOutput?.out?.overlays || []
    const activeEffectIds = currentOutput?.out?.effects || []

    const overlayList = sortByName((keysToID(currentOverlays || {}) as Array<{ id: string; name?: string; category?: string }>).filter((a) => a && (profile as Record<string, string | undefined>)[a.category || ""] !== "none")) as Array<{ id: string; name?: string; category?: string }>
    const effectList = sortByName(keysToID(currentEffects || {}) as Array<{ id: string; name?: string }>) as Array<{ id: string; name?: string }>

    const categoryName = (id: string | null | undefined) => {
        const name = id ? categories[id]?.name : ""
        return name?.includes(".") ? translateText(name) : name || ""
    }

    return (
        <>
            {overlayList.length ? (
                <div className={styles.list}>
                    {overlayList.map((overlay) => (
                        <button key={overlay.id} type="button" className={`${styles.row} ${activeOverlayIds.includes(overlay.id) ? styles.active : ""}`.trim()} disabled={locked} onClick={() => toggleOverlayOutput(overlay.id)}>
                            <span className={styles.name}>{overlay.name || "—"}</span>
                            <span className={styles.category}>{categoryName(overlay.category)}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {effectList.length ? (
                <>
                    <div className={styles.title}>
                        <T id="tabs.effects" />
                    </div>
                    <div className={styles.list}>
                        {effectList.map((effect) => (
                            <button key={effect.id} type="button" className={`${styles.row} ${activeEffectIds.includes(effect.id) ? styles.active : ""}`.trim()} disabled={locked} onClick={() => toggleEffectOutput(effect.id)}>
                                <span className={styles.name}>{effect.name || "—"}</span>
                            </button>
                        ))}
                    </div>
                </>
            ) : null}

            {!overlayList.length && !effectList.length ? (
                <div className={styles.empty}>
                    <T id="empty.general" />
                </div>
            ) : null}
        </>
    )
}

export default ToolsOverlay
