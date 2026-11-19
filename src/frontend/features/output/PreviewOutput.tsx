import { useEffect, useRef, useState } from "react"
import { livePrepare, outputs, styles as stylesStore } from "../../shared/core/stores"
import { getResolution } from "../../shared/utils/helpers/output"
import { getStyleResolution } from "../slide/logic/getStyleResolution"
import { Icon } from "../../shared/ui/helpers/Icon"
import { cssTextToStyle } from "../../shared/ui/helpers/cssTextToStyle"
import { useStore } from "../../shared/ui/hooks/useStore"
import { StageLayout } from "../stage/StageLayout"
import { Output } from "./Output"
import styles from "./PreviewOutput.module.css"

export interface PreviewOutputProps {
    fullscreen?: boolean
    disableTransitions?: boolean
    disabled?: boolean
    outputId?: string
    style?: string
}

// Port de components/output/preview/PreviewOutput.svelte (F24.20c).
export function PreviewOutput({ fullscreen = false, disableTransitions = false, disabled = false, outputId = "", style = "" }: PreviewOutputProps) {
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(stylesStore)
    const currentLivePrepare = useStore(livePrepare)
    const box = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    // en pantalla completa la salida se ajusta al contenedor (en el resto, a su propia resolución)
    useEffect(() => {
        const elem = box.current
        if (!fullscreen || !elem) return
        const observer = new ResizeObserver(() => setSize({ width: elem.offsetWidth, height: elem.offsetHeight }))
        observer.observe(elem)
        return () => observer.disconnect()
    }, [fullscreen])

    const sceneStyleId = currentOutputs[outputId]?.out?.scene?.style
    const resolved = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles } as unknown, false, outputId, sceneStyleId)
    const stageOutput = currentOutputs[outputId]?.stageOutput
    const blackOverlay = !fullscreen && currentLivePrepare[outputId]
    const aspect = `; aspect-ratio: ${resolved.width}/${resolved.height};`

    return (
        <div ref={box} className={`${styles.center} previewOutput ${styles.previewOutput} ${disabled ? styles.disabled : ""}`.trim()} id={outputId} style={cssTextToStyle(`${style}${aspect}`)}>
            {stageOutput ? <StageLayout outputId={outputId} stageId={stageOutput} preview={!disableTransitions} edit={false} /> : <Output outputId={outputId} style={getStyleResolution(resolved, fullscreen ? size.width : resolved.width, fullscreen ? size.height : resolved.height, "fit")} mirror preview={!disableTransitions} />}
            {blackOverlay ? (
                <div className={styles.blackOverlay}>
                    <Icon id="hide" size={2.5} white />
                </div>
            ) : null}
        </div>
    )
}

export default PreviewOutput
