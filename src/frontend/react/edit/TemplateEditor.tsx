import { useEffect, useRef, useState } from "react"
import { clone } from "../../shared/utils/helpers/array"
import { history } from "../../shared/utils/helpers/history"
import { getStyles } from "../../shared/utils/helpers/style"
import { translateText } from "../../shared/utils/language"
import { activeEdit, activePopup, popupData, templates } from "../../shared/core/stores"
import { Icon } from "../../shared/ui/helpers/Icon"
import { T } from "../../shared/ui/helpers/T"
import { useStore } from "../../shared/ui/hooks/useStore"
import { observeResize } from "../../features/slide/observeResize"
import { TemplateSlide } from "../drawer/pages/TemplateSlide"
import { DropArea } from "../../shared/ui/system/DropArea"
import { Button } from "../../shared/ui/kit/button/Button"
import { FloatingBar } from "../../shared/ui/kit/floating-bar/FloatingBar"
import { ZoomControl } from "../../shared/ui/kit/zoom-control/ZoomControl"
import { centerZoom } from "./centerZoom"
import stylesModule from "./TemplateEditor.module.css"

type NewStyles = { [key: string]: string | number }

// Port autocontenedor del editor de plantillas: TemplateSlide, su estado de estilos
// y la persistencia en el historial se gestionan aquí, sin cascarón Svelte.
export function TemplateEditor() {
    const currentActiveEdit = useStore(activeEdit)
    const currentTemplates = useStore(templates)

    const currentId = currentActiveEdit.id || ""
    const storedTemplate = currentTemplates[currentId]
    const slide = clone(storedTemplate)
    const active = currentActiveEdit.items || []
    const activeKey = active.join(",")

    const [newStyles, setNewStyles] = useState<NewStyles>({})
    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const [ratio, setRatio] = useState(1)

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
            location: { page: "edit", id: "template_items", override: `template_items#${currentId}indexes#${active.join(",")}` }
        })
        // `slide` se clona en cada render; se lee desde `latest` para no reiniciar el efecto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newStyles, activeKey])

    function updateZoom(detail: number) {
        setZoom(detail)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, parentRef.current || undefined, ".droparea")
    }

    const styleOverrides = (slide?.settings?.styleOverrides || []).filter((a: { globalRegex?: unknown; pattern?: unknown; templateId?: unknown }) => (a.globalRegex || a.pattern) && a.templateId).length

    return (
        <>
            {slide?.isDefault ? (
                <div className={stylesModule.default} data-title={translateText("example.default")}>
                    <Icon id="protected" white />
                </div>
            ) : null}

            <div className={stylesModule.editArea}>
                <div ref={parentRef} className={`${stylesModule.parent} ${zoom >= 1 ? stylesModule.noOverflow : ""}`}>
                    {storedTemplate ? (
                        <DropArea id="edit" file>
                            <TemplateSlide templateId={currentId} template={storedTemplate} edit width={size.width} height={size.height} zoom={zoom} ratio={ratio} newStyles={newStyles} onRatioChange={setRatio} onNewStylesChange={setNewStyles} />
                        </DropArea>
                    ) : (
                        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                            <T id="empty.slide" />
                        </div>
                    )}
                </div>

                <FloatingBar side="left">
                    <ZoomControl columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} onChange={updateZoom} onOrigin={(origin) => setZoomOrigin(origin)} />

                    {styleOverrides > 0 ? (
                        <>
                            <div className="divider" />
                            <Button
                                icon="text"
                                onClick={() => {
                                    popupData.set({ templateId: currentId })
                                    activePopup.set("template_style_overrides")
                                }}
                            >
                                <T id="popup.template_style_overrides" />
                                <span style={{ fontSize: "0.8em", opacity: 0.5 }}>{styleOverrides}</span>
                            </Button>
                        </>
                    ) : null}
                </FloatingBar>
            </div>
        </>
    )
}
