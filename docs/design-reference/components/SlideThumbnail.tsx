// ----- FreeShow -----
// Miniatura de una diapositiva.
//
// Las diapositivas guardan sus items en un espacio de coordenadas fijo (p. ej.
// 1920×1080) con estilos CSS absolutos. Para la miniatura renderizamos ese lienzo
// completo en su tamaño real y lo escalamos con `transform: scale()` según el
// ancho disponible (medido con `ResizeObserver`), de modo que todo encaja igual
// que en la salida.

import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { useAutoFit } from "@/hooks/useAutoFit"
import { parseStyle } from "@/lib/show"
import type { Item, Resolution, Slide } from "@/types/Show"

function TextItem({ item }: { item: Item }) {
    const itemStyle = parseStyle(item.style)
    const signature = `${JSON.stringify(item.style ?? "")}|${(item.lines ?? [])
        .map((line) => (line.text ?? []).map((segment) => segment.value).join(""))
        .join("\n")}`
    const { ref, factor } = useAutoFit(item.auto !== false, signature)
    return (
        <div style={{ position: "absolute", ...itemStyle }}>
            <div ref={ref}>
                {(item.lines ?? []).map((line, lineIndex) => (
                    <div
                        key={lineIndex}
                        style={{ textAlign: (line.align || item.align || undefined) as CSSProperties["textAlign"] }}
                    >
                        {(line.text ?? []).map((segment, segmentIndex) => (
                            <span key={segmentIndex} style={scaledSegmentStyle(segment.style, factor)}>
                                {segment.value}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Aplica el factor de auto-size al `font-size` del estilo de un segmento. */
function scaledSegmentStyle(style: string | undefined, factor: number): CSSProperties {
    const parsed = parseStyle(style) as CSSProperties & { fontSize?: string | number }
    if (factor === 1 || parsed.fontSize == null) return parsed
    const size = parseFloat(String(parsed.fontSize))
    if (Number.isNaN(size)) return parsed
    return { ...parsed, fontSize: size * factor }
}

export default function SlideThumbnail({ slide, resolution }: { slide: Slide; resolution: Resolution }) {
    const ref = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0)

    useEffect(() => {
        const element = ref.current
        if (!element) return

        const update = () => setScale(element.clientWidth / resolution.width)
        update()

        const observer = new ResizeObserver(update)
        observer.observe(element)
        return () => observer.disconnect()
    }, [resolution.width])

    const textItems = (slide.items ?? []).filter((item) => !item.type || item.type === "text")

    return (
        <div
            ref={ref}
            className="relative aspect-video w-full overflow-hidden"
            style={{ backgroundColor: slide.color || "#000000" }}
        >
            <div
                style={{
                    width: resolution.width,
                    height: resolution.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                }}
            >
                {textItems.map((item, index) => (
                    <TextItem key={index} item={item} />
                ))}
            </div>
        </div>
    )
}
