// ----- FreeShow -----
// Editor de overlays: plantillas guardadas de gráficos superpuestos que se
// pueden activar sobre la salida (alertas, tercios inferiores, logos).

import type { ProjectionOverlayPosition } from "@/types/Output"

export type OverlayKind = "text" | "lower-third" | "image"

export interface OverlayTemplate {
    id: string
    name: string
    kind: OverlayKind
    text: string
    subtext: string
    src: string
    position: ProjectionOverlayPosition
    color: string
    background: string
}

export type OverlayTemplates = Record<string, OverlayTemplate>

export const OVERLAY_POSITIONS: { value: ProjectionOverlayPosition; label: string }[] = [
    { value: "top", label: "Arriba" },
    { value: "center", label: "Centro" },
    { value: "bottom", label: "Abajo" },
    { value: "bottom-left", label: "Abajo izquierda" },
]

export const OVERLAY_KINDS: { value: OverlayKind; label: string }[] = [
    { value: "text", label: "Alerta" },
    { value: "lower-third", label: "Tercio inferior" },
    { value: "image", label: "Logo" },
]

export const DEFAULT_OVERLAYS: OverlayTemplates = {
    alerta: {
        id: "alerta",
        name: "Alerta",
        kind: "text",
        text: "Volvemos en 5 minutos",
        subtext: "",
        src: "",
        position: "center",
        color: "#ffffff",
        background: "rgba(0,0,0,0.75)",
    },
    tercio: {
        id: "tercio",
        name: "Nombre / cargo",
        kind: "lower-third",
        text: "Nombre Apellido",
        subtext: "Cargo o ministerio",
        src: "",
        position: "bottom-left",
        color: "#ffffff",
        background: "rgba(17,24,39,0.85)",
    },
}
