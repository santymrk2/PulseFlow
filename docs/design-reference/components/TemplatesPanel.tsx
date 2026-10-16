// ----- FreeShow -----
// Editor de plantillas: define fondos y estilos reutilizables y aplícalos a la
// diapositiva seleccionada.

import { useState } from "react"
import { LayoutTemplate, Plus, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TEMPLATE_FONTS, type TemplateAlign } from "@/lib/templates"
import { useTemplatesStore } from "@/store/useTemplatesStore"
import { useShowStore } from "@/store/useShowStore"

const ALIGNS: { value: TemplateAlign; label: string }[] = [
    { value: "left", label: "Izquierda" },
    { value: "center", label: "Centro" },
    { value: "right", label: "Derecha" },
]

export default function TemplatesPanel() {
    const templates = useTemplatesStore((s) => s.templates)
    const addTemplate = useTemplatesStore((s) => s.addTemplate)
    const updateTemplate = useTemplatesStore((s) => s.updateTemplate)
    const deleteTemplate = useTemplatesStore((s) => s.deleteTemplate)
    const applyToSelected = useTemplatesStore((s) => s.applyToSelected)
    const hasSelection = useShowStore((s) => !!s.selectedSlideId)

    const [newName, setNewName] = useState("")
    const [applied, setApplied] = useState("")
    const entries = Object.entries(templates)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                <span className="flex items-center gap-2">
                    <LayoutTemplate className="size-3.5" />
                    Plantillas
                </span>
                {applied && (
                    <span className="flex items-center gap-1 text-[10px] normal-case text-emerald-400">
                        <Check className="size-3" />
                        {applied}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {entries.map(([id, template]) => (
                    <div key={id} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="size-8 shrink-0 rounded border border-zinc-800"
                                style={{
                                    background: template.backgroundImage
                                        ? `url(${template.backgroundImage}) center/cover`
                                        : template.background,
                                }}
                            />
                            <Input
                                value={template.name}
                                onChange={(event) => updateTemplate(id, { name: event.target.value })}
                                className="h-7 flex-1 text-xs"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 text-zinc-600 hover:text-red-400"
                                title="Eliminar"
                                onClick={() => deleteTemplate(id)}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                                Fondo
                                <input
                                    type="color"
                                    value={template.background.startsWith("#") ? template.background : "#000000"}
                                    onChange={(event) => updateTemplate(id, { background: event.target.value })}
                                    className="h-7 w-full cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                                Texto
                                <input
                                    type="color"
                                    value={template.textColor}
                                    onChange={(event) => updateTemplate(id, { textColor: event.target.value })}
                                    className="h-7 w-full cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                                />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1 text-[10px] text-zinc-500">
                                Imagen de fondo
                                <Input
                                    value={template.backgroundImage}
                                    onChange={(event) => updateTemplate(id, { backgroundImage: event.target.value })}
                                    placeholder="ruta o URL…"
                                    className="h-7 text-xs"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                                Tipografía
                                <Select
                                    value={template.fontFamily}
                                    onValueChange={(value) => updateTemplate(id, { fontFamily: value })}
                                >
                                    <SelectTrigger size="sm" className="h-7 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TEMPLATE_FONTS.map((font) => (
                                            <SelectItem key={font} value={font}>
                                                {font}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-zinc-500">
                                Alineado
                                <Select
                                    value={template.align}
                                    onValueChange={(value) => updateTemplate(id, { align: value as TemplateAlign })}
                                >
                                    <SelectTrigger size="sm" className="h-7 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALIGNS.map((align) => (
                                            <SelectItem key={align.value} value={align.value}>
                                                {align.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>
                        </div>

                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            disabled={!hasSelection}
                            onClick={() => {
                                if (applyToSelected(id)) setApplied(template.name)
                            }}
                        >
                            Aplicar a la selección
                        </Button>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-1.5 border-t border-zinc-800 pt-3">
                <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Nueva plantilla…"
                    className="h-7 max-w-xs flex-1 text-xs"
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || !newName.trim()) return
                        addTemplate(newName)
                        setNewName("")
                    }}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    onClick={() => {
                        if (!newName.trim()) return
                        addTemplate(newName)
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
