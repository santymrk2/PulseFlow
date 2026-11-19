import type { MouseEvent } from "react"
import type { Slide } from "../../../types/Show"
import { cn } from "../../shared/core/lib/utils"
import { outputs, previewOutputId, slidesOptions, styles } from "../../shared/core/stores"
import { getResolution } from "../../shared/utils/helpers/output"
import { referenceOutputId } from "../../shared/utils/helpers/outputAspect"
import { useStore } from "../../shared/ui/hooks/useStore"
import stylesCss from "./SkeletonSlide.module.css"

export interface SkeletonSlideProps {
    slide: Slide
    index: number
    color: string
    columns?: number
    active?: boolean
    onClick?: (event: MouseEvent<HTMLDivElement>) => void
}

// (F24.18b).
export function SkeletonSlide({ slide, index, color, columns = 1, active = false, onClick }: SkeletonSlideProps) {
    const currentOutputs = useStore(outputs)
    const currentPreviewOutputId = useStore(previewOutputId)
    const currentStyles = useStore(styles)
    const options = useStore(slidesOptions)

    const viewMode = options.mode || "grid"
    const name = slide?.group
    // mismo tamaño que tendrá la diapositiva real (la del selector de la vista previa o la primera salida activa)
    const resolution = getResolution(null, { outputs: currentOutputs, styles: currentStyles, previewOutputId: currentPreviewOutputId }, false, referenceOutputId(currentOutputs, currentPreviewOutputId))

    const width = viewMode === "grid" || viewMode === "simple" || viewMode === "groups" ? 100 / columns : 100

    return (
        <div className={cn(stylesCss.main, active && stylesCss.active)} style={{ width: `${width}%` }} role="none" onClick={onClick}>
            {viewMode === "lyrics" ? (
                <div className={stylesCss.label} style={{ color, marginBottom: "5px" }}>
                    <span style={{ color: "var(--text)", opacity: 0.85, fontSize: "0.9em" }}>{index + 1}</span>
                    <span className={stylesCss.text} dangerouslySetInnerHTML={{ __html: name === null || name === "." ? "" : name || "—" }} />
                    <div />
                </div>
            ) : null}

            <div className={stylesCss.slide} style={{ aspectRatio: `${resolution.width} / ${resolution.height}` }} />

            {viewMode === "simple" ? (
                <div data-title={name || ""} style={{ height: "2px" }} />
            ) : viewMode !== "lyrics" ? (
                <div className={stylesCss.label} style={{ color, borderBottom: `2px solid ${color || "var(--primary-darkest)"}` }}>
                    <span style={{ color: "var(--text)", opacity: 0.85, fontSize: "0.9em" }}>{index + 1}</span>
                    <span className={stylesCss.text} style={name === null ? { opacity: 0 } : undefined} dangerouslySetInnerHTML={{ __html: name === null ? "-" : name === "." ? "" : name || "—" }} />
                    <div />
                </div>
            ) : null}
        </div>
    )
}
