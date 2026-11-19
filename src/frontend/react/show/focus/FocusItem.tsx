import type { ProjectShowRef } from "../../../../types/Projects"
import type { Show } from "../../../../types/Show"
import { outputs, showsCache } from "../../../shared/core/stores"
import { getActiveOutputs } from "../../../components/helpers/output"
import { useStore } from "../../hooks/useStore"
import { AudioPreview } from "../AudioPreview"
import { EffectPreview } from "../effect/EffectPreview"
import { FolderShow } from "../folder/FolderShow"
import { MediaPreview } from "../media/MediaPreview"
import { OverlayPreview } from "../overlay/OverlayPreview"
import { PdfPreview } from "../pdf/PdfPreview"
import { Slides } from "../Slides"
import styles from "./FocusItem.module.css"

export interface FocusItemProps {
    show: ProjectShowRef
}

// (F24.20a).
export function FocusItem({ show }: FocusItemProps) {
    const currentOutputs = useStore(outputs)
    const currentShowsCache = useStore(showsCache)
    const type = show.type
    const outputId = getActiveOutputs(currentOutputs)[0]
    const currentOutput = currentOutputs[outputId] || {}
    const layout = currentShowsCache[show.id]?.layouts?.[currentShowsCache[show.id]?.settings?.activeLayout || ""]
    const notes = currentShowsCache[show.id]?.layouts?.[currentShowsCache[show.id]?.settings?.activeLayout || ""]?.notes

    if (type === "video" || type === "image" || type === "player") {
        const active = currentOutput?.out?.background?.path === show.id
        return (
            <div className={`${styles.outline} ${active ? styles.active : ""}`}>
                <MediaPreview projectShow={show} />
            </div>
        )
    }

    if (type === "audio") return <AudioPreview active={show} />

    if (type === "section") return show.notes ? <p className={styles.notes}>{show.notes}</p> : null

    if (show.type === "overlay") {
        const active = currentOutput?.out?.overlays?.includes(show.id)
        return (
            <div className={`${styles.outline} ${active ? styles.active : ""}`} style={{ height: 250 }}>
                <OverlayPreview show={show as unknown as Show} />
            </div>
        )
    }

    if (show.type === "effect") {
        const active = currentOutput?.out?.effects?.includes(show.id)
        return (
            <div className={`${styles.outline} ${active ? styles.active : ""}`} style={{ height: 250 }}>
                <EffectPreview show={show as unknown as Show} />
            </div>
        )
    }

    if (type === "pdf") return <PdfPreview show={show} index={show.index || 0} />

    if (type === "folder") return <FolderShow path={show.id} index={show.index || 0} />

    return (
        <>
            <Slides showId={show.id} layout={show.layout} projectIndex={show.index} />
            {layout?.notes ? <p className={styles.notes}>{notes}</p> : null}
        </>
    )
}
