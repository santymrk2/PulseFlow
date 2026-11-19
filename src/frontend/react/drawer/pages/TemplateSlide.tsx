import { useEffect, useRef, useState } from "react"
import type { Template } from "../../../../types/Show"
import { activeEdit, outputs, overlays, previewOutputId, styles } from "../../../shared/core/stores"
import { getMedia, getThumbnailPath, mediaSize } from "../../../shared/utils/helpers/media"
import { getResolution } from "../../../shared/utils/helpers/output"
import { getStyleResolution } from "../../../components/slide/getStyleResolution"
import { Editbox } from "../../edit/editbox/Editbox"
import { MediaLoader } from "../media/MediaLoader"
import { Zoomed } from "../../slide/Zoomed"
import { Textbox } from "../../slide/Textbox"
import { Snaplines, type Snapline, type SnaplinesMouse } from "../../../shared/ui/system/Snaplines"
import { useStore } from "../../../shared/ui/hooks/useStore"

export interface TemplateSlideProps {
    templateId: string
    template: Template
    width?: number
    height?: number
    zoom?: number
    ratio?: number
    preview?: boolean
    edit?: boolean
    newStyles?: { [key: string]: string | number }
    onRatioChange?: (ratio: number) => void
    onNewStylesChange?: (styles: { [key: string]: string | number }) => void
}

// Port de components/drawer/pages/TemplateSlide.svelte (F24.21c).
export function TemplateSlide({ templateId, template, width = 0, height = 0, zoom = 1, ratio = 1, preview = false, edit = false, newStyles = {}, onRatioChange, onNewStylesChange }: TemplateSlideProps) {
    const currentActiveEdit = useStore(activeEdit)
    const currentOutputs = useStore(outputs)
    const currentOverlays = useStore(overlays)
    const currentStyles = useStore(styles)
    const currentPreviewOutputId = useStore(previewOutputId)

    const [lines, setLines] = useState<Snapline[]>([])
    const [mouse, setMouse] = useState<SnaplinesMouse | null>(null)
    const [localNewStyles, setLocalNewStyles] = useState<{ [key: string]: string | number }>(newStyles)
    const [mediaPath, setMediaPath] = useState("")
    const [thumbnailPath, setThumbnailPath] = useState("")
    const loadToken = useRef(0)

    const activeItems = currentActiveEdit.items || []

    // Mantener newStyles sincronizado si el padre lo cambia (bind desde TemplateEditor).
    const lastNewStylesRef = useRef(newStyles)
    useEffect(() => {
        if (lastNewStylesRef.current !== newStyles) {
            lastNewStylesRef.current = newStyles
            setLocalNewStyles(newStyles)
        }
    }, [newStyles])

    function handleNewStylesChange(value: { [key: string]: string | number }) {
        setLocalNewStyles(value)
        lastNewStylesRef.current = value
        onNewStylesChange?.(value)
    }

    const resolution = getResolution(null, { $outputs: currentOutputs, $styles: currentStyles, $previewOutputId: currentPreviewOutputId })

    const bgPath = template?.settings?.backgroundPath || ""
    useEffect(() => {
        const token = ++loadToken.current
        async function loadBackground() {
            if (!bgPath) {
                setMediaPath("")
                setThumbnailPath("")
                return
            }
            setMediaPath(bgPath)
            setThumbnailPath(getThumbnailPath(bgPath, mediaSize.slideSize))
            const media = await getMedia(bgPath, mediaSize.slideSize)
            if (token !== loadToken.current || !media) return
            setMediaPath(media.path)
            setThumbnailPath(media.thumbnail)
        }
        void loadBackground()
        return () => {
            token // no-op to satisfy lint-like thinking; token check handles staleness
        }
    }, [bgPath])

    const overlayId = template.settings?.overlayId || ""
    const overlay = currentOverlays[overlayId] || null

    const checkered = (!preview || (template.items?.length || 0) > 0) && !template.settings?.backgroundColor && !thumbnailPath
    const mode = template?.settings?.mode || "default"

    const zoomedBackground = !preview || template.items?.length || 0 ? template.settings?.backgroundColor || (preview ? "var(--primary);" : "transparent") : template.color || "var(--primary);"
    const zoomedStyle = width && height ? getStyleResolution(resolution, width, height, "fit", { zoom }) : ""

    return (
        <Zoomed background={zoomedBackground} checkered={checkered} border={!preview && checkered} resolution={resolution} style={zoomedStyle} onRatioChange={onRatioChange} hideOverflow={!edit} center={edit}>
            {thumbnailPath ? (
                <div className="background" style={{ zoom: 1 / ratio, opacity: 0.5, height: "100%", width: "100%" }}>
                    <MediaLoader path={mediaPath} thumbnailPath={thumbnailPath} />
                </div>
            ) : null}

            {edit && mode !== "text" ? (
                <>
                    <Snaplines lines={lines} mouse={mouse} newStyles={localNewStyles} ratio={ratio} active={activeItems} onLinesChange={setLines} onMouseChange={setMouse} onNewStylesChange={handleNewStylesChange} />
                    {(template.items || []).map((item, index) => (
                        <Editbox key={index} ref={{ type: "template", id: templateId }} item={item} index={index} ratio={ratio} mouse={(mouse as unknown as Parameters<typeof Editbox>[0]["mouse"]) || undefined} onMouseChange={(m) => setMouse(m as unknown as SnaplinesMouse)} />
                    ))}
                </>
            ) : (
                (template.items || []).map((item, i) => <Textbox key={i} backdropFilter={(template as { "backdrop-filter"?: string })["backdrop-filter"] || ""} item={item} ref={{ type: "template", id: templateId }} dynamicValues={false} isTemplatePreview />)
            )}

            {overlay?.items ? (
                <div style={edit ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
                    {overlay.items.map((item, i) => (
                        <Textbox key={i} item={item} ref={{ type: "overlay", id: overlayId }} preview miniPreview />
                    ))}
                </div>
            ) : null}
        </Zoomed>
    )
}
