import { useEffect, useRef, useState } from "react"
import { getResolution } from "../../shared/utils/helpers/output"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { activeEdit, effects, outputs, previewOutputId, styles } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Effect } from "../output/Effect"
import { observeResize } from "../slide/observeResize"
import { Zoomed } from "../slide/Zoomed"
import stylesModule from "./EffectEditor.module.css"

// Port de components/edit/editors/EffectEditor.svelte.
export function EffectEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentEffects = useStore(effects)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)
    const currentPreviewOutputId = useStore(previewOutputId)

    const currentId = currentActiveEdit.id || ""
    const effect = currentEffects[currentId] ? { id: currentId, ...currentEffects[currentId] } : null

    const [size, setSize] = useState({ width: 0, height: 0 })
    const parentRef = useRef<HTMLDivElement | null>(null)
    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId })
    const zoom = 1

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => setSize({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [])

    return (
        <>
            {effect?.isDefault ? (
                <div className={stylesModule.default} data-title={translateText("example.default")}>
                    <Icon id="protected" white />
                </div>
            ) : null}

            <div className={stylesModule.editArea}>
                <div ref={parentRef} className={stylesModule.parent}>
                    {effect?.items ? (
                        <Zoomed background="transparent" checkered border style={getStyleResolution(resolution, size.width, size.height, "fit", { zoom })} hideOverflow={false} center>
                            <Effect effect={effect} edit />
                        </Zoomed>
                    ) : (
                        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                            <T id="empty.general" />
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
