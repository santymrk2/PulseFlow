import { useEffect, useRef, useState } from "react"
import { get } from "../../shared/core/lib/store"
import type { Overlay } from "../../../types/Show"
import { OUTPUT } from "../../../types/Channels"
import { activeEdit, overlays, outputs, previewOutputId, styles as stylesStore } from "../../shared/core/stores"
import { clone } from "../../components/helpers/array"
import { history } from "../../components/helpers/history"
import { getResolution } from "../../components/helpers/output"
import { getStyles } from "../../components/helpers/style"
import { getStyleResolution } from "../../components/slide/getStyleResolution"
import { translateText } from "../../utils/language"
import { send } from "../../utils/request"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { observeResize } from "../slide/observeResize"
import { Zoomed } from "../slide/Zoomed"
import { DropArea } from "../system/DropArea"
import { Snaplines, type Snapline, type SnaplinesMouse } from "../system/Snaplines"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import { centerZoom } from "./centerZoom"
import { Editbox } from "./editbox/Editbox"
import stylesModule from "./OverlayEditor.module.css"

type NewStyles = { [key: string]: string | number }

// Port autocontenedor del editor de overlays: el lienzo (DropArea/Zoomed/Snaplines/Editbox),
// el estado de arrastre y la persistencia de estilos viven aquí, sin cascarón Svelte.
export function OverlayEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentOverlays = useStore(overlays)
    const currentOutputs = useStore(outputs)
    const currentStyles = useStore(stylesStore)
    const currentPreviewOutputId = useStore(previewOutputId)

    const currentId = currentActiveEdit.id || ""
    const slide: Overlay | undefined = clone(currentOverlays[currentId])
    const active = currentActiveEdit.items || []
    const activeKey = active.join(",")

    const [lines, setLines] = useState<Snapline[]>([])
    const [mouse, setMouse] = useState<SnaplinesMouse | null>(null)
    const [newStyles, setNewStyles] = useState<NewStyles>({})
    const [ratio, setRatio] = useState(1)
    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    const parentRef = useRef<HTMLDivElement | null>(null)
    const lastActiveIds = useRef("")
    const activeChanged = activeKey !== lastActiveIds.current
    const latest = useRef({ currentId, slide, active })
    latest.current = { currentId, slide, active }

    useEffect(() => {
        if (activeKey !== lastActiveIds.current) {
            setNewStyles({})
            lastActiveIds.current = activeKey
        }
    }, [activeKey])

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => setSize({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [])

    // Equivalente al bloque reactivo que persistía los estilos en el cascarón Svelte.
    useEffect(() => {
        if (activeChanged) return
        const { currentId, slide, active } = latest.current
        if (!active.length || !Object.keys(newStyles).length || !slide?.items) return

        const values: string[] = []
        const multi = (newStyles as { __multiPositions?: { [key: string]: NewStyles } }).__multiPositions
        active.forEach((id) => {
            const item = slide.items[id]
            if (!item) return
            const itemStyles = getStyles(item.style)
            const itemNewStyles = multi ? multi[id] || {} : newStyles
            let textStyles = ""
            Object.entries(itemNewStyles).forEach(([key, value]) => (itemStyles[key] = String(value)))
            Object.entries(itemStyles).forEach(([key, value]) => (textStyles += `${key}:${value};`))
            values.push(textStyles)
        })
        if (!values.length) return

        history({
            id: "UPDATE",
            newData: { key: "items", indexes: active, subkey: "style", data: values },
            oldData: { id: currentId },
            location: { page: "edit", id: "overlay_items", override: `overlay_items#${currentId}indexes#${active.join(",")}` }
        })
        send(OUTPUT, ["OVERLAY"], get(overlays))
        // `slide` se clona en cada render; se lee desde `latest` para no reiniciar el efecto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newStyles, activeKey])

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId })
    const widthOrHeight = getStyleResolution(resolution, size.width, size.height, "fit", { zoom })

    function updateZoom(detail: number) {
        setZoom(detail)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, parentRef.current || undefined, ".droparea")
    }

    return (
        <>
            {slide?.isDefault ? (
                <div className={stylesModule.default} data-title={translateText("example.default")}>
                    <Icon id="protected" white />
                </div>
            ) : null}

            <div className={stylesModule.editArea}>
                <div ref={parentRef} className={`${stylesModule.parent} ${zoom >= 1 ? stylesModule.noOverflow : ""}`}>
                    {slide ? (
                        <DropArea id="edit" file>
                            <Zoomed background="transparent" checkered border resolution={resolution} style={widthOrHeight} onRatioChange={setRatio} hideOverflow={false} center>
                                <Snaplines lines={lines} mouse={mouse} newStyles={newStyles} ratio={ratio} active={active} onLinesChange={setLines} onMouseChange={setMouse} onNewStylesChange={setNewStyles} />
                                {(slide.items || []).map((item, index) => (
                                    <Editbox key={index} ref={{ type: "overlay", id: currentId }} item={item} index={index} ratio={ratio} mouse={(mouse as unknown as Parameters<typeof Editbox>[0]["mouse"]) || undefined} onMouseChange={(next) => setMouse(next as unknown as SnaplinesMouse)} />
                                ))}
                            </Zoomed>
                        </DropArea>
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
