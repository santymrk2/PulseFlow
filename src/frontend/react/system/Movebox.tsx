import { useMemo, useRef, type MouseEvent } from "react"
import { openToolsTab } from "../../stores"
import { getStyles } from "../../components/helpers/style"
import { radiusHandleSize, radiusSliderOffset, radiusSliderRatio } from "../../components/system/textbox"
import styles from "./Movebox.module.css"

export interface MoveboxProps {
    ratio?: number
    itemStyle?: string
    active: boolean
    onlyCorners?: boolean
}

const corners = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const
const sides = ["n", "e", "s", "w"] as const
const DEG_PER_RAD = 180 / Math.PI

function getRotationDeg(style: string) {
    if (typeof style !== "string" || !style) return 0
    const match = style.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)
    const rotation = Number(match?.[1])
    return Number.isFinite(rotation) ? rotation : 0
}

function parseMatrixValues(transform: string) {
    const match = transform.match(/matrix3d?\(([^)]+)\)/)
    if (!match) return []
    return match[1].split(",").map((v) => Number(v.trim()))
}

function getRotationDegFromComputedTransform(transform: string) {
    if (!transform || transform === "none") return null
    const values = parseMatrixValues(transform)
    if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
        return Math.atan2(values[1], values[0]) * DEG_PER_RAD
    }
    return null
}

function getHandleVector(handle: string) {
    return {
        x: handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0,
        y: handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0
    }
}

function rotateVector(vector: { x: number; y: number }, degrees: number) {
    if (!degrees || !Number.isFinite(degrees)) return vector
    const rad = (degrees * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return {
        x: vector.x * cos - vector.y * sin,
        y: vector.x * sin + vector.y * cos
    }
}

// Port de components/system/Movebox.svelte (F24.21c).
export function Movebox({ ratio = 1, itemStyle = "", active, onlyCorners = false }: MoveboxProps) {
    const moveboxElem = useRef<HTMLElement>(null)
    const parsedStyles = useMemo(() => getStyles(itemStyle, true) as Record<string, string>, [itemStyle])
    const styleRotationDeg = useMemo(() => getRotationDeg(itemStyle), [itemStyle])

    function readLiveRotation() {
        if (!moveboxElem.current) return null
        const itemElem = (moveboxElem.current.closest(".stage_item") || moveboxElem.current.closest(".item")) as HTMLElement | null
        if (!itemElem) return null

        const inlineRotation = getRotationDeg(itemElem.getAttribute("style") || "")
        if (inlineRotation) return inlineRotation

        const transform = getComputedStyle(itemElem).transform
        return getRotationDegFromComputedTransform(transform)
    }

    function getResizeCursor(handle: string, degrees = styleRotationDeg) {
        const { x, y } = rotateVector(getHandleVector(handle), degrees)
        if (handle.length === 1) {
            return Math.abs(x) > Math.abs(y) ? "ew-resize" : "ns-resize"
        }

        const invSqrt2 = 1 / Math.sqrt(2)
        const dotNwSe = Math.abs(x * invSqrt2 + y * invSqrt2)
        const dotNeSw = Math.abs(x * invSqrt2 + y * -invSqrt2)
        return dotNwSe >= dotNeSw ? "nwse-resize" : "nesw-resize"
    }

    function syncHandleCursor(e: MouseEvent<HTMLDivElement>, handle: string) {
        const target = e.currentTarget as HTMLElement | null
        if (!target) return
        const liveDeg = readLiveRotation() ?? styleRotationDeg
        target.style.cursor = getResizeCursor(handle, liveDeg)
    }

    return (
        <section ref={moveboxElem} className="hideFromAutosize">
            {sides.map((line) => (
                <div key={line} className={`line ${line}l ${styles.line} ${styles[`${line}l` as keyof typeof styles] || ""} ${active ? `active ${styles.active}` : ""}`} style={{ [line === "n" || line === "s" ? "height" : "width"]: `${active ? 25 : 50}px` } as React.CSSProperties} />
            ))}
            {corners.map((square) => {
                if (onlyCorners && square.length <= 1) return null
                return <div key={square} onMouseDown={() => openToolsTab.set("item")} onMouseEnter={(e) => syncHandleCursor(e, square)} onMouseMove={(e) => syncHandleCursor(e, square)} className={`square ${square} ${styles.square} ${styles[square as keyof typeof styles] || ""} ${active ? `active ${styles.active}` : ""}`} style={{ width: `${10 / ratio}px`, cursor: getResizeCursor(square) }} />
            })}
            <div className={`rotate ${styles.rotate} ${active ? `active ${styles.active}` : ""}`} style={{ width: `${8 / ratio}px`, ["--line-width" as string]: `${3 / ratio}px` }}></div>
            <div className={`radius ${styles.radius} ${active ? `active ${styles.active}` : ""}`} style={{ width: `${radiusHandleSize / ratio}px`, left: `${(Number(parsedStyles["border-radius"]) || 0) * radiusSliderRatio + radiusSliderOffset}px` }}></div>
        </section>
    )
}
