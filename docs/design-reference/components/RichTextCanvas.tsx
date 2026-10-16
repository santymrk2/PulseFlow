// ----- FreeShow -----
// Lienzo de texto enriquecido. Renderiza un bloque `ProjectionRichText` en un
// espacio fijo de 1920×1080 escalado al contenedor (misma técnica que las
// miniaturas), de modo que la salida coincide con lo editado.
//
// Soporta dos modos: `lines` (bloque de texto centrado, el clásico) y `boxes`
// (items posicionados de forma absoluta con su propio estilo), de modo que las
// cajas movidas/redimensionadas en el editor se reproducen igual en la salida.

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useAutoFit } from "@/hooks/useAutoFit"
import { DEFAULT_RESOLUTION, parseStyle } from "@/lib/show"
import type { ProjectionBox, ProjectionRichText, ProjectionTextLine } from "@/types/Output"

function lineStyle(line: ProjectionTextLine, align?: "left" | "center", factor = 1): CSSProperties {
    return {
        fontSize: (line.style?.fontSize ?? 70) * factor,
        fontFamily: line.style?.fontFamily,
        fontWeight: line.style?.fontWeight,
        fontStyle: line.style?.fontStyle,
        color: line.style?.color,
        textShadow: line.style?.textShadow,
        textAlign: line.style?.textAlign ?? align ?? "center",
        lineHeight: 1.15,
    }
}

/** Caja posicionada que ajusta su texto al alto disponible (auto-size). */
function Box({ box, fallbackAlign }: { box: ProjectionBox; fallbackAlign?: "left" | "center" }) {
    const signature = `${box.style ?? ""}|${box.lines.map((line) => line.text).join("\n")}`
    const { ref, factor } = useAutoFit(box.auto !== false, signature)
    return (
        <div className="absolute" style={parseStyle(box.style)}>
            <div ref={ref}>
                {box.lines.map((line, lineIndex) => (
                    <div
                        key={lineIndex}
                        className="whitespace-pre-wrap"
                        style={lineStyle(line, box.align ?? fallbackAlign, factor)}
                    >
                        {line.text}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function RichTextCanvas({
    richText,
    resolution = DEFAULT_RESOLUTION,
    className,
}: {
    richText: ProjectionRichText
    resolution?: { width: number; height: number }
    className?: string
}) {
    const [scale, setScale] = useState(1)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const element = containerRef.current
        if (!element) return
        const update = () => {
            const width = element.clientWidth
            if (width) setScale(width / resolution.width)
        }
        update()
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
        observer?.observe(element)
        window.addEventListener("resize", update)
        return () => {
            observer?.disconnect()
            window.removeEventListener("resize", update)
        }
    }, [resolution.width])

    const boxes = richText.boxes?.filter((box) => box.lines.length) ?? []

    return (
        <div ref={containerRef} className={className ?? "absolute inset-0 overflow-hidden"}>
            <div
                className="relative"
                style={{
                    width: resolution.width,
                    height: resolution.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                }}
            >
                {boxes.length > 0 ? (
                    boxes.map((box, index) => (
                        <Box key={index} box={box} fallbackAlign={richText.align} />
                    ))
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center">
                        {richText.lines.map((line, index) => (
                            <div
                                key={index}
                                className="w-full whitespace-pre-wrap"
                                style={{ ...lineStyle(line, richText.align), paddingLeft: 80, paddingRight: 80 }}
                            >
                                {line.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
