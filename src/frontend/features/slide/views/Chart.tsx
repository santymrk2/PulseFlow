import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Item } from "../../../../types/Show"
import { replaceDynamicValues } from "../../../shared/utils/helpers/showActions"
import styles from "./Chart.module.css"

export interface ChartProps {
    item: Item
    ref?: { showId?: string; slideId?: string; id?: string; [key: string]: unknown }
}

const FALLBACK_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e", "#06b6d4", "#14b8a6"]

interface ChartDatum {
    label: string
    value: number
    color: string
    colorHex: string
}

function parseData(raw: string | undefined): string[][] {
    if (!raw) return []
    let grid: string[][] = []
    try {
        grid = JSON.parse(raw)
    } catch {
        grid = raw
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
                const parts = line.split(":")
                return [parts[0].trim(), parts[1] ? parts[1].trim() : ""]
            })
    }
    return grid
}

function parseChartData(evaluatedGrid: string[][]): ChartDatum[] {
    if (!evaluatedGrid || evaluatedGrid.length === 0) return []
    const hasHeader = evaluatedGrid[0] && evaluatedGrid[0][0] === "Label" && isNaN(parseFloat(evaluatedGrid[0][1]))
    const dataRows = hasHeader ? evaluatedGrid.slice(1) : evaluatedGrid
    const parsed = dataRows.map((row, idx) => {
        const label = row[0] || ""
        let rawVal = (row[1] || "0").trim()
        if (rawVal.endsWith("%")) rawVal = rawVal.slice(0, -1)
        const val = parseFloat(rawVal)
        const colorHex = row[2] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
        return { label, value: isNaN(val) ? 0 : val, color: colorHex, colorHex }
    })
    return parsed.length > 0 ? parsed : []
}

