import { useEffect, useRef, useState } from "react"
import { getResolution } from "../../shared/utils/helpers/output"
import { getStyleResolution } from "../../features/slide/logic/getStyleResolution"
import { activeEdit, outputs, previewOutputId, scenes, styles } from "../../shared/core/stores"
import { ScenePreview } from "../drawer/pages/ScenePreview"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { observeResize } from "../../features/slide/observeResize"
import { Zoomed } from "../../features/slide/Zoomed"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { ZoomControl } from "../../shared/ui/kit/zoom-control/ZoomControl"
import { centerZoom } from "./centerZoom"
import stylesModule from "./SceneEditor.module.css"

// Port de components/edit/editors/SceneEditor.svelte.
export function SceneEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentScenes = useStore(scenes)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(styles)
    const currentPreviewOutputId = useStore(previewOutputId)

    const currentId = currentActiveEdit.id || ""
    const scene = currentScenes[currentId]
    const sceneStyleId = scene?.content?.style

    const [size, setSize] = useState({ width: 0, height: 0 })
    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const scrollElemRef = useRef<HTMLDivElement | null>(null)
    const parentRef = useRef<HTMLDivElement | null>(null)

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId }, false, "", sceneStyleId)
    const widthOrHeight = getStyleResolution(resolution, size.width, size.height, "fit", { zoom })

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => setSize({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [])

    function updateZoom(detail: number) {
        setZoom(detail)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, scrollElemRef.current || undefined, ".scene-preview-container")
    }

    return (
        <div className={stylesModule.editArea}>
            <div
                ref={(el) => {
                    scrollElemRef.current = el
                    parentRef.current = el
                }}
                className={stylesModule.parent}
            >
                {scene ? (
                    <div className={stylesModule.scenePreviewContainer}>
                        <Zoomed background="transparent" border resolution={resolution} styleIdOverride={sceneStyleId} style={widthOrHeight} center>
                            <ScenePreview scene={scene} />
                        </Zoomed>
                    </div>
                ) : (
                    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                        <T id="empty.general" />
                    </div>
                )}
            </div>

            <FloatingBar side="left">
                <ZoomControl columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={updateZoom} onOrigin={(origin) => setZoomOrigin(origin)} />
            </FloatingBar>
        </div>
    )
}
