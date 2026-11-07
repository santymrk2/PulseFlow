import { useEffect, useRef, useState } from "react"
import { uid } from "uid"
import { cn } from "../../../lib/utils"
import { dictionary } from "../../../stores"
import { translateText } from "../../../utils/language"
import { Icon } from "../../helpers/Icon"
import { useStore } from "../../hooks/useStore"
import { Button } from "../button/Button"
import styles from "./ZoomControl.module.css"

// Port de ui/zoom-control/zoom-control.svelte. dispatch("change", number) → onChange(number); dispatch("origin", {x, y}) → onOrigin.
// Sin la transición `slide` de Svelte. mousedown y wheel van en window, como <svelte:window>.
export interface ZoomOrigin {
    x: number
    y: number
}

export interface ZoomControlProps {
    columns: number
    defaultValue?: number
    min?: number
    max?: number
    addValue?: number
    hidden?: boolean
    onChange?: (value: number) => void
    onOrigin?: (origin: ZoomOrigin) => void
}

export function ZoomControl({ columns, defaultValue = 4, min = 2, max = 10, addValue = 1, hidden = false, onChange, onOrigin }: ZoomControlProps) {
    useStore(dictionary) // re-render al cambiar el idioma (translateText lee el diccionario)
    const [zoomOpened, setZoomOpened] = useState(false)
    const [currentId] = useState(() => "zoom_" + uid())
    const nextScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    function update(value: number, origin?: ZoomOrigin) {
        let newValue = Math.max(min, Math.min(max, value))
        if (Math.abs(newValue - 1) < 0.01) newValue = 1

        if (origin) onOrigin?.(origin)
        onChange?.(newValue)
    }

    const increase = () => update(columns + addValue)
    const decrease = () => update(columns - addValue)
    const reset = () => update(defaultValue)

    // Se vuelve a registrar en cada render: el handler lee columns/min/max/addValue actuales
    useEffect(() => {
        function mousedown(e: MouseEvent) {
            const target = e.target instanceof Element ? e.target : null
            if (target?.closest(".zoom_popup") || target?.closest("button")) return

            setZoomOpened(false)
        }

        function wheel(e: WheelEvent) {
            const target = e.target instanceof Element ? e.target : null
            if (!target) return
            if (target.closest(".textfield") || target.closest(".timeline")) return
            if (
                !target.querySelector("#" + currentId) &&
                !target.closest(".center")?.querySelector("#" + currentId) &&
                !target
                    .closest(".scroll")
                    ?.closest(".main")
                    ?.querySelector("#" + currentId) &&
                !target.closest(".editArea")?.querySelector("#" + currentId) &&
                !target.closest(".stageArea")?.querySelector("#" + currentId)
            )
                return

            if (!e.ctrlKey && !e.metaKey) return
            if (nextScrollTimeout.current) return

            const direction = e.deltaY < 0 ? addValue * -1 : addValue
            update(columns + direction, { x: e.clientX, y: e.clientY })

            // don't start timeout if scrolling with mouse
            if (e.deltaY >= 100 || e.deltaY <= -100) return
            nextScrollTimeout.current = setTimeout(() => {
                nextScrollTimeout.current = null
            }, 500)
        }

        window.addEventListener("mousedown", mousedown)
        window.addEventListener("wheel", wheel)
        return () => {
            window.removeEventListener("mousedown", mousedown)
            window.removeEventListener("wheel", wheel)
        }
    })

    return (
        <div id={currentId} className={cn("zoom_container", styles.zoom_container, hidden && styles.hidden)}>
            <Button style={{ width: "100%", height: "100%" }} onClick={() => setZoomOpened(!zoomOpened)} title="actions.zoom">
                <Icon size={1.3} id="zoomIn" white={!zoomOpened} />
            </Button>

            {zoomOpened ? (
                <div className={cn("overflow", "zoom_popup", styles.zoom_popup)}>
                    <Button className={styles.reset} onClick={reset} bold={false}>
                        <p className={styles.text} data-title={translateText("actions.resetZoom")}>
                            {(addValue < 0 ? columns * 100 : 100 / columns).toFixed()}%
                        </p>
                    </Button>

                    <div className={styles.divider}></div>

                    <Button disabled={addValue < 0 ? columns >= max : columns <= min} onClick={decrease} title="actions.zoomIn">
                        <Icon size={1.3} id="add" white />
                    </Button>
                    <Button disabled={addValue < 0 ? columns <= min : columns >= max} onClick={increase} title="actions.zoomOut">
                        <Icon size={1.3} id="remove" white />
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
