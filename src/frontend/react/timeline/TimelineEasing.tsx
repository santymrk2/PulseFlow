import { Fragment, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import type { TimelineAction } from "../../../types/Show"
import { actionData } from "../../components/actions/actionData"
import { getActionEasing, getSegmentCurve, getSegmentCurvePoints, toStoredActionEasing } from "../../components/timeline/easingHelper"
import type { EasingHandles } from "../../components/timeline/easingHelper"
import type { TimelineActions } from "../../components/timeline/TimelineActions"
import { cn } from "../../lib/utils"
import { translateText } from "../../utils/language"
import { cssTextToStyle } from "../helpers/cssTextToStyle"
import { Icon } from "../helpers/Icon"
import styles from "./TimelineEasing.module.css"

interface EasingPoint {
    id: string
    x: number
    y: number
    action: TimelineAction
}

interface ContextMenuState {
    curveIndex: number
    pin: 1 | 2
    x: number
    y: number
}

export interface TimelineEasingProps {
    groupedActions: TimelineAction[][]
    actions: TimelineAction[]
    selectedActionIds: string[]
    selectedItemIndexes: number[]
    activeGroupIndex: number | null
    zoomLevel: number
    sectionHeight: number
    sectionGap: number
    sectionTop: number
    onActionDrag: (event: MouseEvent, id: string) => void
    onClearSelection?: () => void
    timeline: TimelineActions
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const Y_OFFSET = 12

// (F24.19b).
// `dispatch("clearSelection")` pasa a la prop `onClearSelection`; el resto de props son idénticas.
export function TimelineEasing({ groupedActions, actions, selectedActionIds, selectedItemIndexes, activeGroupIndex, zoomLevel, sectionHeight, sectionGap, sectionTop, onActionDrag, onClearSelection, timeline }: TimelineEasingProps) {
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null)
    const dragState = useRef<{ curveIndex: number; pin: 1 | 2 } | null>(null)
    const dragCurveOffset = useRef({ x: 0, y: 0 })
    const dragCleanup = useRef<(() => void) | null>(null)

    let points: EasingPoint[] = []
    let easingCurvesPx: EasingHandles[] = []

    if (activeGroupIndex !== null && groupedActions && groupedActions[activeGroupIndex]) {
        const group = groupedActions[activeGroupIndex]
        const minValue = Math.min(...group.map((a) => (typeof a.data?.value === "number" ? a.data.value : Infinity)))
        const maxValue = Math.max(...group.map((a) => (typeof a.data?.value === "number" ? a.data.value : -Infinity)))
        const valueRange = maxValue - minValue || 1

        points = actions
            .map((action) => {
                const correctKey = group[0]?.data?.key === action.data?.key
                if (!correctKey) return null
                const faded = action.type === "style" && !(action.data?.indexes ?? [0])?.some((a: number) => selectedItemIndexes.includes(a))
                if (faded) return null

                const top = 100 - (((typeof action.data?.value === "number" ? action.data.value : 0) - minValue) / valueRange) * 80
                return { id: action.id, x: (action.time / 1000) * zoomLevel, y: top, action } as EasingPoint
            })
            .filter((p): p is EasingPoint => p !== null)
            .sort((a, b) => a.action.time - b.action.time)

        easingCurvesPx = points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1]
            const curve = getSegmentCurve(p1.action, p2.action)
            return getSegmentCurvePoints(p1, p2, curve)
        })
    }

    function updateStoredEasing(action: TimelineAction, updater: (easing: EasingHandles) => EasingHandles) {
        const newEasing = toStoredActionEasing(updater(getActionEasing(action)))
        timeline.updateAction(action.id, { easing: newEasing })
    }

    function updateCurvePinDrag(e: MouseEvent) {
        const drag = dragState.current
        if (!drag) return
        const i = drag.curveIndex
        const pin = drag.pin
        const p1 = points[i]
        const p2 = points[i + 1]
        if (!p1 || !p2) return
        const dx = e.clientX - dragCurveOffset.current.x
        const dy = e.clientY - dragCurveOffset.current.y
        dragCurveOffset.current = { x: e.clientX, y: e.clientY }
        const dt = p2.x - p1.x || 1
        const dv = p2.y - p1.y || 1
        if (pin === 1) {
            updateStoredEasing(p2.action, (easing) => ({
                x1: clamp(easing.x1 + dx / dt, 0, 1),
                y1: clamp(easing.y1 + dy / dv, -2, 2),
                x2: easing.x2,
                y2: easing.y2
            }))
        } else {
            updateStoredEasing(p1.action, (easing) => ({
                x1: easing.x1,
                y1: easing.y1,
                x2: clamp(easing.x2 + dx / dt, 0, 1),
                y2: clamp(easing.y2 + dy / dv, -2, 2)
            }))
        }
    }

    function startCurvePinDrag(e: ReactMouseEvent<HTMLDivElement>, curveIndex: number, pin: 1 | 2) {
        e.stopPropagation()
        dragState.current = { curveIndex, pin }
        dragCurveOffset.current = { x: e.clientX, y: e.clientY }
        dragCleanup.current?.()
        const move = (event: MouseEvent) => updateCurvePinDrag(event)
        const up = () => {
            dragState.current = null
            dragCleanup.current?.()
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
        dragCleanup.current = () => {
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mouseup", up)
            dragCleanup.current = null
        }
    }

    useEffect(() => () => dragCleanup.current?.(), [])

    function setCurvePinLinear(i: number, pin: 1 | 2) {
        if (!points[i]) return
        const p = points[i]
        if (pin === 1) updateStoredEasing(p.action, (easing) => ({ x1: 0.5, y1: 0.5, x2: easing.x2, y2: easing.y2 }))
        else if (pin === 2) updateStoredEasing(p.action, (easing) => ({ x1: easing.x1, y1: easing.y1, x2: 0.5, y2: 0.5 }))
    }

    function applyCurvePinPreset(i: number, pin: 1 | 2, preset: "linear" | "ease") {
        const value = preset === "linear" ? { x: 0.5, y: 0.5 } : pin === 1 ? { x: 0.58, y: 1 } : { x: 0.42, y: 0 }

        const targetActionIndexes = new Set<number>()
        points.forEach((point, index) => {
            if (!selectedActionIds.includes(point.id)) return
            const pinVisible = pin === 1 ? index > 0 : index < points.length - 1
            if (pinVisible) targetActionIndexes.add(index)
        })

        if (targetActionIndexes.size === 0) {
            const fallbackIndex = pin === 1 ? i + 1 : i
            if (fallbackIndex >= 0 && fallbackIndex < points.length) targetActionIndexes.add(fallbackIndex)
        }

        targetActionIndexes.forEach((actionIndex) => {
            const p = points[actionIndex]
            if (!p) return
            if (pin === 1) updateStoredEasing(p.action, (easing) => ({ x1: value.x, y1: value.y, x2: easing.x2, y2: easing.y2 }))
            else if (pin === 2) updateStoredEasing(p.action, (easing) => ({ x1: easing.x1, y1: easing.y1, x2: value.x, y2: value.y }))
        })

        setContextMenuState(null)
    }

    useEffect(() => {
        const keydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setContextMenuState(null)
        }
        window.addEventListener("keydown", keydown)
        return () => window.removeEventListener("keydown", keydown)
    }, [])

    useEffect(() => {
        if (!contextMenuState) return
        const click = (e: MouseEvent) => {
            const menu = document.querySelector(".easing-context-menu")
            if (menu && !menu.contains(e.target as Node)) setContextMenuState(null)
        }
        window.addEventListener("click", click)
        return () => window.removeEventListener("click", click)
    }, [contextMenuState])

    function getLineStyle(x1: number, y1: number, x2: number, y2: number): string {
        const dx = x2 - x1
        const dy = y2 - y1
        const distance = Math.sqrt(dx * dx + dy * dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI
        return `position: absolute; left: ${x1}px; top: ${y1}px; width: ${distance}px; height: 1px; border-top: 1px dashed var(--secondary); transform: rotate(${angle}deg); transform-origin: 0 0; pointer-events: none; z-index: 3;`
    }

    function renderControlPoint(curveIndex: number, pin: 1 | 2, x: number, y: number) {
        return (
            <div
                className={cn("easing-control-point", styles["easing-control-point"])}
                style={{ left: `${x}px`, top: `${y - Y_OFFSET}px` }}
                onMouseDown={(e) => {
                    if (e.button === 1) {
                        e.preventDefault()
                        e.stopPropagation()
                        setCurvePinLinear(pin === 1 ? curveIndex + 1 : curveIndex, pin)
                    } else if (e.button === 0) {
                        startCurvePinDrag(e, curveIndex, pin)
                    } else if (e.button === 2) {
                        e.preventDefault()
                        e.stopPropagation()
                        setContextMenuState({ curveIndex, pin, x: e.clientX, y: e.clientY })
                    }
                }}
                onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
            />
        )
    }

    return (
        <>
            {activeGroupIndex !== null && groupedActions && groupedActions[activeGroupIndex] ? (
                <div className={cn("track-header easing", styles["track-header"], styles.easing)} style={{ top: `${sectionTop + activeGroupIndex * (sectionHeight + sectionGap) + sectionHeight}px`, height: "120px", width: "100%" }} onMouseDown={(e) => e.button === 0 && onClearSelection?.()}>
                    {points.length > 1 ? (
                        <svg className="easing-curve-svg" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", zIndex: 2 }} width="100%" height="100%">
                            {points.slice(0, -1).map((p1, i) => {
                                const p2 = points[i + 1]
                                const px = easingCurvesPx[i]
                                return <path key={p1.id} d={`M ${p1.x},${p1.y - Y_OFFSET} C ${px.x1},${px.y1 - Y_OFFSET} ${px.x2},${px.y2 - Y_OFFSET} ${p2.x},${p2.y - Y_OFFSET}`} stroke="var(--secondary)" strokeWidth={2} fill="none" opacity={0.7} style={{ pointerEvents: "none" }} />
                            })}
                        </svg>
                    ) : null}

                    {points.map((p, i) =>
                        selectedActionIds.includes(p.id) ? (
                            <Fragment key={`lines-${p.id}`}>
                                {i > 0 ? <div className={cn("easing-line", styles["easing-line"])} style={cssTextToStyle(getLineStyle(easingCurvesPx[i - 1].x2, easingCurvesPx[i - 1].y2 - Y_OFFSET, points[i].x, points[i].y - Y_OFFSET))} /> : null}
                                {i < points.length - 1 ? <div className={cn("easing-line", styles["easing-line"])} style={cssTextToStyle(getLineStyle(easingCurvesPx[i].x1, easingCurvesPx[i].y1 - Y_OFFSET, points[i].x, points[i].y - Y_OFFSET))} /> : null}
                            </Fragment>
                        ) : null
                    )}

                    {points.map((p, i) =>
                        selectedActionIds.includes(p.id) ? (
                            <Fragment key={`handles-${p.id}`}>
                                {i > 0 ? renderControlPoint(i - 1, 1, easingCurvesPx[i - 1].x2, easingCurvesPx[i - 1].y2) : null}
                                {i < points.length - 1 ? renderControlPoint(i, 2, easingCurvesPx[i].x1, easingCurvesPx[i].y1) : null}
                            </Fragment>
                        ) : null
                    )}

                    {points.map((p) => {
                        const triggers = (p.action.data as { triggers?: string[] } | undefined)?.triggers
                        const triggerIcon = triggers?.length === 1 ? actionData[triggers[0] as keyof typeof actionData]?.icon : "actions"
                        const index = (p.action.data as { index?: number } | undefined)?.index
                        const value = (p.action.data as { value?: number | string } | undefined)?.value
                        return (
                            <div
                                key={p.id}
                                className={cn("action-marker", p.action.type, "context #timeline_node", styles["action-marker"], selectedActionIds.includes(p.action.id) && "selected", selectedActionIds.includes(p.action.id) && styles.selected)}
                                style={{ left: `${p.x}px`, top: `${p.y}px`, transform: "translate(-50%, -50%)" }}
                                onMouseDown={(e) => {
                                    e.stopPropagation()
                                    if (e.button === 0) onActionDrag(e.nativeEvent, p.action.id)
                                }}
                            >
                                <div className={cn("action-head", styles["action-head"])}>{p.action.type === "action" ? <Icon id={triggerIcon || "actions"} size={0.9} white /> : typeof index === "number" ? index + 1 : null}</div>
                                <div className={cn("action-label", styles["action-label"])} style={cssTextToStyle(`${p.action.color ? `border-bottom: 1px solid ${p.action.color};` : ""}font-size: 0.7em;`)}>
                                    {p.action.type === "style" ? (typeof value === "number" ? parseFloat(value.toFixed(1)) : value) : translateText(p.action.name)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : null}

            {contextMenuState ? (
                <div className={cn("easing-context-menu", styles["easing-context-menu"])} style={{ left: `${contextMenuState.x}px`, top: `${contextMenuState.y}px` }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={cn("easing-context-menu-item", styles["easing-context-menu-item"])} onClick={() => applyCurvePinPreset(contextMenuState?.curveIndex ?? 0, contextMenuState?.pin ?? 1, "linear")}>
                        <svg className={cn("preset-preview", styles["preset-preview"])} viewBox="0 0 40 24" width="40" height="24" fill="none">
                            <path d="M 0,24 L 40,0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                        </svg>
                        <span>Linear</span>
                    </button>
                    <button type="button" className={cn("easing-context-menu-item", styles["easing-context-menu-item"])} onClick={() => applyCurvePinPreset(contextMenuState?.curveIndex ?? 0, contextMenuState?.pin ?? 1, "ease")}>
                        <svg className={cn("preset-preview", styles["preset-preview"])} viewBox="0 0 40 24" width="40" height="24" fill="none">
                            {contextMenuState.pin === 1 ? <path d="M 0,24 C 20,0 36,0 40,0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /> : <path d="M 0,24 C 4,24 20,24 40,0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />}
                        </svg>
                        <span>Ease</span>
                    </button>
                </div>
            ) : null}
        </>
    )
}
