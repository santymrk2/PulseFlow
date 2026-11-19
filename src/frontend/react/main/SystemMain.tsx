import { useEffect, useRef, useState, type ReactNode } from "react"
import { outputs, previewOutputId, styles } from "../../shared/core/stores"
import { getResolution } from "../../components/helpers/output"
import { useStore } from "../hooks/useStore"
import stylesCss from "./SystemMain.module.css"

export interface SystemMainProps {
    children: (size: { width: number; height: number; resolution: ReturnType<typeof getResolution> }) => ReactNode
}

// Expone width/height/resolution a sus hijos (render prop).
export function SystemMain({ children }: SystemMainProps) {
    const outputsValue = useStore(outputs)
    const stylesValue = useStore(styles)
    const previewId = useStore(previewOutputId)
    const ref = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const resolution = getResolution(null, { $outputs: outputsValue, $styles: stylesValue, $previewOutputId: previewId })

    return (
        <div ref={ref} className={stylesCss.main}>
            {children({ width: size.width, height: size.height, resolution })}
        </div>
    )
}
