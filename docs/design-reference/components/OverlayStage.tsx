// ----- FreeShow -----
// Capa de Overlays: dibuja los gráficos superpuestos (alertas, tercios inferiores
// y logos) por encima de la salida principal.

import type { ProjectionOverlay } from "@/types/Output"

function positionClasses(position: ProjectionOverlay["position"]): string {
    switch (position) {
        case "top":
            return "top-[6vh] left-1/2 -translate-x-1/2 items-center text-center"
        case "bottom":
            return "bottom-[6vh] left-1/2 -translate-x-1/2 items-center text-center"
        case "bottom-left":
            return "bottom-0 left-0 items-start text-left"
        case "center":
        default:
            return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center text-center"
    }
}

function Overlay({ overlay }: { overlay: ProjectionOverlay }) {
    if (overlay.kind === "image") {
        return (
            <div className={`absolute ${positionClasses(overlay.position)}`}>
                <img
                    src={overlay.src}
                    alt={overlay.text || "logo"}
                    draggable={false}
                    className="max-h-[18vh] max-w-[22vw] object-contain drop-shadow-lg"
                />
            </div>
        )
    }

    if (overlay.kind === "lower-third") {
        return (
            <div className="absolute bottom-[7vh] left-[5vw] max-w-[60vw] overflow-hidden rounded-md shadow-2xl">
                <div
                    className="px-[1.2vw] py-[0.7vh] text-[3.2vw] leading-tight font-bold"
                    style={{ backgroundColor: overlay.background || "#0b57a2", color: overlay.color || "#ffffff" }}
                >
                    {overlay.text}
                </div>
                {overlay.subtext && (
                    <div
                        className="px-[1.2vw] py-[0.5vh] text-[2.2vw] leading-tight"
                        style={{ backgroundColor: overlay.background ? "#000000aa" : "#006fcf", color: overlay.color || "#ffffff" }}
                    >
                        {overlay.subtext}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`absolute ${positionClasses(overlay.position)}`}>
            <div
                className="rounded-md px-[1.5vw] py-[1vh] text-[3.4vw] leading-tight font-bold shadow-2xl"
                style={{
                    backgroundColor: overlay.background || "#000000cc",
                    color: overlay.color || "#ffffff",
                }}
            >
                {overlay.text}
                {overlay.subtext && <div className="mt-[0.5vh] text-[2.2vw] font-normal opacity-85">{overlay.subtext}</div>}
            </div>
        </div>
    )
}

export default function OverlayStage({ overlays }: { overlays: ProjectionOverlay[] }) {
    if (!overlays.length) return null
    return (
        <div className="pointer-events-none absolute inset-0 z-20">
            {overlays.map((overlay) => (
                <Overlay key={overlay.id} overlay={overlay} />
            ))}
        </div>
    )
}
