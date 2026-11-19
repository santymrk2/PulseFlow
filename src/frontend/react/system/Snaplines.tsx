import { useEffect, useRef } from "react"
import { outputs } from "../../shared/core/stores"
import { throttle } from "../../shared/utils/common"
import { stopResizing } from "../../shared/utils/cursor"
import { DEFAULT_BOUNDS, getActiveOutputs, getOutputResolution, getStageResolution } from "../../shared/utils/helpers/output"
import { shouldStartDrag } from "../../components/system/dragThreshold"
import { getRadius, moveBox, resizeBox, rotateBox } from "../../components/system/textbox"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { useStore } from "../hooks/useStore"
import styles from "./Snaplines.module.css"

export interface SnaplinesMouse {
    x: number
    y: number
    left: number
    top: number
    width: number
    height: number
    offset: { x: number; y: number; width: number; height: number }
    item: { type?: string; style?: string; [key: string]: unknown }
    e: MouseEvent
    dragMove?: boolean
    rightClick?: boolean
    initialPositions?: { [key: string]: { left: number; top: number } }
}

export type Snapline = [string, number]

export interface SnaplinesProps {
    lines: Snapline[]
    mouse: SnaplinesMouse | null
    newStyles: { [key: string]: string | number }
    ratio: number
    active: (number | string)[]
    isStage?: boolean
    onLinesChange?: (lines: Snapline[]) => void
    onMouseChange?: (mouse: SnaplinesMouse | null) => void
    onNewStylesChange?: (newStyles: { [key: string]: string | number }) => void
}

