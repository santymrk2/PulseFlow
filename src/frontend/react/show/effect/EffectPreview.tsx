import type { Show } from "../../../../types/Show"
import { effects, outLocked, outputs } from "../../../stores"
import { findMatchingOut, setOutput } from "../../../components/helpers/output"
import HoverPlay from "../../../components/helpers/HoverPlay.svelte"
import Effect from "../../../components/output/effects/Effect.svelte"
import { SvelteIsland } from "../../bridge/SvelteIsland"
import { useStore } from "../../hooks/useStore"
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
            <SvelteIsland
                component={HoverPlay as never}
                props={{ icon: isOutputted ? "clear" : "play", size: isOutputted ? 8 : 10 }}
                events={{ click: play }}
                slots={{
                    default: (
                        <Zoomed background="transparent" checkered center mirror zoom={false}>
                            <SvelteIsland component={Effect as never} props={{ effect: currentEffects[show.id || ""], preview: false }} />
                        </Zoomed>
                    )
                }}
            />
        </div>
    )
}
