import type { Show } from "../../../../types/Show"
import { outLocked, outputs, overlays } from "../../../stores"
import { findMatchingOut, getActiveOutputs, setOutput } from "../../../components/helpers/output"
import Overlay from "../../../components/output/layers/Overlay.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
import { HoverPlay } from "../../system/HoverPlay"
import { Zoomed } from "../../slide/Zoomed"
import styles from "./OverlayPreview.module.css"

export interface OverlayPreviewProps {
    show: Show
}

// (F24.20a).
export function OverlayPreview({ show }: OverlayPreviewProps) {
    const currentOverlays = useStore(overlays)
    const currentOutputs = useStore(outputs)
    const locked = useStore(outLocked)
    const isOutputted = findMatchingOut(show.id || "", currentOutputs) !== null
    const outputId = getActiveOutputs(currentOutputs, true, true, true)[0]

    function play() {
        if (!locked) setOutput("overlays", show.id || "", true)
    }

    return (
        <div className={`overlayPreview context #overlay_preview ${styles.overlayPreview}`}>
            <HoverPlay icon={isOutputted ? "clear" : "play"} size={isOutputted ? 8 : 10} onClick={play}>
                <Zoomed background="transparent" checkered center mirror>
                    <SvelteIsland component={Overlay as never} props={{ overlay: currentOverlays[show.id || ""], id: show.id || "", outputId, mirror: true, transition: { type: "none", duration: 0, easing: "" }, preview: true }} />
                </Zoomed>
            </HoverPlay>
        </div>
    )
}
