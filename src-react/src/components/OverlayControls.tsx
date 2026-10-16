// ----- FreeShow -----
// Gestor de Overlays: crea gráficos superpuestos (alertas, tercios inferiores y
// logos) que flotan por encima de la salida de Audiencia. Escribe en el store de
// proyección, por lo que se sincronizan con la ventana de salida automáticamente.

import { useState } from "react"
import { Layers, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useProjectionStore } from "@/store/useProjectionStore"

const POSITIONS = ["top", "center", "bottom", "bottom-left"] as const
type OverlayPosition = (typeof POSITIONS)[number]

function kindLabel(kind: string): string {
    return { text: "Alerta", "lower-third": "Tercio inferior", image: "Logo" }[kind] ?? kind
}

export default function OverlayControls() {
    const overlays = useProjectionStore((s) => s.overlays)
    const upsertOverlay = useProjectionStore((s) => s.upsertOverlay)
    const removeOverlay = useProjectionStore((s) => s.removeOverlay)

    const [kind, setKind] = useState<"text" | "lower-third" | "image">("text")
    const [text, setText] = useState("")
    const [subtext, setSubtext] = useState("")
    const [src, setSrc] = useState("")
    const [position, setPosition] = useState<OverlayPosition>("bottom-left")

    const add = () => {
        if (kind === "image" && !src.trim()) return
        if (kind !== "image" && !text.trim()) return
        upsertOverlay({
            id: crypto.randomUUID?.() ?? `${Date.now()}`,
            kind,
            text: text.trim(),
            subtext: subtext.trim() || undefined,
            src: kind === "image" ? src.trim() : undefined,
            position: kind === "lower-third" ? "bottom-left" : position,
        })
        setText("")
        setSubtext("")
        setSrc("")
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span className="flex items-center gap-2">
                    <Layers className="size-3.5" />
                    Overlays
                </span>
                {overlays.length > 0 && <span className="text-zinc-600">{overlays.length}</span>}
            </div>

            {/* Lista de overlays activos */}
            {overlays.length > 0 && (
                <div className="flex flex-col gap-1">
                    {overlays.map((overlay) => (
                        <div
                            key={overlay.id}
                            className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1.5"
                        >
                            <span className="flex min-w-0 flex-col">
                                <span className="text-[11px] text-zinc-500 capitalize">{kindLabel(overlay.kind)}</span>
                                <span className="truncate text-xs text-zinc-200">
                                    {overlay.kind === "image" ? overlay.src : overlay.text || "—"}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => removeOverlay(overlay.id)}
                                className="flex size-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Label className="w-14 shrink-0 text-xs text-zinc-500">Tipo</Label>
                    <div className="flex flex-1 gap-1">
                        {[
                            { value: "text", label: "Alerta" },
                            { value: "lower-third", label: "Tercio" },
                            { value: "image", label: "Logo" },
                        ].map((option) => (
                            <Button
                                key={option.value}
                                variant={kind === option.value ? "secondary" : "ghost"}
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => setKind(option.value as typeof kind)}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {kind === "image" ? (
                    <Input
                        value={src}
                        onChange={(event) => setSrc(event.target.value)}
                        placeholder="URL o ruta del logo…"
                        className="h-8 text-xs"
                    />
                ) : (
                    <>
                        <Input
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            placeholder={kind === "lower-third" ? "Nombre / título" : "Mensaje de la alerta…"}
                            className="h-8 text-xs"
                        />
                        <Input
                            value={subtext}
                            onChange={(event) => setSubtext(event.target.value)}
                            placeholder="Subtítulo (opcional)"
                            className="h-8 text-xs"
                        />
                    </>
                )}

                {kind !== "lower-third" && (
                    <div className="flex items-center gap-2">
                        <Label className="w-14 shrink-0 text-xs text-zinc-500">Posición</Label>
                        <Select value={position} onValueChange={(value) => setPosition(value as OverlayPosition)}>
                            <SelectTrigger size="sm" className="flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {POSITIONS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {positionLabel(value)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <Button size="sm" className="gap-1.5" onClick={add}>
                    <Plus className="size-3.5" />
                    Añadir overlay
                </Button>
            </div>
        </div>
    )
}

function positionLabel(position: string): string {
    return { top: "Arriba", center: "Centro", bottom: "Abajo", "bottom-left": "Abajo izquierda" }[position] ?? position
}
