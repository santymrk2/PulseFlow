import { useEffect, useRef, useState } from "react"
import { computeDisplayLayout, type LayoutDisplay } from "../../components/screens/displayLayout"
import { cn } from "../../lib/utils"
import { Icon } from "../helpers/Icon"
import styles from "./DisplayLayout.module.css"

// Port de components/screens/DisplayLayout.svelte (F24.14): dibujo reutilizable de la disposición de monitores.
// Recibe los monitores (de `GET_DISPLAYS`, en píxeles lógicos) y un tamaño de contenedor, calcula la disposición con
// `computeDisplayLayout` y dibuja cada monitor. Es presentacional: el clic sobre un monitor sale por `onSelect`.
export interface DisplayLayoutProps {
    displays?: LayoutDisplay[]
    /** Ancho del contenedor en px. */
    width?: number
    /** Alto del contenedor en px. */
    height?: number
    /** Id del monitor asignado a la salida actual (se resalta). */
    assignedId?: string | null
    /** Si es `true`, el dibujo ocupa el ancho del contenedor (`width` deja de mandar) y no sale del panel. */
    fill?: boolean
    onSelect?: (display: LayoutDisplay) => void
}

export function DisplayLayout({ displays = [], width = 480, height = 320, assignedId = null, fill = false, onSelect }: DisplayLayoutProps) {
    // equivale a `bind:clientWidth={box}`
    const [box, setBox] = useState(0)
    const host = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = host.current
        if (!el) return
        setBox(el.clientWidth)
        const observer = new ResizeObserver(() => setBox(el.clientWidth))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // con `fill` se toma el ancho real del panel y el alto guarda la proporción de `width`×`height`
    const drawWidth = fill && box ? box : width
    const drawHeight = fill && box ? Math.round((box * height) / width) : height
    const layout = computeDisplayLayout(displays, { width: drawWidth, height: drawHeight })

    return (
        <div ref={host} className={cn(styles.displayLayout, fill && styles.fill)} style={fill ? { height: `${drawHeight}px` } : { width: `${drawWidth}px`, height: `${drawHeight}px` }}>
            {layout.displays.map((item) => {
                const label = item.display.label || `Display ${item.number}`
                const { width: w, height: h } = item.display.bounds
                return (
                    <div key={item.display.id} className={cn(styles.monitor, item.display.primary && styles.primary, assignedId === item.display.id && styles.assigned)} style={{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px`, height: `${item.height}px` }} role="button" tabIndex={0} data-title={label} onClick={() => onSelect?.(item.display)} onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onSelect?.(item.display) : null)}>
                        <span className={styles.number}>{item.number}</span>
                        {item.display.primary ? (
                            <span className={cn(styles.badge, styles.primary)} data-title="primary">
                                <Icon id="star" size={0.8} />
                            </span>
                        ) : null}
                        {assignedId === item.display.id ? (
                            <span className={cn(styles.badge, styles.assigned)} data-title="assigned">
                                <Icon id="check" size={0.8} />
                            </span>
                        ) : null}
                        {item.width > 90 ? (
                            <span className={styles.meta}>
                                <span className={styles.name}>{label}</span>
                                <span className={styles.res}>{`${w}×${h}`}</span>
                            </span>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