// Port de components/system/Snaplines.svelte (F24.19a, componente de soporte).
// Los binds Svelte (`lines`, `mouse`, `newStyles`) pasan a callbacks explícitos.
export function Snaplines({ lines, mouse, newStyles, ratio, active, isStage = false, onLinesChange, onMouseChange, onNewStylesChange }: SnaplinesProps) {
    const currentOutputs = useStore(outputs)
    const stylesRef = useRef<{ [key: string]: any }>({})

    // Los listeners de window se registran una sola vez: leemos siempre el último valor de las props.
    const latest = useRef({ lines, mouse, newStyles, ratio, active, isStage, currentOutputs, onLinesChange, onMouseChange, onNewStylesChange })
    latest.current = { lines, mouse, newStyles, ratio, active, isStage, currentOutputs, onLinesChange, onMouseChange, onNewStylesChange }

    useEffect(() => {
        function mousemove(e: MouseEvent) {
            const { lines, mouse, ratio, active, isStage, currentOutputs, onLinesChange, onMouseChange, onNewStylesChange } = latest.current
            if (!mouse?.item || mouse.rightClick) return

            const target = mouse.e.target as Element
            let currentLines: Snapline[] = [...lines]
            const notTextBox: boolean = mouse.item.type !== undefined && mouse.item.type !== "text"
            const isShift = e.shiftKey || mouse.e.shiftKey
            const control = mouse.e.ctrlKey || mouse.e.metaKey

            // Arrastrar desde el texto de un cuadro mueve el cuadro (el clic sin arrastrar sigue poniendo el cursor de texto).
            const fromText = !notTextBox && !control && !isShift && !mouse.e.altKey && !!target.closest(".edit") && !target.closest(".line, .square, .rotate, .radius, .chords")
            if (fromText && !mouse.dragMove) {
                if (!shouldStartDrag(mouse.x, mouse.y, e.clientX, e.clientY)) return
                mouse.dragMove = true
                onMouseChange?.(mouse)
            }
            const dragFromText = fromText && !!mouse.dragMove
            if (dragFromText) {
                window.getSelection()?.removeAllRanges()
                ;(document.activeElement as HTMLElement | null)?.blur?.()
            }

            if (!notTextBox && !control && !isShift && !dragFromText && !target.closest(".line") && !target.closest(".square") && !target.closest(".rotate") && !target.closest(".radius")) return

            e.preventDefault()
            let styles: { [key: string]: any } = {}
            stylesRef.current = styles

            const moveCondition: boolean = !!target.closest(".line") || ((!target.closest(".edit") || notTextBox || mouse.e.altKey || isShift) && !target.closest(".square")) || (control && !target.closest(".square")) || mouse.e.buttons === 4 || dragFromText

            const keepAspectRatio = e.shiftKey
            // WIP square option currently not working well (also custom SVG icons can be any ratio)
            const square = false

            if (target.closest(".rotate")) {
                const rotation = rotateBox(e, mouse, ratio)
                styles = { transform: `rotate(${rotation.toFixed(2)}deg);` }
            } else if (target.closest(".radius")) {
                const radius = getRadius(e, mouse, ratio)
                styles = { "border-radius": `${radius.toFixed(2)}px;` }
            } else if (moveCondition) {
                const moved = moveBox(e, mouse, ratio, active, currentLines)
                styles = moved.styles
                currentLines = moved.lines
            } else if (target.closest(".square")) {
                styles = resizeBox(e, mouse, keepAspectRatio, ratio, control, square)
                if (!e.altKey) {
                    const moved = moveBox(e, mouse, ratio, active, currentLines, styles)
                    styles = moved.styles
                    currentLines = moved.lines
                }
            }
            stylesRef.current = styles

            // deduplicate lines that have the exact same position
            const uniqueLines: Snapline[] = []
            for (const line of currentLines) {
                const lineType = line[0][0] // "x" or "y"
                const duplicateIndex = uniqueLines.findIndex((existing) => existing[0][0] === lineType && Math.abs(existing[1] - line[1]) < 0.5)
                if (duplicateIndex === -1) {
                    uniqueLines.push(line)
                } else if (line[0].endsWith("c") && !uniqueLines[duplicateIndex][0].endsWith("c")) {
                    // Prefer center line marker over standard line marker if at the same position
                    uniqueLines[duplicateIndex] = line
                }
            }
            currentLines = uniqueLines

            // show max 3 lines of each orientation at once
            const MAX_LINES = 3
            const xLines = currentLines.filter((line) => line[0] === "x" || line[0] === "xc").slice(0, MAX_LINES)
            const yLines = currentLines.filter((line) => line[0] === "y" || line[0] === "yc").slice(0, MAX_LINES)
            currentLines = [...xLines, ...yLines]
            onLinesChange?.(currentLines)

            // percentage scale
            const outputId = isStage ? "" : getActiveOutputs(currentOutputs, true, true, true)[0]
            const outputResolution = isStage ? getStageResolution() : getOutputResolution(outputId, currentOutputs, true)
            const aspectRatio = outputResolution.width / outputResolution.height
            const width = DEFAULT_BOUNDS.width
            const height = DEFAULT_BOUNDS.width / aspectRatio

            if (styles.__multiPositions) {
                const multiPositions = styles.__multiPositions as { [key: string]: { left: number; top: number } }
                Object.keys(multiPositions).forEach((id) => {
                    const pos = multiPositions[id]
                    const scaledLeft = DEFAULT_BOUNDS.width * (Number(pos.left) / width)
                    const scaledTop = DEFAULT_BOUNDS.height * (Number(pos.top) / height)
                    multiPositions[id] = {
                        left: scaledLeft.toFixed(2) + "px",
                        top: scaledTop.toFixed(2) + "px"
                    } as never
                })
            } else {
                if (styles.left) styles.left = DEFAULT_BOUNDS.width * (Number(styles.left) / width)
                if (styles.top) styles.top = DEFAULT_BOUNDS.height * (Number(styles.top) / height)
                if (styles.width) styles.width = DEFAULT_BOUNDS.width * (Number(styles.width) / width)
                if (styles.height) styles.height = DEFAULT_BOUNDS.height * (Number(styles.height) / height)

                // finalize values
                Object.keys(styles).forEach((key) => {
                    if (styles[key] === undefined || styles[key].toString().includes("px") || styles[key].toString().includes("deg")) return
                    if (key === "width" || key === "height") styles[key] = Math.max(16 / ratio, Number(styles[key]))
                    styles[key] = Number(styles[key]).toFixed(2) + "px"
                })
            }

            throttle("EDIT_ITEM_MOVE", styles, (value) => onNewStylesChange?.(value), 50)
        }

        function mouseup() {
            const { onLinesChange, onMouseChange, onNewStylesChange } = latest.current
            stopResizing()
            onMouseChange?.(null)
            onLinesChange?.([])
            onNewStylesChange?.({})
        }

        window.addEventListener("mousemove", mousemove)
        window.addEventListener("mouseup", mouseup)
        return () => {
            window.removeEventListener("mousemove", mousemove)
            window.removeEventListener("mouseup", mouseup)
            stopResizing()
        }
    }, [])

    return (
        <>
            {lines.map((line, index) => {
                const isX = line[0].includes("x")
                const isCenter = line[0].endsWith("c")
                const thickness = (isCenter ? 2.5 : 1.25) / ratio
                const position = isX ? `left: ${line[1]}px; width: ${thickness}px; height: 100%;` : `top: ${line[1]}px; height: ${thickness}px; width: 100%;`
                return <div key={`${line[0]}-${index}`} className={`line ${line[0]} ${styles.line}`} style={cssTextToStyle(`${position}transform: translate${isX ? "X" : "Y"}(-50%);`)} />
            })}
        </>
    )
}
