import { useEffect, useState, type CSSProperties, type HTMLAttributes } from "react"
import { dictionary } from "../../shared/core/stores"
import { translateText } from "../../utils/language"
import { Icon } from "../helpers/Icon"
import { useStore } from "../hooks/useStore"
import { cn } from "../../shared/core/lib/utils"
import styles from "./HoverPlay.module.css"

// Port de components/helpers/HoverPlay.svelte. on:click/dblclick/mousedown/contextmenu y {...$$restProps} → props del div.
export interface HoverPlayProps extends HTMLAttributes<HTMLDivElement> {
    icon: string
    size?: number
    title?: string
    hide?: boolean
    style?: CSSProperties
}

export function HoverPlay({ icon, size = 5, title = "media.play", hide = false, style, className, children, ...rest }: HoverPlayProps) {
    const dict = useStore(dictionary)
    // se desvanece a los 800 ms (para mostrarse a sí mismo)
    const [reveal, setReveal] = useState(true)
    useEffect(() => {
        const timer = setTimeout(() => setReveal(false), 800)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div {...rest} style={style} className={cn(styles.root, className)} role="none" data-title={hide ? "" : translateText(title, dict)}>
            {children}

            <div className={cn(styles.overlay, reveal && styles.reveal, hide && styles.hidden)}>
                <Icon id={icon} size={size} white />
            </div>
        </div>
    )
}
