import type { Show } from "../../../../types/Show"
import { effects, outLocked, outputs } from "../../../shared/core/stores"
import { findMatchingOut, setOutput } from "../../../shared/utils/helpers/output"
import { useStore } from "../../../shared/ui/hooks/useStore"
import { Effect } from "../../../react/output/Effect"
import { HoverPlay } from "../../../shared/ui/system/HoverPlay"
import { Zoomed } from "../../slide/Zoomed"
import styles from "./EffectPreview.module.css"

export interface EffectPreviewProps {
    show: Show
}

// (F24.20a).
export function EffectPreview({ show }: EffectPreviewProps) {
    const currentEffects = useStore(effects)
    const currentOutputs = useStore(outputs)
    const locked = useStore(outLocked)
    const isOutputted = findMatchingOut(show.id || "", currentOutputs) !== null

    function play() {
        if (!locked) setOutput("effects", show.id || "", true)
    }

    return (
        <div className={`effectPreview context #effect_preview ${styles.effectPreview}`}>
            <HoverPlay icon={isOutputted ? "clear" : "play"} size={isOutputted ? 8 : 10} onClick={play}>
                <Zoomed background="transparent" checkered center mirror zoom={false}>
                    <Effect effect={currentEffects[show.id || ""]} preview={false} />
                </Zoomed>
            </HoverPlay>
        </div>
    )
}
