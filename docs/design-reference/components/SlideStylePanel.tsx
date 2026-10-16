// ----- FreeShow -----
// Panel "Slide" de propiedades: edita el fondo (color/degradado e imagen) y la
// transición de la diapositiva seleccionada. Réplica del `SlideStyle.svelte` +
// los controles de transición de `Transition.svelte` de la versión Svelte.

import { ImageOff, PaintBucket, Tags } from "lucide-react"
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
import { useGroupsStore } from "@/store/useGroupsStore"
import { useShowStore } from "@/store/useShowStore"
import { EASINGS, SLIDE_DIRECTIONS, TRANSITION_TYPES } from "@/lib/transitions"
import type { TransitionType } from "@/types/Show"

const SOLID_COLORS = ["#000000", "#ffffff", "#1e1b4b", "#7f1d1d", "#064e3b", "#0c4a6e", "#3b0764"]

const GRADIENTS: { label: string; value: string }[] = [
    { label: "Noche", value: "linear-gradient(135deg, #0f172a, #1e293b)" },
    { label: "Azul", value: "linear-gradient(135deg, #0c4a6e, #1e3a8a)" },
    { label: "Vino", value: "linear-gradient(135deg, #450a0a, #7f1d1d)" },
    { label: "Bosque", value: "linear-gradient(135deg, #052e16, #065f46)" },
    { label: "Aurora", value: "linear-gradient(135deg, #7c3aed, #db2777)" },
    { label: "Fuego", value: "linear-gradient(135deg, #b91c1c, #f59e0b)" },
]

export default function SlideStylePanel() {
    const show = useShowStore((s) => s.show)
    const selectedSlideId = useShowStore((s) => s.selectedSlideId)
    const updateSlideSettings = useShowStore((s) => s.updateSlideSettings)
    const updateSlideLayoutData = useShowStore((s) => s.updateSlideLayoutData)
    const setSlideGroup = useShowStore((s) => s.setSlideGroup)
    const groups = useGroupsStore((s) => s.groups)

    if (!show || !selectedSlideId) return null
    const slide = show.slides[selectedSlideId]
    if (!slide) return null

    const layoutId = show.settings?.activeLayout || Object.keys(show.layouts ?? {})[0]
    const group = (show.layouts?.[layoutId]?.slides ?? []).find((entry) => entry.id === selectedSlideId)

    const settings = slide.settings ?? {}
    const background = settings.color ?? ""
    const backgroundImage = settings.backgroundImage ?? ""

    const transition = group?.data?.transition ?? { type: "fade" as TransitionType, duration: 500, easing: "sine" }
    const direction = transition.custom?.direction || "left_right"

    const applyBackground = (color: string) => updateSlideSettings(selectedSlideId, { color })
    const applyTransition = (patch: Partial<typeof transition>) =>
        updateSlideLayoutData(selectedSlideId, { transition: { ...transition, ...patch } })

    return (
        <div className="flex flex-col gap-4 p-3">
            {/* GRUPO */}
            <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    <Tags className="size-3.5" />
                    Grupo
                </div>
                <Select
                    value={slide.group || "__none"}
                    onValueChange={(value) => setSlideGroup(selectedSlideId, value === "__none" ? "" : value)}
                >
                    <SelectTrigger size="sm" className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none">Sin grupo</SelectItem>
                        {Object.entries(groups).map(([id, group]) => (
                            <SelectItem key={id} value={id}>
                                <span className="flex items-center gap-2">
                                    <span
                                        className="inline-block size-2.5 rounded-full"
                                        style={{ backgroundColor: group.color }}
                                    />
                                    {group.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </section>

            <div className="border-t border-zinc-800" />

            {/* FONDO */}
            <section className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    <PaintBucket className="size-3.5" />
                    Fondo
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {SOLID_COLORS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => applyBackground(color)}
                            title={color}
                            className={`size-7 rounded border ${background === color ? "ring-2 ring-zinc-300" : "border-zinc-700"}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => applyBackground("")}
                        title="Sin fondo (transparente)"
                        className={`flex size-7 items-center justify-center rounded border ${background === "" ? "ring-2 ring-zinc-300" : "border-zinc-700"} text-zinc-500`}
                    >
                        <ImageOff className="size-3.5" />
                    </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {GRADIENTS.map((gradient) => (
                        <button
                            key={gradient.value}
                            type="button"
                            onClick={() => applyBackground(gradient.value)}
                            title={gradient.label}
                            className={`h-7 w-12 rounded border ${background === gradient.value ? "ring-2 ring-zinc-300" : "border-zinc-700"}`}
                            style={{ backgroundImage: gradient.value }}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <Label className="w-16 shrink-0 text-xs text-zinc-500">Color</Label>
                    <input
                        type="color"
                        value={/^#/.test(background) ? background : "#000000"}
                        onChange={(event) => applyBackground(event.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                    />
                    <Input
                        value={background}
                        placeholder="Color o degradado CSS…"
                        onChange={(event) => applyBackground(event.target.value)}
                        className="h-7 flex-1 text-xs"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Label className="w-14 shrink-0 text-xs text-zinc-500">Imagen</Label>
                    <Input
                        value={backgroundImage}
                        placeholder="Ruta de la imagen de fondo…"
                        onChange={(event) =>
                            updateSlideSettings(selectedSlideId, { backgroundImage: event.target.value })
                        }
                        className="h-7 flex-1 text-xs"
                    />
                </div>
            </section>

            <div className="border-t border-zinc-800" />

            {/* TRANSICIÓN */}
            <section className="flex flex-col gap-2.5">
                <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    Transición
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    {TRANSITION_TYPES.map((type) => (
                        <Button
                            key={type.id}
                            variant={transition.type === type.id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => applyTransition({ type: type.id })}
                            className="h-7 text-[11px]"
                        >
                            {type.label}
                        </Button>
                    ))}
                </div>

                {transition.type === "slide" && (
                    <div className="flex items-center gap-2">
                        <Label className="w-16 shrink-0 text-xs text-zinc-500">Dirección</Label>
                        <Select
                            value={direction}
                            onValueChange={(value) =>
                                applyTransition({ custom: { ...(transition.custom ?? {}), direction: value } })
                            }
                        >
                            <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SLIDE_DIRECTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Label className="w-16 shrink-0 text-xs text-zinc-500">Duración</Label>
                    <Input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        disabled={transition.type === "none"}
                        value={transition.duration / 1000}
                        onChange={(event) =>
                            applyTransition({ duration: Math.round(Number(event.target.value || 0) * 1000) })
                        }
                        className="h-7 flex-1 text-xs"
                    />
                    <span className="text-xs text-zinc-600">s</span>
                </div>

                <div className="flex items-center gap-2">
                    <Label className="w-16 shrink-0 text-xs text-zinc-500">Curva</Label>
                    <Select
                        value={transition.easing}
                        onValueChange={(value) => applyTransition({ easing: value })}
                    >
                        <SelectTrigger size="sm" disabled={transition.type === "none"} className="h-7 flex-1 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {EASINGS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </section>
        </div>
    )
}