// (F24.18a).
export function Chart({ item, ref = {} }: ChartProps) {
    const type = item.chart?.type || "bar"
    const [updateDynamic, setUpdateDynamic] = useState(0)
    const [size, setSize] = useState({ width: 400, height: 240 })
    const wrapperRef = useRef<HTMLDivElement | null>(null)

    const hasDynamicValues = item.chart?.data?.includes("{")

    useEffect(() => {
        if (!hasDynamicValues) return
        const dynamicInterval = setInterval(() => setUpdateDynamic((n) => n + 1), 1000)
        return () => clearInterval(dynamicInterval)
    }, [hasDynamicValues])

    useEffect(() => {
        const elem = wrapperRef.current
        if (!elem || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => {
            setSize({ width: elem.clientWidth, height: elem.clientHeight })
        })
        observer.observe(elem)
        return () => observer.disconnect()
    }, [])

    const evaluatedGrid = parseData(item.chart?.data).map((row) => {
        const label = replaceDynamicValues(row[0] || "", ref, updateDynamic) as string
        const valStr = replaceDynamicValues(row[1] || "0", ref, updateDynamic) as string
        return [label, valStr, row[2] || ""]
    })
    const data = parseChartData(evaluatedGrid)

    const { width, height } = size
    const paddingLeft = 60
    const paddingRight = 30
    const paddingTop = 45
    const fontSize = Math.max(10, Math.min(width * 0.025, height * 0.04))
    const maxLabelLength = Math.max(...data.map((d) => (d.label || "").length), 0)
    const paddingBottom = Math.max(50, 20 + Math.min(maxLabelLength, 15) * fontSize * 0.35)
    const usableWidth = width - paddingLeft - paddingRight
    const usableHeight = height - paddingTop - paddingBottom
    const yAxis = height - paddingBottom
    const maxValue = Math.max(...data.map((d) => d.value), 1)
    const spacing = data.length > 0 ? usableWidth / (data.length + 1) : 80
    const barWidth = Math.min(60, spacing * 0.6)
    const points = data.map((datum, i) => ({
        x: paddingLeft + (i + 1) * spacing,
        y: yAxis - (datum.value / maxValue) * usableHeight
    }))
    const pathD = points.length ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}` : ""
    const areaD = points.length ? `${pathD} L ${points[points.length - 1].x},${yAxis} L ${points[0].x},${yAxis} Z` : ""

    const itemsPerRow = data.length > 4 ? 4 : data.length || 1
    const numRows = Math.ceil(data.length / itemsPerRow) || 1
    const rowGap = Math.max(16, fontSize * 0.75)
    const legendHeight = (numRows - 1) * rowGap + Math.max(20, fontSize * 0.5) + 10
    const usablePieHeight = height - legendHeight
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1
    const allZero = data.every((d) => d.value === 0)
    const pieRadius = Math.min(width * 0.4, usablePieHeight * 0.45)
    const centerX = width / 2
    const centerY = usablePieHeight / 2

    let currentAngle = -90
    const pieSegments = data.map((datum, idx) => {
        const val = allZero ? 1 : datum.value
        const segmentTotal = allZero ? data.length : total
        const angleDegrees = (val / segmentTotal) * 360
        const nextAngle = currentAngle + angleDegrees
        const rad1 = (currentAngle * Math.PI) / 180
        const rad2 = (nextAngle * Math.PI) / 180
        const r = pieRadius
        const x1 = r * Math.cos(rad1)
        const y1 = r * Math.sin(rad1)
        const x2 = r * Math.cos(rad2)
        const y2 = r * Math.sin(rad2)
        const isFull = angleDegrees >= 359.9
        const largeArcFlag = angleDegrees > 180 ? 1 : 0
        const d = isFull ? `M 0 ${(-r).toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 0 ${r.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 0 ${(-r).toFixed(2)} Z` : `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
        const colorHex = datum.colorHex || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
        const midAngle = currentAngle + angleDegrees / 2
        const midRad = (midAngle * Math.PI) / 180
        const textR = r * 0.6
        const textX = isFull ? 0 : textR * Math.cos(midRad)
        const textY = isFull ? 0 : textR * Math.sin(midRad)
        const rawPercent = (datum.value / total) * 100
        const percentage = parseFloat(rawPercent.toFixed(1))
        const showInside = angleDegrees >= 25
        currentAngle = nextAngle
        return { label: datum.label, value: datum.value, d, colorHex, percentage, showInside, textX, textY, isFull }
    })

    const holeSize = item.chart?.holeSize ?? 0
    const visibleSegments = (holeSize > 0 ? pieSegments : pieSegments.filter((segment) => segment.percentage <= 1 || (!(segment.showInside && segment.label && segment.percentage > 1) && !segment.isFull))).filter((s) => s.label)
    const visibleItemsPerRow = visibleSegments.length > 4 ? 4 : visibleSegments.length
    const visibleNumRows = Math.ceil(visibleSegments.length / visibleItemsPerRow)
    const showLegend = holeSize > 0 || pieSegments.filter((segment) => segment.label && (segment.percentage <= 1 || (!(segment.showInside && segment.percentage > 1) && !segment.isFull))).length > 0

    return (
        <div className={styles.chartContainer}>
            <div ref={wrapperRef} className={styles.chartWrapper} style={{ "--chart-font-size": `${fontSize}px` } as CSSProperties}>
                {type === "bar" ? (
                    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                        <defs>
                            {[
                                ["#3b82f6", "#60a5fa"],
                                ["#10b981", "#34d399"],
                                ["#f59e0b", "#fbbf24"],
                                ["#ec4899", "#f472b6"]
                            ].map(([from, to], i) => (
                                <linearGradient key={i} id={`grad${i + 1}`} x1="0%" y1="100%" x2="0%" y2="0%">
                                    <stop offset="0%" stopColor={from} stopOpacity="0.3" />
                                    <stop offset="100%" stopColor={to} />
                                </linearGradient>
                            ))}
                        </defs>
                        {Array.from({ length: 5 }, (_, i) => {
                            const y = paddingTop + i * (usableHeight / 4)
                            return <line key={i} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" strokeDasharray="3,3" />
                        })}
                        {data.map((datum, i) => {
                            const x = paddingLeft + (i + 1) * spacing - barWidth / 2
                            const barHeight = (datum.value / maxValue) * usableHeight
                            const y = yAxis - barHeight
                            return (
                                <g key={i}>
                                    <rect x={x} y={y} width={barWidth} height={barHeight} fill={datum.color} rx="4" />
                                    <text x={paddingLeft + (i + 1) * spacing} y={y - 8} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle">
                                        {datum.value}%
                                    </text>
                                    <text x={paddingLeft + (i + 1) * spacing} y={yAxis + 12} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.axisText}`} textAnchor="end" transform={`rotate(-45, ${paddingLeft + (i + 1) * spacing}, ${yAxis + 12})`}>
                                        {datum.label.length > 12 ? `${datum.label.slice(0, 10)}...` : datum.label}
                                    </text>
                                </g>
                            )
                        })}
                        <line x1={paddingLeft} y1={yAxis} x2={width - paddingRight} y2={yAxis} stroke="#475569" strokeWidth="2" />
                    </svg>
                ) : type === "line" ? (
                    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                        <defs>
                            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {Array.from({ length: 5 }, (_, i) => {
                            const y = paddingTop + i * (usableHeight / 4)
                            return <line key={i} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" strokeDasharray="3,3" />
                        })}
                        <path d={areaD} fill="url(#lineGrad)" />
                        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" />
                        {points.map((p, i) => (
                            <g key={i}>
                                <circle cx={p.x} cy={p.y} r={Math.max(5, fontSize * 0.25)} fill={data[i].colorHex} stroke="#1e293b" strokeWidth={Math.max(2, fontSize * 0.05)} />
                                <text x={p.x} y={p.y - Math.max(8, fontSize * 0.25) - 4} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle">
                                    {data[i].value}%
                                </text>
                                <text x={p.x} y={yAxis + 12} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.axisText}`} textAnchor="end" transform={`rotate(-45, ${p.x}, ${yAxis + 12})`}>
                                    {data[i].label.length > 15 ? `${data[i].label.slice(0, 12)}...` : data[i].label}
                                </text>
                            </g>
                        ))}
                        <line x1={paddingLeft} y1={yAxis} x2={width - paddingRight} y2={yAxis} stroke="#475569" strokeWidth="2" />
                    </svg>
                ) : type === "pie" ? (
                    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                        <defs>
                            <mask id="doughnut-mask" maskContentUnits="userSpaceOnUse">
                                <circle cx="0" cy="0" r={pieRadius + 1} fill="white" />
                                <circle cx="0" cy="0" r={pieRadius * (holeSize / 100)} fill="black" />
                            </mask>
                        </defs>
                        <g transform={`translate(${centerX}, ${centerY})`} mask={holeSize > 0 ? "url(#doughnut-mask)" : ""}>
                            {pieSegments.map((segment, i) => (
                                <g key={i}>
                                    <path d={segment.d} fill={segment.colorHex} />
                                    {segment.percentage > 1 ? (
                                        segment.isFull ? (
                                            segment.label && !(holeSize > 0) ? (
                                                <>
                                                    <text x="0" y={-fontSize * 0.4} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 1.1)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontWeight: "bold" }}>
                                                        {segment.label}
                                                    </text>
                                                    <text x="0" y={fontSize * 0.6} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 1.25)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontWeight: 500 }}>
                                                        100%
                                                    </text>
                                                </>
                                            ) : (
                                                <text x="0" y="4" className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 1.25)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                                    100%
                                                </text>
                                            )
                                        ) : segment.showInside && segment.label && !(holeSize > 0) ? (
                                            <>
                                                <text x={segment.textX} y={segment.textY - fontSize * 0.4} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 0.75)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontWeight: "bold" }}>
                                                    {segment.label.length > 8 ? `${segment.label.slice(0, 7)}..` : segment.label}
                                                </text>
                                                <text x={segment.textX} y={segment.textY + fontSize * 0.5} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 0.85)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontWeight: 500 }}>
                                                    {segment.percentage}%
                                                </text>
                                            </>
                                        ) : (
                                            <text x={segment.textX} y={segment.textY + 2} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.valText}`} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "calc(var(--chart-font-size) * 0.85)", fill: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontWeight: 500 }}>
                                                {segment.percentage}%
                                            </text>
                                        )
                                    ) : null}
                                </g>
                            ))}
                        </g>
                        {showLegend && visibleSegments.length > 0 ? (
                            <g transform={`translate(0, ${height - (visibleNumRows - 1) * rowGap - Math.max(20, fontSize * 0.5)})`}>
                                {visibleSegments.map((segment, i) => {
                                    const rowIdx = Math.floor(i / visibleItemsPerRow)
                                    const colIdx = i % visibleItemsPerRow
                                    const itemsInThisRow = rowIdx === visibleNumRows - 1 ? visibleSegments.length - rowIdx * visibleItemsPerRow : visibleItemsPerRow
                                    const itemWidth = width / itemsInThisRow
                                    const itemX = colIdx * itemWidth + itemWidth / 2
                                    const boxSize = Math.max(10, fontSize * 0.5)
                                    const labelText = segment.percentage <= 1 ? `${segment.label} (${segment.percentage}%)` : segment.label
                                    const textWidth = (labelText.length + 4) * (fontSize * 0.4)
                                    const totalWidth = boxSize + 6 + textWidth
                                    return (
                                        <g key={i} transform={`translate(${itemX - totalWidth / 2}, ${rowIdx * rowGap})`}>
                                            {segment.label ? (
                                                <>
                                                    <rect x="0" y={-boxSize / 2} width={boxSize} height={boxSize} fill={segment.colorHex} rx="2" />
                                                    <text x={boxSize + 6} y={boxSize / 2 - 1} className={`chart-text ${styles["chart-text"]} ${styles.chartText} ${styles.legendText}`} textAnchor="start">
                                                        {labelText}
                                                    </text>
                                                </>
                                            ) : null}
                                        </g>
                                    )
                                })}
                            </g>
                        ) : null}
                    </svg>
                ) : null}
            </div>
        </div>
    )
}
