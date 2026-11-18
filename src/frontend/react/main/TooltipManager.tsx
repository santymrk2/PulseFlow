import { useEffect, useRef, useState } from "react"
import { os } from "../../stores"
import { useStore } from "../hooks/useStore"
import { Tooltip, type TooltipPart } from "./Tooltip"

const tooltipDelay = 700
const autoHideDelay = 8000

export function TooltipManager() {
    const osValue = useStore(os)
    const [visible, setVisible] = useState(false)
    const [tooltipX, setTooltipX] = useState(0)
    const [tooltipY, setTooltipY] = useState(0)
    const [tooltipStyle, setTooltipStyle] = useState("")
    const [parsed, setParsed] = useState<TooltipPart[]>([])

    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const autoHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const currentTarget = useRef<HTMLElement | null>(null)
    const visibleRef = useRef(false)

    useEffect(() => {
        visibleRef.current = visible
    }, [visible])

    function extractShortcuts(input: string): TooltipPart[] {
        if (typeof input !== "string") return []
        const match = input.match(/^(.+?)\s*(?:\[(.*?)\])?$/s)
        if (!match) return [{ text: input, isShortcut: false }]

        const result: TooltipPart[] = [{ text: match[1], isShortcut: false }]
        if (match[2]) {
            const ctrl = osValue.platform === "darwin" ? "Cmd" : "Ctrl"
            const shortcut = match[2].replace("Ctrl", ctrl).replaceAll("+", " + ")
            result.push({ text: `\n${shortcut}`, isShortcut: true })
        }
        return result
    }

    function clearTimers() {
        if (timeout.current) clearTimeout(timeout.current)
        timeout.current = null
        if (autoHideTimeout.current) clearTimeout(autoHideTimeout.current)
        autoHideTimeout.current = null
    }

    function hideTooltip() {
        setVisible(false)
        clearTimers()
    }

    function showTooltip(target: HTMLElement, e: MouseEvent) {
        const title = target.getAttribute("data-title")
        if (!title) return

        const MAX_WIDTH = 250
        const TOOLTIP_HEIGHT = 80
        const OFFSET = 12

        let x = e.clientX
        let y = e.clientY

        const flipX = x + MAX_WIDTH > window.innerWidth
        const flipY = y + TOOLTIP_HEIGHT > window.innerHeight

        if (flipX) {
            x = Math.max(x, MAX_WIDTH)
            x = Math.min(x, window.innerWidth)
            x -= OFFSET * 0.7
        } else {
            x = Math.min(Math.max(x, 0), window.innerWidth - MAX_WIDTH)
            x += OFFSET
        }

        if (flipY) {
            y = Math.max(y, TOOLTIP_HEIGHT)
            y = Math.min(y, window.innerHeight)
        } else {
            y = Math.min(Math.max(y, 0), window.innerHeight - TOOLTIP_HEIGHT)
        }

        setTooltipX(x)
        setTooltipY(y)

        if (!visibleRef.current && !timeout.current) {
            timeout.current = setTimeout(() => {
                const parts = extractShortcuts(title)
                setParsed(parts)

                let style = ""
                if (flipX) {
                    style += `transform: translate(-100%, ${flipY ? "-100%" : "0"});`
                    style += title.length > 35 ? `width: ${MAX_WIDTH}px;` : "white-space: nowrap;"
                } else if (flipY) {
                    style += "transform: translateY(-100%);"
                } else {
                    style += "transform: none;"
                }

                setTooltipStyle(style)
                setVisible(true)
                timeout.current = null

                autoHideTimeout.current = setTimeout(() => {
                    if (!timeout.current) setVisible(false)
                    autoHideTimeout.current = null
                }, autoHideDelay)
            }, tooltipDelay)
        }
    }

    function handleMouseMove(e: MouseEvent) {
        let target = (e.target as Element | null)?.closest("[data-title]") as HTMLElement | null
        if (!target?.getAttribute("data-title")?.length) target = target?.parentElement?.closest("[data-title]") as HTMLElement | null

        if (!target) {
            hideTooltip()
            currentTarget.current = null
            return
        }

        if (currentTarget.current !== target) {
            if (timeout.current) clearTimeout(timeout.current)
            timeout.current = null
            currentTarget.current = target
        }

        showTooltip(target, e)
    }

    function handleMouseOut(e: MouseEvent) {
        if (!currentTarget.current) return
        const related = e.relatedTarget as Node | null
        if (related && currentTarget.current.contains(related)) return
        hideTooltip()
        currentTarget.current = null
    }

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mousedown", hideTooltip)
        window.addEventListener("mouseout", handleMouseOut)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mousedown", hideTooltip)
            window.removeEventListener("mouseout", handleMouseOut)
            clearTimers()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [osValue.platform])

    return <Tooltip parsed={parsed} x={tooltipX} y={tooltipY} visible={visible} style={tooltipStyle} />
}
