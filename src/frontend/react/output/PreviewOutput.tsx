import { livePrepare, outputs, styles as stylesStore } from "../../shared/core/stores"
import { getResolution } from "../../shared/utils/helpers/output"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { Icon } from "../../shared/ui/helpers/Icon"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { useStore } from "../../shared/ui/hooks/useStore"
import { StageLayout } from "../stage/StageLayout"
import styles from "./PreviewOutput.module.css"

export interface PreviewOutputProps {
    fullscreen?: boolean
    disableTransitions?: boolean
    disabled?: boolean
    outputId?: string
    style?: string
    /** Nodo del cascarón Svelte con `<Output>` y su estado/props legacy. */
    slotHost?: HTMLElement | null
}

// Port de components/output/preview/PreviewOutput.svelte (F24.20c).
// `<Output>` es un puerto React propio, pero conserva dependencias complejas: el cascarón lo monta y React lo reubica.
export function PreviewOutput({ fullscreen = false, disableTransitions = false, disabled = false, outputId = "", style = "", slotHost }: PreviewOutputProps) {
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(stylesStore)
    const currentLivePrepare = useStore(livePrepare)

    const sceneStyleId = currentOutputs[outputId]?.out?.scene?.style
    const resolved = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles } as unknown, false, outputId, sceneStyleId)
    const stageOutput = currentOutputs[outputId]?.stageOutput
    const blackOverlay = !fullscreen && currentLivePrepare[outputId]
    const aspect = `; aspect-ratio: ${resolved.width}/${resolved.height};`
    void fullscreen
    void disableTransitions
    void getStyleResolution

    return (
        <div className={`${styles.center} previewOutput ${styles.previewOutput} ${disabled ? styles.disabled : ""}`.trim()} id={outputId} style={cssTextToStyle(`${style}${aspect}`)}>
            {stageOutput ? (
                <StageLayout outputId={outputId} stageId={stageOutput} preview={!disableTransitions} edit={false} />
            ) : (
                <div
                    data-output-slot
                    ref={(elem) => {
                        if (elem && slotHost && slotHost.parentNode !== elem) elem.appendChild(slotHost)
                    }}
                    style={{ display: "contents" }}
                />
            )}
            {blackOverlay ? (
                <div className={styles.blackOverlay}>
                    <Icon id="hide" size={2.5} white />
                </div>
            ) : null}
        </div>
    )
}

export default PreviewOutput
