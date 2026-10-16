// ----- FreeShow -----
// Editor de overlays: lista de plantillas guardadas con edición en línea y
// activación sobre la salida.

import { useState } from "react"
import { Layers, Plus, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OVERLAY_KINDS, OVERLAY_POSITIONS, type OverlayKind } from "@/lib/overlays"
import { useOverlaysStore } from "@/store/useOverlaysStore"
import type { ProjectionOverlayPosition } from "@/types/Output"

export default function OverlaysLibraryPanel() {
    const overlays = useOverlaysStore((s) => s.overlays)
    const addOverlay = useOverlaysStore((s) => s.addOverlay)
    const updateOverlay = useOverlaysStore((s) => s.updateOverlay)
    const deleteOverlay = useOverlaysStore((s) => s.deleteOverlay)
    const activate = useOverlaysStore((s) => s.activate)

    const [newName, setNewName] = useState("")
    const entries = Object.entries(overlays)

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span className="flex items-center gap-2">
                    <Layers className="size-3.5" />
                    Overlays
                </span>
                <span className="text-zinc-600">{entries.length}</span>
            </div>

            <div className="flex flex-col gap-2">
                {entries.map(([id, overlay]) => (
                    <div key={id} className="flex flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
                        <div className="flex items-center gap-1.5">
                            <Input
                                value={overlay.name}
                                onChange={(event) => updateOverlay(id, { name: event.target.value })}
                                className="h-7 flex-1 text-xs"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-zinc-500 hover:text-emerald-300"
                                title="Mostrar en la salida"
                                onClick={() => activate(id)}
                            >
                                <Play className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                                title="Eliminar"
                                onClick={() => deleteOverlay(id)}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Select
                                value={overlay.kind}
                                onValueChange={(value) => updateOverlay(id, { kind: value as OverlayKind })}
                            >
                                <SelectTrigger size="sm" className="h-7 w-28 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OVERLAY_KINDS.map((kind) => (
                                        <SelectItem key={kind.value} value={kind.value}>
                                            {kind.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={overlay.position}
                                onValueChange={(value) =>
                                    updateOverlay(id, { position: value as ProjectionOverlayPosition })
                                }
                            >
                                <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OVERLAY_POSITIONS.map((position) => (
                                        <SelectItem key={position.value} value={position.value}>
                                            {position.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {overlay.kind === "image" ? (
                            <Input
                                value={overlay.src}
                                onChange={(event) => updateOverlay(id, { src: event.target.value })}
                                placeholder="URL o ruta del logo…"
                                className="h-7 text-xs"
                            />
                        ) : (
                            <>
                                <Input
                                    value={overlay.text}
                                    onChange={(event) => updateOverlay(id, { text: event.target.value })}
                                    placeholder="Texto"
                                    className="h-7 text-xs"
                                />
                                <Input
                                    value={overlay.subtext}
                                    onChange={(event) => updateOverlay(id, { subtext: event.target.value })}
                                    placeholder="Subtítulo (opcional)"
                                    className="h-7 text-xs"
                                />
                            </>
                        )}

                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                Texto
                                <input
                                    type="color"
                                    value={overlay.color}
                                    onChange={(event) => updateOverlay(id, { color: event.target.value })}
                                    className="size-6 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                                />
                            </label>
                            <label className="flex flex-1 items-center gap-1.5 text-[10px] text-zinc-500">
                                Fondo
                                <Input
                                    value={overlay.background}
                                    onChange={(event) => updateOverlay(id, { background: event.target.value })}
                                    className="h-6 text-xs"
                                />
                            </label>
                        </div>
                    </div>
                ))}
                {entries.length === 0 && <p className="py-2 text-center text-xs text-zinc-600">Sin overlays.</p>}
            </div>

            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nuevo overlay…"
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || !newName.trim()) return
                        addOverlay(newName)
                        setNewName("")
                    }}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                        if (!newName.trim()) return
                        addOverlay(newName)
                        setNewName("")
                    }}
                >
                    <Plus className="size-3.5" />
                    Añadir
                </Button>
            </div>
        </div>
    )
}
