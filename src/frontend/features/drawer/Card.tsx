import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react"
import type { Resolution } from "../../../types/Settings"
import { Loader } from "../../app/main/Loader"
import { triggerClickOnEnterSpace } from "../../shared/ui/helpers/triggerClickOnEnterSpace"
import { cn } from "../../shared/core/lib/utils"
import { dictionary, mediaOptions, outputs, previewOutputId, styles as stylesStore } from "../../shared/core/stores"
import { translateText } from "../../shared/utils/language"
import { getResolution } from "../../shared/utils/helpers/output"
import { Icon } from "../../shared/ui/helpers/Icon"
import { useStore } from "../../shared/ui/hooks/useStore"
import { Label } from "./Label"
import styles from "./Card.module.css"

// Port de components/drawer/Card.svelte. `class`/`style` de $$props → className/style (van al div .card, como en el original).
// `on:mousedown/click/dblclick` y `on:mouseenter/leave/move` reenviados → props con el evento DOM; `on:keydown={triggerClickOnEnterSpace}`
// no se reenvía (tenía handler local). `<slot />` → children. Loader es el port React.
export interface CardProps {
    loaded?: boolean
    preview?: boolean
    active?: boolean
    outlineColor?: null | string
    label: string
    count?: number
    renameId?: string
    title?: string
    mediaData?: string
    width?: number
    icon?: null | string
    color?: null | string
    white?: boolean
    showPlayOnHover?: boolean
    showApplyOnHover?: boolean
    checkered?: boolean
    mode?: "grid" | "list" | "lyrics"
    resolution?: Resolution
    className?: string
    style?: CSSProperties
    children?: ReactNode
    onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void
    onClick?: (event: MouseEvent<HTMLDivElement>) => void
    onDblClick?: (event: MouseEvent<HTMLDivElement>) => void
    onMouseEnter?: (event: MouseEvent<HTMLDivElement>) => void
    onMouseLeave?: (event: MouseEvent<HTMLDivElement>) => void
    onMouseMove?: (event: MouseEvent<HTMLDivElement>) => void
}

export function Card({ loaded = true, preview = false, active = false, outlineColor = null, label, count = 0, renameId = "", title = "", mediaData = "", width = 0, icon = null, color = null, white = true, showPlayOnHover = false, showApplyOnHover = false, checkered = false, mode = "grid", resolution, className, style, children, onMouseDown, onClick, onDblClick, onMouseEnter, onMouseLeave, onMouseMove }: CardProps) {
    const dict = useStore(dictionary)
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(stylesStore)
    const previewOutputIdValue = useStore(previewOutputId)
    const mediaOptionsValue = useStore(mediaOptions)

    // `$: resolution = getResolution(resolution, { $outputs, $styles })`: con width ya puesto, getResolution devuelve la misma resolución.
    const [defaultResolution] = useState(() => getResolution(null, { outputs: outputsValue, styles: stylesValue, previewOutputId: previewOutputIdValue }))
    const currentResolution = resolution ?? defaultResolution
    const mainWidth = width || (mode === "grid" ? 100 / mediaOptionsValue.columns : 100)

    const mainStyle: CSSProperties = {
        ...(outlineColor ? { outline: `2px solid ${outlineColor}` } : {}),
        flexDirection: mode === "grid" ? "column" : "row",
        width: `${mainWidth}%`
    }
    const cardStyle: CSSProperties = { ...style, aspectRatio: `${currentResolution.width}/${currentResolution.height}` }

    return (
        <div className={cn(styles.main, preview && styles.preview, active && styles.active)} style={mainStyle}>
            <div className={styles.over} style={{ flexDirection: mode === "grid" ? "column" : "row", width: "100%" }} onMouseDown={onMouseDown} onClick={onClick} onDoubleClick={onDblClick} onKeyDown={triggerClickOnEnterSpace} tabIndex={0} role="button">
                {preview ? <div className={styles.overlay} /> : <div className={cn(styles.hover, styles.overlay)} />}
                <div data-title={showPlayOnHover ? translateText(active ? "clear.general" : "media.play", dict) : ""} data-media={mediaData} className={cn(styles.card, className, checkered && "checkered")} style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove}>
                    {!loaded ? (
                        <div className={styles.loader}>
                            <Loader />
                        </div>
                    ) : showPlayOnHover ? (
                        <div className={styles.overlayIcon}>
                            <Icon id={active ? "clear" : "play"} size={2} white />
                        </div>
                    ) : showApplyOnHover && !active ? (
                        <div className={styles.overlayIcon}>
                            <Icon id="export" size={2} white />
                        </div>
                    ) : null}
                    {children}
                </div>
                <Label label={label} count={count} renameId={renameId} title={title} icon={icon} white={white} color={color} mode={mode} />
            </div>
        </div>
    )
}
