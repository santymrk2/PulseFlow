import { useEffect, useRef, useState } from "react"
import { activeEdit, activePopup, popupData, templates } from "../../stores"
import { clone } from "../../components/helpers/array"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { T } from "../helpers/T"
import { useStore } from "../hooks/useStore"
import { observeResize } from "../slide/observeResize"
import { DropArea } from "../system/DropArea"
import { Button } from "../ui/button/Button"
import { FloatingBar } from "../ui/floating-bar/FloatingBar"
import { ZoomControl } from "../ui/zoom-control/ZoomControl"
import { centerZoom } from "./centerZoom"
import stylesModule from "./TemplateEditor.module.css"

export interface TemplateEditorProps {
    newStyles: { [key: string]: string | number }
    onZoomChange?: (zoom: number) => void
    onSizeChange?: (size: { width: number; height: number }) => void
    templateSlideHost?: HTMLElement | null
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

// Port de components/edit/editors/TemplateEditor.svelte. TemplateSlide (Svelte, con binds de newStyles/ratio)
// se monta en el cascarón y React lo reubica en el área de edición.
export function TemplateEditor({ newStyles, onZoomChange, onSizeChange, templateSlideHost }: TemplateEditorProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentTemplates = useStore(templates)

    const currentId = currentActiveEdit.id || ""
    const slide = clone(currentTemplates[currentId])
    const active = currentActiveEdit.items || []

    const [zoom, setZoom] = useState(1)
    const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null)
    const scrollElemRef = useRef<HTMLDivElement | null>(null)
    const parentRef = useRef<HTMLDivElement | null>(null)
    const hostRef = useRef<HTMLDivElement | null>(null)
    const prevActiveKey = useRef("")

    useEffect(() => {
        const parent = parentRef.current
        if (!parent) return
        const obs = observeResize(parent, (rect) => onSizeChange?.({ width: rect.width, height: rect.height }))
        return () => obs.destroy()
    }, [onSizeChange])

    // La persistencia de estilos y el reinicio al cambiar la selección los realiza el cascarón Svelte.
    void newStyles
    void prevActiveKey
    void active

    function updateZoom(detail: number) {
        setZoom(detail)
        onZoomChange?.(detail)
        const origin = zoomOrigin
        setZoomOrigin(null)
        void centerZoom(origin, scrollElemRef.current || undefined, ".droparea")
    }

    useHost(templateSlideHost, hostRef)

    const styleOverrides = (slide?.settings?.styleOverrides || []).filter((a: { globalRegex?: unknown; pattern?: unknown; templateId?: unknown }) => (a.globalRegex || a.pattern) && a.templateId).length

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
                        <DropArea id="edit" file>
                            <div ref={hostRef} style={{ display: "contents" }} />
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
