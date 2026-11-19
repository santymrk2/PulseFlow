import type { Item } from "../../../../types/Show"
import { ItemsList } from "./ItemsList"
import styles from "./OverlayStyle.module.css"

export interface OverlayStyleProps {
    allSlideItems: Item[]
    onAllSlideItemsChange?: (items: Item[]) => void
}

export function OverlayStyle({ allSlideItems }: OverlayStyleProps) {
    return (
        <div className={styles.tools}>
            <ItemsList allSlideItems={allSlideItems} />
        </div>
    )
}
