import { useEffect, useRef, useState } from "react"
import { activeEdit, overlays } from "../../stores"
import { clone } from "../../components/helpers/array"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { observeResize } from "../slide/observeResize"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import { centerZoom } from "./centerZoom"
import stylesModule from "./OverlayEditor.module.css"

export interface OverlayEditorProps {
    newStyles: { [key: string]: string | number }
    onZoomChange?: (zoom: number) => void
    onSizeChange?: (size: { width: number; height: number }) => void
    onRatioChange?: (ratio: number) => void
    canvasHost?: HTMLElement | null
}

function useHost(host: HTMLElement | null | undefined, ref: { current: HTMLDivElement | null }) {
    useEffect(() => {
        const container = ref.current
        if (!container || !host) return
        container.appendChild(host)
        return () => {
            if (host.parentNode === container) container.removeChild(host)
        }
    }, [host, ref])
}

// Port de components/edit/editors/OverlayEditor.svelte. El lienzo con binds de Snaplines/Editbox se mantiene en el
// cascarón Svelte; React gestiona el zoom, la persistencia de estilos y la estructura exterior.
export function OverlayEditor({ newStyles, onZoomChange, onSizeChange, onRatioChange, canvasHost }: OverlayEditorProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentOverlays = useStore(overlays)

    const currentId = currentActiveEdit.id || ""
    const slide = clone(currentOverlays[currentId])

    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const scrollElemRef = useRef<HTMLDivElement | null>(null)
    const parentRef = useRef<HTMLDivElement | null>(null)
    const hostRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => onSizeChange?.({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [onSizeChange])

    // La persistencia de estilos la realiza el cascarón Svelte, que conserva los binds con Snaplines/Editbox.

    function updateZoom(detail: number) {
        setZoom(detail)
        onZoomChange?.(detail)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, scrollElemRef.current || undefined, ".droparea")
    }

    useHost(canvasHost, hostRef)

    void newStyles
    void onRatioChange

    return (
        <>
            {slide?.isDefault ? (
                <div className={stylesModule.default} data-title={translateText("example.default")}>
                    <Icon id="protected" white />
                </div>
            ) : null}

            <div className={stylesModule.editArea}>
                <div
                    ref={(el) => {
                        scrollElemRef.current = el
                        parentRef.current = el
                    }}
                    className={`${stylesModule.parent} ${zoom >= 1 ? stylesModule.noOverflow : ""}`}
                >
                    {slide ? (
                        <div ref={hostRef} style={{ display: "contents" }} />
                    ) : (
                        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                            <T id="empty.slide" />
                        </div>
                    )}
                </div>

                <FloatingBar side="left">
                    <ZoomControl columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={updateZoom} onOrigin={(origin) => setZoomOrigin(origin)} />
                </FloatingBar>
            </div>
        </>
    )
}
