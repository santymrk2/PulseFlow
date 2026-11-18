import type { Item } from "../../../../types/Show"
import { cn } from "../../../lib/utils"
import { Icon } from "../../helpers/Icon"
import styles from "./IconItem.module.css"

export interface IconItemProps {
    item: Item
    ratio?: number
}

// (F24.18a).
export function IconItem({ item, ratio = 1 }: IconItemProps) {
    const customColor = typeof item?.style === "string" && item.style.includes("color:") && !item.style.includes("color:;")

    return (
        <div className={styles.iconItem} style={{ display: "contents" }}>
            {item.customSvg ? <div className={cn(styles.customIcon, customColor && styles.customColor)} dangerouslySetInnerHTML={{ __html: item.customSvg }} /> : <Icon style={{ zoom: 1 / ratio }} id={item.id || ""} fill white custom />}
        </div>
    )
}
