import type { CSSProperties } from "react"
import type { Selected } from "../../../types/Main"
import { cn } from "../../shared/core/lib/utils"
import { defaultColors, fadeColor } from "../../shared/utils/helpers/color"
import { activePopup, localeDirection, selected } from "../../shared/core/stores"
import { customIcons } from "../../shared/core/values/customIcons"
import icons from "../../shared/core/values/icons"
import { useStore } from "../hooks/useStore"
import { triggerClickOnEnterSpace } from "./triggerClickOnEnterSpace"
import styles from "./Icon.module.css"

export interface IconProps {
    id: string
    color?: string
    title?: string
    size?: number
    white?: boolean
    right?: boolean
    fill?: boolean
    custom?: boolean
    select?: boolean
    selectData?: Selected | null
    box?: number
    boxed?: boolean
    className?: string
    style?: CSSProperties
}

const FLIPPED_ICONS: readonly string[] = ["back"] // Mismo criterio que Icon.svelte: agregar acá los que se espejan en RTL
// Color por defecto de los íconos "boxed" sin color (era blanco en Icon.svelte). Sale de la paleta, sin hex en el .tsx
const BOXED_DEFAULT_COLOR = defaultColors.find((c) => c.name === "White")?.value ?? ""
const customIconTable: Record<string, string | undefined> = customIcons

export function Icon({ id, color = "", title = "", size = 1, white = false, right = false, fill = false, custom = false, select = false, selectData = null, box = 24, boxed = false, className, style }: IconProps) {
    const direction = useStore(localeDirection)
    const currentSelected = useStore(selected)

    const width = `${size * (boxed ? 1.2 : 1)}rem`
    const height = `${size * (boxed ? 1.2 : 1)}rem`
    const iconColor = boxed && !color ? BOXED_DEFAULT_COLOR : color
    const flip = direction === "rtl" && FLIPPED_ICONS.includes(id)
    const markup = (custom || !icons[id] ? customIconTable[id] : icons[id]) || icons.noIcon

    const inlineStyle: CSSProperties = {
        ...style,
        ...(iconColor ? { color: iconColor } : {}),
        ...(boxed && iconColor ? { backgroundColor: fadeColor(iconColor, 0.3) } : {}),
        minWidth: width,
        ...(boxed ? { minHeight: height } : {})
    }

    function openSelect() {
        if (!select) return

        if (selectData && !currentSelected.data.includes(selectData.data[0])) selected.set(selectData)
        activePopup.set("icon")
    }

    return (
        <svg
            className={cn(styles.icon, flip && styles.flip, white && styles.white, right && styles.right, fill && styles.fill, boxed && styles.boxed, select && styles.select, className)}
            style={inlineStyle}
            width={width}
            height={height}
            viewBox={`0 0 ${box} ${box}`}
            data-title={title}
            role={select ? "button" : undefined}
            tabIndex={select ? 0 : undefined}
            onClick={select ? openSelect : undefined}
            onKeyDown={select ? triggerClickOnEnterSpace : undefined}
            dangerouslySetInnerHTML={{ __html: markup }}
        />
    )
}
