import type { MouseEvent as ReactMouseEvent } from "react"
import type { StageLayout } from "../../../types/Stage"
import { outputs } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getStageOutputId, getStageResolution } from "../../shared/utils/helpers/output"
import { Icon } from "../../shared/ui/helpers/Icon"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { useStore } from "../../shared/ui/hooks/useStore"
import styles from "./SkeletonStageSlide.module.css"

export interface SkeletonStageSlideProps {
    layout: StageLayout
    columns?: number
    active?: boolean
    list?: boolean
    onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

// Port de components/stage/SkeletonStageSlide.svelte (F24.19a).
export function SkeletonStageSlide({ layout, columns = 1, active = false, list = false, onClick }: SkeletonStageSlideProps) {
    const currentOutputs = useStore(outputs)
    const stageOutputId = getStageOutputId(currentOutputs)
    const resolution = getStageResolution(stageOutputId, currentOutputs)

    return (
        <div className={`main ${styles.main} ${list ? `list ${styles.list}` : ""} ${active ? `active ${styles.active}` : ""}`} style={cssTextToStyle(`width: ${100 / columns}%`)} role="none" onClick={onClick}>
            <div className={`slide ${styles.slide} ${layout?.disabled ? `disabled ${styles.disabled}` : ""}`} style={cssTextToStyle(layout?.settings?.color ? `background-color: ${layout.settings.color};` : "")}>
                <div style={{ width: "100%" }}>
                    <div className={`preview ${styles.preview}`} style={cssTextToStyle(`aspect-ratio: ${resolution.width} / ${resolution.height}; background-color: ${layout?.items?.length ? "black" : "transparent"};`)} />
                    <div className={`label ${styles.label}`} style={{ position: "relative" }} data-title={layout?.name}>
                        {layout?.password ? (
                            <span style={{ position: "absolute", left: "5px" }} data-title={translateText("remote.password")}>
                                <Icon id="locked" size={0.8} style={cssTextToStyle("opacity: 0.5;")} white />
                            </span>
                        ) : null}
                        <span className={`text ${styles.text}`}>
                            <p>{layout?.name || "—"}</p>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
